import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export const TOOL_VERSION = "1.1.0";
export const STAGING_PROJECT_REF = "bvzbkjpbnczquecwqvlm";
export const PRODUCTION_PROJECT_REF = "eoyrfrjbjglfudfuwxdf";
export const CONFIRM_CREATE = "CREATE VERIFIED STAGING BUYER";
export const CONFIRM_RECOVERY = "SEND STAGING BUYER RECOVERY";
export const CONFIRM_RESUME = "VERIFY STAGING BUYER RESUME";
export const PLAN_TTL_MS = 15 * 60 * 1000;

export class BuyerProvisioningError extends Error {
  constructor(code, message, details = {}) { super(message); this.name = "BuyerProvisioningError"; this.code = code; this.details = details; }
}

export function normalizeEmail(value) { const email = String(value ?? "").trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BuyerProvisioningError("INVALID_EMAIL", "A valid Buyer email is required."); return email; }
export function maskEmail(value) { const [local, domain] = normalizeEmail(value).split("@"); return `${local.slice(0, 2)}***${local.slice(-1)}@${domain[0]}***${domain.slice(domain.lastIndexOf("."))}`; }
export function maskProjectRef(value) { return value?.length >= 8 ? `${value.slice(0, 4)}...${value.slice(-4)}` : "***"; }

export function redact(value) {
  const blocked = /password|token|secret|key|authorization|jwt|session|action_link|hashed_token/i;
  const scrub = (text) => text
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, "Bearer [REDACTED]")
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "[REDACTED_JWT]")
    .replace(/\b(?:sb_secret_|sb_publishable_|sbp_)[A-Za-z0-9_-]{8,}\b/g, "[REDACTED_SUPABASE_VALUE]");
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, blocked.test(key) ? "[REDACTED]" : redact(child)]));
  return typeof value === "string" ? scrub(value) : value;
}

export function projectRefFromUrl(value) { try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password && url.hostname.endsWith(".supabase.co") ? url.hostname.slice(0, -12).toLowerCase() : null; } catch { return null; } }
export function assertStagingEnvironment({ environment, expectedProjectRef, supabaseUrl, env = {} }) {
  const activeRef = projectRefFromUrl(supabaseUrl); const errors = [];
  if (environment !== "staging") errors.push("Only Staging execution is supported.");
  if (expectedProjectRef !== STAGING_PROJECT_REF) errors.push("The authorized Staging project ref is required.");
  if (activeRef !== STAGING_PROJECT_REF || activeRef !== expectedProjectRef) errors.push("The Supabase URL must prove the authorized Staging project.");
  if (activeRef === PRODUCTION_PROJECT_REF || expectedProjectRef === PRODUCTION_PROJECT_REF) errors.push("Production is hard-denied.");
  if (Object.values(env).some((item) => typeof item === "string" && item.toLowerCase().includes(PRODUCTION_PROJECT_REF))) errors.push("Production project evidence exists in the process environment.");
  if (errors.length) throw new BuyerProvisioningError("ENVIRONMENT_BLOCKED", "Target environment could not be proven safely.", { errors });
  return { environment, expectedProjectRef, activeRef };
}

export async function inventoryBuyer(adapter, email) {
  const normalizedEmail = normalizeEmail(email); const [authUsers, profiles] = await Promise.all([adapter.findAuthUsersByEmail(normalizedEmail), adapter.findProfilesByEmail(normalizedEmail)]);
  const auth = authUsers.length === 1 ? authUsers[0] : null; const profile = profiles.length === 1 ? profiles[0] : null; const issues = [];
  if (authUsers.length > 1) issues.push("duplicate_auth_users"); if (profiles.length > 1) issues.push("duplicate_profiles");
  if ((auth && !profile) || (!auth && profile)) issues.push("partial_identity");
  if (auth && normalizeEmail(auth.email) !== normalizedEmail) issues.push("auth_email_mismatch"); if (profile && normalizeEmail(profile.email) !== normalizedEmail) issues.push("profile_email_mismatch");
  if (auth && profile && auth.id !== profile.id) issues.push("uuid_mismatch");
  return { normalizedEmail, maskedEmail: maskEmail(normalizedEmail), authCount: authUsers.length, profileCount: profiles.length,
    auth: auth ? { id: auth.id, emailConfirmed: Boolean(auth.email_confirmed_at), banned: Boolean(auth.banned_until && Date.parse(auth.banned_until) > Date.now()), disabled: Boolean(auth.disabled) } : null,
    profile: profile ? { id: profile.id, role: profile.role, status: profile.status } : null, issues };
}

