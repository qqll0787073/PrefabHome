import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export const TOOL_VERSION = "1.0.0";
export const STAGING_PROJECT_REF = "bvzbkjpbnczquecwqvlm";
export const PRODUCTION_PROJECT_REF = "eoyrfrjbjglfudfuwxdf";
export const STAGING_CONFIRMATION = "PROMOTE VERIFIED STAGING USER TO ADMIN";

export class ProvisioningError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ProvisioningError";
    this.code = code;
    this.details = details;
  }
}

export function normalizeEmail(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new ProvisioningError("INVALID_EMAIL", "A valid Admin email is required.");
  }
  return normalized;
}

export function maskEmail(value) {
  const email = normalizeEmail(value);
  const [local, domain] = email.split("@");
  const maskedLocal = local.length < 3 ? `${local[0] ?? "*"}*` : `${local.slice(0, 2)}***${local.slice(-1)}`;
  const domainParts = domain.split(".");
  domainParts[0] = `${domainParts[0][0] ?? "*"}***`;
  return `${maskedLocal}@${domainParts.join(".")}`;
}

export function maskProjectRef(value) {
  const ref = String(value ?? "");
  return ref.length < 8 ? "***" : `${ref.slice(0, 4)}...${ref.slice(-4)}`;
}

export function redact(value) {
  const blockedKeys = /password|token|secret|key|authorization|jwt|session/i;
  const visit = (item) => {
    if (Array.isArray(item)) return item.map(visit);
    if (item && typeof item === "object") {
      return Object.fromEntries(Object.entries(item).map(([key, child]) => [key, blockedKeys.test(key) ? "[REDACTED]" : visit(child)]));
    }
    if (typeof item !== "string") return item;
    return item
      .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "[REDACTED_JWT]")
      .replace(/\b(?:sbp_|sb_secret_)[A-Za-z0-9_-]{12,}\b/g, "[REDACTED_TOKEN]");
  };
  return visit(value);
}

export function projectRefFromUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co")) return null;
    return url.hostname.slice(0, -".supabase.co".length).toLowerCase();
  } catch {
    return null;
  }
}

export function evaluateEnvironmentGuard({ environment, expectedProjectRef, supabaseUrl, env = {} }) {
  const errors = [];
  const activeRef = projectRefFromUrl(supabaseUrl);
  const productionVariables = Object.keys(env).filter((key) => /production/i.test(key) && /(supabase|project|ref|url|key|token|secret)/i.test(key) && env[key]);
  const productionValues = Object.entries(env).filter(([, value]) => typeof value === "string" && value.toLowerCase().includes(PRODUCTION_PROJECT_REF));
  const stagingVariables = Object.keys(env).filter((key) => /^PREFAB_ADMIN_(?:STAGING_|TARGET_PROJECT_REF|SUPABASE_URL|SERVICE_ROLE_KEY)/i.test(key) && env[key]);

  if (!environment || !["staging", "production"].includes(environment)) errors.push("Explicit environment must be staging or production.");
  if (!expectedProjectRef) errors.push("Explicit expected project ref is required.");
  if (!activeRef) errors.push("Active Supabase URL does not prove a project ref.");
  if (activeRef && expectedProjectRef && activeRef !== expectedProjectRef) errors.push("Active URL project ref does not match the expected project ref.");
  if (environment === "staging" && expectedProjectRef !== STAGING_PROJECT_REF) errors.push("Staging mode requires the authorized Staging project ref.");
  if (environment === "staging" && (activeRef === PRODUCTION_PROJECT_REF || expectedProjectRef === PRODUCTION_PROJECT_REF)) errors.push("Production project ref is hard-denied in Staging mode.");
  if (environment === "production") errors.push("Production execution is disabled pending separate authorization and feature gating.");
  if (productionVariables.length > 0 && stagingVariables.length > 0) errors.push("Ambiguous Staging and Production configuration is prohibited.");
  if (environment === "staging" && productionValues.length > 0) errors.push("Production project evidence is present in the process environment.");

  return { safe: errors.length === 0, environment, expectedProjectRef, activeRef, errors };
}

export function assertEnvironmentGuard(input) {
  const result = evaluateEnvironmentGuard(input);
  if (!result.safe) throw new ProvisioningError("ENVIRONMENT_BLOCKED", "Target environment could not be proven safely.", { errors: result.errors });
  return result;
}

