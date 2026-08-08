import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createBuyerProvisioningAdapter } from "./supabase-adapter.mjs";
import {
  BuyerProvisioningError, CONFIRM_CREATE, CONFIRM_RECOVERY, CONFIRM_RESUME, TOOL_VERSION,
  assertConfirmation, assertStagingEnvironment, classifyBuyerInventory, createBuyer, createPlanArtifact,
  inventoryBuyer, maskEmail, maskProjectRef, readPlanArtifact, redact, resumeBuyer, sendBuyerRecovery,
  verifyPlanArtifact, writeAudit, writePlanArtifact,
} from "./core.mjs";

export function parseArgs(argv) { const result = { dryRun: false, emailConfirm: false }; for (let index = 0; index < argv.length; index += 1) { const value = argv[index]; if (value === "--dry-run") result.dryRun = true; else if (value === "--email-confirm") result.emailConfirm = true; else if (value.startsWith("--")) result[value.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = argv[++index]; else throw new BuyerProvisioningError("INVALID_ARGUMENT", `Unexpected argument: ${value}`); } return result; }
function help() { return `Staging Buyer provisioning CLI

Mandatory reviewed dry-run (writes a short-lived local plan):
  npm run buyer:provision -- --environment staging --email <email> --reason <ticket> --dry-run
  npm run buyer:provision -- --environment staging --email <email> --reason <ticket> --dry-run --mode resume --resume-uuid <uuid>

Owner-approved execution using that exact plan:
  npm run buyer:provision -- --environment staging --email <email> --reason <ticket> --mode <create|recovery|resume> --plan <path> [--resume-uuid <uuid>] [--email-confirm]

Required environment: PREFAB_BUYER_TARGET_PROJECT_REF, PREFAB_BUYER_SUPABASE_URL, PREFAB_BUYER_SERVICE_ROLE_KEY; create also requires PREFAB_BUYER_TEMP_PASSWORD.
Production is hard-denied. No SQL is used.`; }
const confirmationFor = (mode) => mode === "create" ? CONFIRM_CREATE : mode === "recovery" ? CONFIRM_RECOVERY : CONFIRM_RESUME;
const containedCodes = new Set(["CREATE_UNCERTAIN", "PROFILE_TRIGGER_MISSING", "PLAN_EXPIRED", "PLAN_TAMPERED", "PLAN_MISMATCH", "PLAN_INVENTORY_CHANGED", "PLAN_REQUIRED", "IDENTITY_CONFLICT", "RESUME_UUID_MISMATCH", "WRONG_ROLE", "PROFILE_INACTIVE", "AUTH_INACTIVE", "EMAIL_UNCONFIRMED"]);

export async function run(argv, env = process.env, dependencies = {}) {
  if (argv.includes("--help") || argv.includes("-h")) { (dependencies.log ?? console.log)(help()); return; }
  const args = parseArgs(argv); const log = dependencies.log ?? console.log;
  if (!args.email || !args.environment || !args.reason) throw new BuyerProvisioningError("MISSING_INPUT", "--environment, --email, and --reason are required.");
  const guard = assertStagingEnvironment({ environment: args.environment, expectedProjectRef: env.PREFAB_BUYER_TARGET_PROJECT_REF, supabaseUrl: env.PREFAB_BUYER_SUPABASE_URL, env });
  if (!env.PREFAB_BUYER_SERVICE_ROLE_KEY) throw new BuyerProvisioningError("CREDENTIAL_MISSING", "A Staging operator credential is required through the process environment.");
  const adapter = dependencies.adapter ?? createBuyerProvisioningAdapter({ url: env.PREFAB_BUYER_SUPABASE_URL, serviceRoleKey: env.PREFAB_BUYER_SERVICE_ROLE_KEY });
  let operation = args.mode; let lastInventory;
  const audit = (record) => dependencies.writeAudit ? dependencies.writeAudit(record) : writeAudit(record, env.PREFAB_BUYER_AUDIT_DIR || undefined);
  try {
    lastInventory = await inventoryBuyer(adapter, args.email);
    if (args.dryRun) {
      operation = operation ?? classifyBuyerInventory(lastInventory);
      if (!new Set(["create", "recovery", "resume"]).has(operation)) throw new BuyerProvisioningError("MODE_REQUIRED", "Dry-run operation could not be determined.");
      if (operation === "resume" && !args.resumeUuid) throw new BuyerProvisioningError("RESUME_UUID_REQUIRED", "Resume dry-run requires --resume-uuid.");
      const artifact = createPlanArtifact({ guard, inventory: lastInventory, operation, resumeUuid: args.resumeUuid });
      const planPath = dependencies.writePlan ? dependencies.writePlan(artifact) : writePlanArtifact(artifact, env.PREFAB_BUYER_PLAN_DIR || undefined);
      log(JSON.stringify(redact({ outcome: "dry_run", planPath, expiresAt: artifact.payload.expiresAt, operation, email: lastInventory.maskedEmail, projectRef: maskProjectRef(guard.expectedProjectRef), reason: args.reason }), null, 2));
      return { outcome: "dry_run", planPath, artifact };
    }
    if (!new Set(["create", "recovery", "resume"]).has(operation)) throw new BuyerProvisioningError("MODE_REQUIRED", "Mutation requires explicit create, recovery, or resume mode.");
    if (!args.plan) throw new BuyerProvisioningError("PLAN_REQUIRED", "Mutation requires the exact reviewed dry-run plan artifact.");
    const artifact = dependencies.readPlan ? dependencies.readPlan(args.plan) : readPlanArtifact(args.plan);
    const approvedPlan = verifyPlanArtifact(artifact, { projectRef: guard.expectedProjectRef, email: args.email, operation, inventory: lastInventory });
    if (operation === "resume" && args.resumeUuid !== approvedPlan.resumeUuid) throw new BuyerProvisioningError("PLAN_MISMATCH", "Resume UUID does not match the reviewed plan.");
    if (operation === "create" && !env.PREFAB_BUYER_TEMP_PASSWORD) throw new BuyerProvisioningError("PASSWORD_MISSING", "Create mode requires a one-process temporary password.");
    log(JSON.stringify(redact({ outcome: "approved_plan_loaded", operation, email: lastInventory.maskedEmail, expiresAt: approvedPlan.expiresAt, reason: args.reason }), null, 2));
    const prompt = dependencies.confirm ?? (async (message) => { const reader = createInterface({ input: stdin, output: stdout }); const answer = await reader.question(message); reader.close(); return answer; });
    assertConfirmation(await prompt(`Type exactly: ${confirmationFor(operation)}\n> `), operation);
    // A second inventory after confirmation makes the reviewed plan fresh at the action boundary.
    lastInventory = await inventoryBuyer(adapter, args.email);
    verifyPlanArtifact(artifact, { projectRef: guard.expectedProjectRef, email: args.email, operation, inventory: lastInventory });
    const result = operation === "create" ? { outcome: "buyer_created", inventory: await createBuyer(adapter, { email: lastInventory.normalizedEmail, password: env.PREFAB_BUYER_TEMP_PASSWORD, emailConfirm: args.emailConfirm }) }
      : operation === "recovery" ? { outcome: "recovery_requested", inventory: await sendBuyerRecovery(adapter, lastInventory) }
      : await resumeBuyer(adapter, { email: lastInventory.normalizedEmail, resumeUuid: approvedPlan.resumeUuid });
    const record = { timestamp: new Date().toISOString(), toolVersion: TOOL_VERSION, gitCommit: (dependencies.gitCommit ?? (() => execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()))(), environment: "staging", projectRef: maskProjectRef(guard.expectedProjectRef), email: lastInventory.maskedEmail, targetUuid: result.inventory.auth.id, operation, reason: args.reason, outcome: result.outcome, failureClassification: null };
    try { const auditPath = audit(record); log(JSON.stringify({ outcome: result.outcome, auditPath }, null, 2)); return { ...record, auditPath }; }
    catch {
      const fallback = redact({ outcome: "MUTATION_SUCCEEDED_AUDIT_FAILED", message: "The remote mutation already succeeded. Do not retry blindly; operator review and manual audit recovery are required.", operation, projectRef: record.projectRef, email: record.email, targetUuid: record.targetUuid });
      try { (dependencies.errorLog ?? console.error)(JSON.stringify(fallback, null, 2)); } catch { /* remote success remains authoritative */ }
      const error = new BuyerProvisioningError("MUTATION_SUCCEEDED_AUDIT_FAILED", fallback.message, fallback); error.remoteMutationSucceeded = true; throw error;
    }
  } catch (error) {
    const code = error.code ?? "UNEXPECTED";
    if (containedCodes.has(code)) {
      const record = redact({ timestamp: new Date().toISOString(), toolVersion: TOOL_VERSION, environment: "staging", projectRef: maskProjectRef(guard.expectedProjectRef), email: maskEmail(args.email), targetUuid: error.details?.resumeUuid ?? args.resumeUuid ?? null, operation: operation ?? "unknown", reason: args.reason, outcome: code === "PROFILE_TRIGGER_MISSING" || code === "CREATE_UNCERTAIN" || code === "RESUME_PENDING" ? "contained_pending" : "contained_failure", failureClassification: code });
      try { error.details = { ...(error.details ?? {}), auditPath: audit(record) }; } catch { /* preserve the original contained failure */ }
    }
    throw error;
  }
}

if (process.argv[1]?.endsWith("cli.mjs")) run(process.argv.slice(2)).catch((error) => { console.error(JSON.stringify(redact({ code: error.code ?? "UNEXPECTED", message: error instanceof BuyerProvisioningError ? error.message : "Unexpected Buyer provisioning failure.", details: error.details ?? {} }), null, 2)); process.exitCode = 2; });