function assertNoConflicts(inventory, { allowAuthOnly = false } = {}) {
  const allowed = allowAuthOnly ? ["partial_identity"] : [];
  const blocking = inventory.issues.filter((issue) => !allowed.includes(issue));
  if (blocking.length || inventory.authCount > 1 || inventory.profileCount > 1) throw new BuyerProvisioningError("IDENTITY_CONFLICT", "Buyer identity is partial, duplicated, or inconsistent.", { issues: inventory.issues });
}

export function classifyBuyerInventory(inventory) {
  assertNoConflicts(inventory);
  if (inventory.authCount === 0 && inventory.profileCount === 0) return "create";
  if (inventory.authCount !== 1 || inventory.profileCount !== 1) throw new BuyerProvisioningError("IDENTITY_INCOMPLETE", "Exactly zero or one consistent Auth/Profile identity is required.");
  assertBuyerState(inventory, { requireConfirmed: true }); return "recovery";
}

export function assertConfirmation(value, mode) {
  const expected = mode === "create" ? CONFIRM_CREATE : mode === "recovery" ? CONFIRM_RECOVERY : CONFIRM_RESUME;
  if (value !== expected) throw new BuyerProvisioningError("CONFIRMATION_MISMATCH", "Exact Staging confirmation phrase was not supplied.");
}

export function assertBuyerState(inventory, { expectedUuid, requireConfirmed = false } = {}) {
  assertNoConflicts(inventory);
  if (inventory.authCount !== 1 || inventory.profileCount !== 1 || inventory.auth.id !== inventory.profile.id) throw new BuyerProvisioningError("IDENTITY_INCOMPLETE", "Exactly one consistent Auth/Profile identity is required.");
  if (expectedUuid && inventory.auth.id !== expectedUuid) throw new BuyerProvisioningError("RESUME_UUID_MISMATCH", "Inventory UUID does not match the approved UUID.");
  if (inventory.auth.banned || inventory.auth.disabled) throw new BuyerProvisioningError("AUTH_INACTIVE", "The Auth user is banned or disabled.");
  if (requireConfirmed && !inventory.auth.emailConfirmed) throw new BuyerProvisioningError("EMAIL_UNCONFIRMED", "Recovery requires a confirmed Auth user.");
  if (inventory.profile.role !== "buyer") throw new BuyerProvisioningError("WRONG_ROLE", "The existing profile is not a Buyer.");
  if (inventory.profile.status !== "active") throw new BuyerProvisioningError("PROFILE_INACTIVE", "The existing Buyer profile is not active."); return inventory;
}

export function inventoryFingerprint(inventory) {
  const shape = { email: inventory.normalizedEmail, authCount: inventory.authCount, profileCount: inventory.profileCount, auth: inventory.auth, profile: inventory.profile, issues: [...inventory.issues].sort() };
  return createHash("sha256").update(JSON.stringify(shape)).digest("hex");
}
function canonicalPlan(payload) { return JSON.stringify(payload); }
export function createPlanArtifact({ guard, inventory, operation, resumeUuid, now = Date.now(), ttlMs = PLAN_TTL_MS }) {
  if (operation === "resume") validateResumeInventory(inventory, resumeUuid, { allowPending: true });
  else if (classifyBuyerInventory(inventory) !== operation) throw new BuyerProvisioningError("MODE_MISMATCH", "Inventory does not support the requested operation.");
  const payload = { version: 1, projectRef: guard.expectedProjectRef, email: inventory.normalizedEmail, operation,
    expectedAuthUuid: inventory.auth?.id ?? null, expectedProfileUuid: inventory.profile?.id ?? null,
    expectedRole: inventory.profile?.role ?? null, expectedStatus: inventory.profile?.status ?? null,
    inventoryFingerprint: inventoryFingerprint(inventory), resumeUuid: operation === "resume" ? resumeUuid : null,
    createdAt: new Date(now).toISOString(), expiresAt: new Date(now + ttlMs).toISOString() };
  return { payload, integrity: createHash("sha256").update(canonicalPlan(payload)).digest("hex") };
}
export function writePlanArtifact(artifact, directory = path.join(os.tmpdir(), "prefabhome-buyer-plans")) { mkdirSync(directory, { recursive: true, mode: 0o700 }); const file = path.join(directory, `buyer-plan-${Date.now()}-${artifact.payload.operation}.json`); writeFileSync(file, `${JSON.stringify(artifact, null, 2)}\n`, { mode: 0o600, flag: "wx" }); return file; }
export function readPlanArtifact(file) { try { return JSON.parse(readFileSync(file, "utf8")); } catch { throw new BuyerProvisioningError("PLAN_INVALID", "Plan artifact could not be read."); } }
export function verifyPlanArtifact(artifact, { projectRef, email, operation, inventory, now = Date.now() }) {
  if (!artifact?.payload || artifact.integrity !== createHash("sha256").update(canonicalPlan(artifact.payload)).digest("hex")) throw new BuyerProvisioningError("PLAN_TAMPERED", "Plan integrity verification failed.");
  const plan = artifact.payload;
  if (Date.parse(plan.expiresAt) <= now) throw new BuyerProvisioningError("PLAN_EXPIRED", "The reviewed plan has expired.");
  if (plan.projectRef !== projectRef || plan.email !== normalizeEmail(email) || plan.operation !== operation) throw new BuyerProvisioningError("PLAN_MISMATCH", "Plan does not match the requested project, email, or operation.");
  if (plan.inventoryFingerprint !== inventoryFingerprint(inventory)) {
    const allowedResumeTransition = plan.operation === "resume" && plan.expectedProfileUuid === null && plan.expectedAuthUuid === inventory.auth?.id;
    if (!allowedResumeTransition) throw new BuyerProvisioningError("PLAN_INVENTORY_CHANGED", "Inventory changed after dry-run; generate and review a new plan.");
    validateResumeInventory(inventory, plan.resumeUuid, { allowPending: true });
  }
  return plan;
}