export async function inventoryIdentity(adapter, email) {
  const normalizedEmail = normalizeEmail(email);
  const [authUsers, profiles, conflictingAdmins] = await Promise.all([
    adapter.findAuthUsersByEmail(normalizedEmail),
    adapter.findProfilesByEmail(normalizedEmail),
    adapter.findAdminProfilesByEmail(normalizedEmail),
  ]);
  const auth = authUsers.length === 1 ? authUsers[0] : null;
  const profile = profiles.length === 1 ? profiles[0] : null;
  const issues = [];
  if (authUsers.length > 1) issues.push("duplicate_auth_users");
  if (profiles.length > 1) issues.push("duplicate_profiles");
  if (conflictingAdmins.some((item) => !profile || item.id !== profile.id)) issues.push("conflicting_admin_identity");
  if (auth && normalizeEmail(auth.email) !== normalizedEmail) issues.push("auth_email_mismatch");
  if (profile && normalizeEmail(profile.email) !== normalizedEmail) issues.push("profile_email_mismatch");
  if (auth && profile && auth.id !== profile.id) issues.push("uuid_mismatch");

  return {
    normalizedEmail,
    maskedEmail: maskEmail(normalizedEmail),
    authCount: authUsers.length,
    profileCount: profiles.length,
    auth: auth ? {
      id: auth.id,
      emailConfirmed: Boolean(auth.email_confirmed_at),
      banned: Boolean(auth.banned_until && new Date(auth.banned_until).getTime() > Date.now()),
      disabled: Boolean(auth.disabled),
    } : null,
    profile: profile ? { id: profile.id, role: profile.role, status: profile.status } : null,
    issues,
  };
}

export function assertPromotableInventory(inventory, { expectedUuid, expectedCurrentRole = "buyer", allowUnconfirmed = false } = {}) {
  if (inventory.issues.length) throw new ProvisioningError("IDENTITY_CONFLICT", "Identity inventory contains conflicts.", { issues: inventory.issues });
  if (inventory.authCount !== 1 || inventory.profileCount !== 1) throw new ProvisioningError("IDENTITY_INCOMPLETE", "Exactly one Auth user and one profile are required.");
  if (expectedUuid && inventory.auth.id !== expectedUuid) throw new ProvisioningError("RESUME_UUID_MISMATCH", "Resume UUID does not match the verified Auth user.");
  if (inventory.auth.banned || inventory.auth.disabled) throw new ProvisioningError("AUTH_INACTIVE", "Banned or disabled users cannot be promoted.");
  if (!inventory.auth.emailConfirmed && !allowUnconfirmed) throw new ProvisioningError("EMAIL_UNCONFIRMED", "Email must be confirmed before promotion.");
  if (inventory.profile.status !== "active") throw new ProvisioningError("PROFILE_INACTIVE", "Profile status must be active.");
  if (inventory.profile.role === "admin") return { idempotent: true };
  if (inventory.profile.role !== expectedCurrentRole) throw new ProvisioningError("WRONG_CURRENT_ROLE", "Profile role does not match the explicitly expected pre-Admin role.");
  return { idempotent: false };
}

export function buildRedactedPlan({ guard, inventory, operationType, reason }) {
  return {
    environment: guard.environment,
    projectRef: maskProjectRef(guard.expectedProjectRef),
    email: inventory.maskedEmail,
    authUuid: inventory.auth?.id ?? null,
    currentRole: inventory.profile?.role ?? null,
    intendedRole: "admin",
    profileStatus: inventory.profile?.status ?? null,
    emailConfirmed: inventory.auth?.emailConfirmed ?? false,
    operationType,
    reason,
  };
}

export function assertAccountDesignation(value) {
  if (!new Set(["test", "operator"]).has(value)) {
    throw new ProvisioningError("DESIGNATION_REQUIRED", "Account designation must be explicitly test or operator.");
  }
  return value;
}

export function assertConfirmation(value, environment = "staging") {
  if (environment !== "staging" || value !== STAGING_CONFIRMATION) {
    throw new ProvisioningError("CONFIRMATION_MISMATCH", "Exact Staging confirmation phrase was not supplied.");
  }
}

