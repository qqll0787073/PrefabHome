import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { pathToFileURL } from "node:url";
import { createSupabaseAdminAdapter } from "./supabase-adapter.mjs";
import {
  ProvisioningError, STAGING_CONFIRMATION, assertAccountDesignation, assertConfirmation, assertEnvironmentGuard,
  assertPromotableInventory, buildAuditRecord, buildRedactedPlan, inventoryIdentity,
  normalizeEmail, promoteVerifiedProfile, provisionNewUser, redact, writeAuditRecord,
} from "./core.mjs";

function parseArgs(argv) {
  const result = { dryRun: false, emailConfirm: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--dry-run") result.dryRun = true;
    else if (value === "--email-confirm") result.emailConfirm = true;
    else if (value.startsWith("--")) result[value.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = argv[++index];
    else throw new ProvisioningError("INVALID_ARGUMENT", `Unexpected argument: ${value}`);
  }
  return result;
}

function help() {
  return `Secure Admin provisioning operator CLI

Dry-run (read-only):
  npm run admin:provision -- --environment staging --email <email> --designation operator --reason <ticket> --dry-run

Mutating modes (require typed confirmation):
  npm run admin:provision -- --environment staging --email <email> --designation operator --reason <ticket> --mode existing
  npm run admin:provision -- --environment staging --email <email> --designation operator --reason <ticket> --mode new [--email-confirm]
  npm run admin:provision -- --environment staging --email <email> --designation operator --reason <ticket> --mode resume --uuid <uuid>

Required process environment:
  PREFAB_ADMIN_TARGET_PROJECT_REF, PREFAB_ADMIN_SUPABASE_URL, PREFAB_ADMIN_SERVICE_ROLE_KEY
  PREFAB_ADMIN_TEMP_PASSWORD (new mode only; inject for one process and clear immediately)

Production execution is disabled. Mutation is never the default. Passwords and keys must not be command arguments.`;
}

async function main(argv = process.argv.slice(2), env = process.env) {
  if (argv.includes("--help") || argv.includes("-h")) { console.log(help()); return; }
  const args = parseArgs(argv);
  if (!args.email || !args.environment || !args.reason || !args.designation) throw new ProvisioningError("MISSING_INPUT", "--environment, --email, --designation, and --reason are required.");
  assertAccountDesignation(args.designation);
  if (!args.dryRun && !["existing", "new", "resume"].includes(args.mode)) throw new ProvisioningError("MODE_REQUIRED", "Mutation requires explicit --mode existing, new, or resume.");
  if (args.mode === "resume" && !args.uuid) throw new ProvisioningError("UUID_REQUIRED", "Resume mode requires --uuid.");
  const guard = assertEnvironmentGuard({ environment: args.environment, expectedProjectRef: env.PREFAB_ADMIN_TARGET_PROJECT_REF, supabaseUrl: env.PREFAB_ADMIN_SUPABASE_URL, env });
  if (!env.PREFAB_ADMIN_SERVICE_ROLE_KEY) throw new ProvisioningError("CREDENTIAL_MISSING", "Operator credential is required through the process environment.");
  const email = normalizeEmail(args.email);
  const adapter = createSupabaseAdminAdapter({ url: env.PREFAB_ADMIN_SUPABASE_URL, serviceRoleKey: env.PREFAB_ADMIN_SERVICE_ROLE_KEY });
  let inventory = await inventoryIdentity(adapter, email);
  if (args.dryRun) {
    console.log(JSON.stringify(redact({ mode: "dry_run", accountDesignation: args.designation, remoteMutations: 0, inventory: { ...inventory, normalizedEmail: undefined } }), null, 2));
    return;
  }
  let operationType = args.mode;
  if (args.mode === "new") {
    if (!env.PREFAB_ADMIN_TEMP_PASSWORD) throw new ProvisioningError("PASSWORD_MISSING", "New-user mode requires a securely injected one-process temporary password.");
  } else {
    assertPromotableInventory(inventory, { expectedUuid: args.uuid });
  }
  const plan = buildRedactedPlan({ guard, inventory, operationType, reason: args.reason });
  console.log(JSON.stringify(plan, null, 2));
  const prompt = createInterface({ input: stdin, output: stdout });
  const confirmation = await prompt.question(`Type exactly: ${STAGING_CONFIRMATION}\n> `);
  prompt.close();
  assertConfirmation(confirmation, args.environment);
  const gitCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  let result;
  try {
    if (args.mode === "new") {
      inventory = await provisionNewUser(adapter, { email, password: env.PREFAB_ADMIN_TEMP_PASSWORD, emailConfirm: args.emailConfirm });
      result = await promoteVerifiedProfile(adapter, inventory, { allowUnconfirmed: !args.emailConfirm });
    } else {
      result = await promoteVerifiedProfile(adapter, inventory);
    }
  } catch (error) {
    const contained = buildAuditRecord({
      gitCommit, guard, inventory, operationType, reason: args.reason,
      result: { outcome: "contained", resumeUuid: error.details?.resumeUuid },
    });
    const auditPath = writeAuditRecord(contained, env.PREFAB_ADMIN_AUDIT_DIR || undefined);
    error.details = { ...(error.details ?? {}), auditRecord: auditPath };
    throw error;
  }
  const record = buildAuditRecord({ gitCommit, guard, inventory, operationType, reason: args.reason, result });
  const auditPath = writeAuditRecord(record, env.PREFAB_ADMIN_AUDIT_DIR || undefined);
  console.log(JSON.stringify({ outcome: result.outcome, targetUuid: inventory.auth.id, auditRecord: auditPath }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const safe = redact({ code: error.code ?? "UNEXPECTED", message: error instanceof ProvisioningError ? error.message : "Unexpected provisioning failure.", details: error.details ?? {} });
    console.error(JSON.stringify(safe, null, 2));
    process.exitCode = error.code?.includes("CONTAIN") || error.code?.includes("UNCERTAIN") || error.code?.includes("TRIGGER") ? 3 : 2;
  });
}

export { main, parseArgs };