export function validateResumeInventory(inventory, resumeUuid, { allowPending = false } = {}) {
  if (!resumeUuid || inventory.authCount !== 1 || inventory.auth?.id !== resumeUuid) throw new BuyerProvisioningError("RESUME_UUID_MISMATCH", "Resume UUID must match the sole Auth user.");
  assertNoConflicts(inventory, { allowAuthOnly: allowPending && inventory.profileCount === 0 });
  if (inventory.auth.banned || inventory.auth.disabled) throw new BuyerProvisioningError("AUTH_INACTIVE", "The Auth user is banned or disabled.");
  if (inventory.profileCount === 0 && allowPending) return { outcome: "resume_pending", inventory };
  assertBuyerState(inventory, { expectedUuid: resumeUuid }); return { outcome: "resume_verified", inventory };
}
export async function resumeBuyer(adapter, { email, resumeUuid }) { return validateResumeInventory(await inventoryBuyer(adapter, email), resumeUuid, { allowPending: true }); }

export async function createBuyer(adapter, { email, password, emailConfirm = false, waitAttempts = 7 }) {
  const before = await inventoryBuyer(adapter, email); if (classifyBuyerInventory(before) !== "create") throw new BuyerProvisioningError("DUPLICATE_PREVENTED", "An existing Buyer must use recovery; creation is prohibited."); let created;
  try { created = await adapter.createAuthUser({ email: before.normalizedEmail, password, emailConfirm, metadata: { role: "buyer" } }); }
  catch { const recovery = await inventoryBuyer(adapter, email); if (recovery.authCount) throw new BuyerProvisioningError("CREATE_UNCERTAIN", "Auth creation may have succeeded. Do not retry creation; use resume verification.", { resumeUuid: recovery.auth?.id }); throw new BuyerProvisioningError("CREATE_FAILED", "Buyer Auth creation failed without a recoverable identity."); }
  for (let attempt = 0; attempt < waitAttempts; attempt += 1) { const current = await inventoryBuyer(adapter, email); if (current.authCount === 1 && current.profileCount === 1) return assertBuyerState(current, { expectedUuid: created.id }); if (current.issues.some((issue) => issue !== "partial_identity")) throw new BuyerProvisioningError("IDENTITY_CONFLICT", "Identity conflict appeared while waiting for the profile.", { issues: current.issues }); if (attempt + 1 < waitAttempts) await adapter.waitForProfile(attempt + 1); }
  throw new BuyerProvisioningError("PROFILE_TRIGGER_MISSING", "Auth exists but the trigger-created Buyer profile was not observed. Use resume verification; never create again.", { resumeUuid: created.id });
}
export async function sendBuyerRecovery(adapter, reviewedInventory) {
  const fresh = await inventoryBuyer(adapter, reviewedInventory.normalizedEmail); assertBuyerState(fresh, { expectedUuid: reviewedInventory.auth.id, requireConfirmed: true });
  await adapter.requestPasswordRecovery(fresh.normalizedEmail);
  return assertBuyerState(await inventoryBuyer(adapter, fresh.normalizedEmail), { expectedUuid: fresh.auth.id, requireConfirmed: true });
}

export function writeAudit(record, directory = path.join(os.homedir(), ".prefabhome", "buyer-provisioning-audit")) { mkdirSync(directory, { recursive: true, mode: 0o700 }); const safe = redact(record); const file = path.join(directory, `${record.timestamp.replaceAll(":", "-")}-${record.operation}.json`); writeFileSync(file, `${JSON.stringify(safe, null, 2)}\n`, { mode: 0o600, flag: "wx" }); return file; }