export async function promoteVerifiedProfile(adapter, inventory, { expectedCurrentRole = "buyer", allowUnconfirmed = false } = {}) {
  const check = assertPromotableInventory(inventory, { expectedCurrentRole, allowUnconfirmed });
  if (check.idempotent) return { outcome: "already_admin", beforeRole: "admin", afterRole: "admin", changedRows: 0 };
  if (await adapter.countManufacturerBusinessRecords(inventory.auth.id) > 0) {
    throw new ProvisioningError("BUSINESS_OWNER_BLOCKED", "Manufacturer owners with business records require separate approval.");
  }
  const updated = await adapter.promoteProfileConditional({
    id: inventory.auth.id,
    email: inventory.normalizedEmail,
    expectedRole: expectedCurrentRole,
    expectedStatus: "active",
  });
  if (updated.length !== 1) throw new ProvisioningError("PROMOTION_CONTAINED", `Conditional promotion affected ${updated.length} rows.`, { changedRows: updated.length });
  const verified = await inventoryIdentity(adapter, inventory.normalizedEmail);
  if (verified.authCount !== 1 || verified.profileCount !== 1 || verified.profile.role !== "admin" || verified.profile.status !== "active" || verified.auth.id !== verified.profile.id) {
    throw new ProvisioningError("POSTCONDITION_FAILED", "Promotion postconditions were not satisfied.", { targetUuid: inventory.auth.id });
  }
  return { outcome: "promoted", beforeRole: expectedCurrentRole, afterRole: "admin", changedRows: 1 };
}

export async function provisionNewUser(adapter, { email, password, emailConfirm = false, waitAttempts = 5 }) {
  const before = await inventoryIdentity(adapter, email);
  if (before.authCount || before.profileCount || before.issues.length) throw new ProvisioningError("NEW_IDENTITY_NOT_EMPTY", "New-user mode requires zero Auth and profile matches.");
  let created;
  try {
    created = await adapter.createAuthUser({ email: before.normalizedEmail, password, emailConfirm, metadata: { role: "buyer" } });
  } catch (error) {
    const recovery = await inventoryIdentity(adapter, email);
    if (recovery.authCount === 1) {
      throw new ProvisioningError("AUTH_CREATE_UNCERTAIN", "Auth creation response was uncertain; resume by verified UUID without creating another user.", { resumeUuid: recovery.auth.id });
    }
    throw new ProvisioningError("AUTH_CREATE_FAILED", "Auth user creation failed without a recoverable identity.");
  }
  for (let attempt = 0; attempt < waitAttempts; attempt += 1) {
    const current = await inventoryIdentity(adapter, email);
    if (current.authCount === 1 && current.profileCount === 1) {
      if (current.auth.id !== created.id) throw new ProvisioningError("CREATED_UUID_MISMATCH", "Created Auth UUID does not match inventory.");
      return current;
    }
    if (attempt + 1 < waitAttempts) await adapter.waitForProfile?.(attempt + 1);
  }
  throw new ProvisioningError("PROFILE_TRIGGER_MISSING", "Auth user exists but its trigger-created profile was not observed.", { resumeUuid: created.id });
}

export function buildAuditRecord({ gitCommit, guard, inventory, operationType, reason, result }) {
  return redact({
    timestamp: new Date().toISOString(), toolVersion: TOOL_VERSION, gitCommit,
    environment: guard.environment, projectRef: maskProjectRef(guard.expectedProjectRef), email: inventory.maskedEmail,
    targetUuid: inventory.auth?.id ?? result?.resumeUuid ?? null, operationType,
    beforeRole: inventory.profile?.role ?? null, afterRole: result?.afterRole ?? inventory.profile?.role ?? null,
    profileStatus: inventory.profile?.status ?? null, operatorReason: reason,
    outcome: result?.outcome ?? "contained",
  });
}

export function writeAuditRecord(record, directory = path.join(os.homedir(), ".prefabhome", "admin-provisioning-audit")) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, `${record.timestamp.replaceAll(":", "-")}-${record.operationType}.json`);
  writeFileSync(file, `${JSON.stringify(redact(record), null, 2)}\n`, { mode: 0o600, flag: "wx" });
  return file;
}
