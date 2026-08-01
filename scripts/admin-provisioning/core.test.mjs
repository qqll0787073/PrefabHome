import test from "node:test";
import assert from "node:assert/strict";
import {
  PRODUCTION_PROJECT_REF, STAGING_CONFIRMATION, STAGING_PROJECT_REF, ProvisioningError,
  assertAccountDesignation, assertConfirmation, assertEnvironmentGuard, assertPromotableInventory, buildAuditRecord,
  evaluateEnvironmentGuard, inventoryIdentity, promoteVerifiedProfile, provisionNewUser, redact,
} from "./core.mjs";

const EMAIL = "admin.uat@example.test";
const UUID = "11111111-1111-4111-8111-111111111111";

function auth(overrides = {}) { return { id: UUID, email: EMAIL, email_confirmed_at: "2026-01-01T00:00:00Z", banned_until: null, disabled: false, ...overrides }; }
function profile(overrides = {}) { return { id: UUID, email: EMAIL, role: "buyer", status: "active", ...overrides }; }
function adapter(options = {}) {
  const state = {
    authUsers: options.authUsers ?? [auth()], profiles: options.profiles ?? [profile()], admins: options.admins ?? [],
    businessCount: options.businessCount ?? 0, promoteRows: options.promoteRows,
  };
  return {
    calls: [], state,
    async findAuthUsersByEmail() { this.calls.push("auth"); return state.authUsers; },
    async findProfilesByEmail() { this.calls.push("profiles"); return state.profiles; },
    async findAdminProfilesByEmail() { this.calls.push("admins"); return state.admins; },
    async countManufacturerBusinessRecords() { return state.businessCount; },
    async promoteProfileConditional() {
      const rows = state.promoteRows ?? [{ ...state.profiles[0], role: "admin" }];
      if (rows.length === 1) state.profiles = rows;
      return rows;
    },
    async createAuthUser(input) {
      if (options.createError) { state.authUsers = options.uncertainAuthUsers ?? state.authUsers; throw new Error("unsafe token sb_secret_abcdefghijklmnopqrstuvwxyz"); }
      const created = auth({ email_confirmed_at: input.emailConfirm ? "2026-01-01T00:00:00Z" : null });
      state.authUsers = [created];
      if (!options.profileMissing) state.profiles = [profile()];
      return created;
    },
    async waitForProfile() {},
  };
}

const safeGuard = { environment: "staging", expectedProjectRef: STAGING_PROJECT_REF, supabaseUrl: `https://${STAGING_PROJECT_REF}.supabase.co`, env: {} };

test("correct Staging project passes", () => assert.equal(assertEnvironmentGuard(safeGuard).safe, true));
test("Production ref in Staging mode is rejected", () => assert.throws(() => assertEnvironmentGuard({ ...safeGuard, expectedProjectRef: PRODUCTION_PROJECT_REF, supabaseUrl: `https://${PRODUCTION_PROJECT_REF}.supabase.co` }), /could not be proven/));
test("ambiguous project configuration is rejected", () => assert.equal(evaluateEnvironmentGuard({ ...safeGuard, env: { PREFAB_ADMIN_STAGING_TOKEN: "x", PREFAB_ADMIN_PRODUCTION_TOKEN: "y" } }).safe, false));
test("Production project evidence anywhere in Staging process environment is rejected", () => assert.equal(evaluateEnvironmentGuard({ ...safeGuard, env: { LEGACY_DATABASE_URL: `postgresql://host/${PRODUCTION_PROJECT_REF}` } }).safe, false));
test("missing project proof is rejected", () => assert.equal(evaluateEnvironmentGuard({ ...safeGuard, supabaseUrl: "" }).safe, false));
test("Production execution remains disabled", () => assert.equal(evaluateEnvironmentGuard({ environment: "production", expectedProjectRef: PRODUCTION_PROJECT_REF, supabaseUrl: `https://${PRODUCTION_PROJECT_REF}.supabase.co`, env: {} }).safe, false));
test("account must be explicitly designated test or operator", () => {
  assert.equal(assertAccountDesignation("operator"), "operator");
  assert.throws(() => assertAccountDesignation("customer"), /designation/);
});

test("zero matches are reported without mutation", async () => {
  const mock = adapter({ authUsers: [], profiles: [] });
  const result = await inventoryIdentity(mock, EMAIL);
  assert.equal(result.authCount, 0); assert.equal(result.profileCount, 0); assert.equal(mock.calls.length, 3);
});
test("one existing Auth user and profile align", async () => assert.deepEqual((await inventoryIdentity(adapter(), EMAIL)).issues, []));
test("duplicate Auth users are rejected", async () => {
  const inventory = await inventoryIdentity(adapter({ authUsers: [auth(), auth({ id: "two" })] }), EMAIL);
  assert.throws(() => assertPromotableInventory(inventory), ProvisioningError);
});
test("duplicate profiles are rejected", async () => {
  const inventory = await inventoryIdentity(adapter({ profiles: [profile(), profile({ id: "two" })] }), EMAIL);
  assert.throws(() => assertPromotableInventory(inventory), ProvisioningError);
});
test("UUID mismatch is rejected", async () => {
  const inventory = await inventoryIdentity(adapter({ profiles: [profile({ id: "two" })] }), EMAIL);
  assert.throws(() => assertPromotableInventory(inventory), /conflicts/);
});
test("profile email mismatch is detected", async () => {
  const mock = adapter({ profiles: [profile({ email: "ADMIN.UAT@example.test" })] });
  assert.deepEqual((await inventoryIdentity(mock, EMAIL)).issues, []);
});
test("different profile email is rejected", async () => {
  const inventory = await inventoryIdentity(adapter({ profiles: [profile({ email: "different@example.test" })] }), EMAIL);
  assert.deepEqual(inventory.issues, ["profile_email_mismatch"]);
});
test("wrong current role is rejected", async () => {
  const inventory = await inventoryIdentity(adapter({ profiles: [profile({ role: "manufacturer" })] }), EMAIL);
  assert.throws(() => assertPromotableInventory(inventory), /role/);
});
test("inactive profile is rejected", async () => {
  const inventory = await inventoryIdentity(adapter({ profiles: [profile({ status: "suspended" })] }), EMAIL);
  assert.throws(() => assertPromotableInventory(inventory), /active/);
});
test("banned user is rejected", async () => {
  const inventory = await inventoryIdentity(adapter({ authUsers: [auth({ banned_until: "2999-01-01T00:00:00Z" })] }), EMAIL);
  assert.throws(() => assertPromotableInventory(inventory), /Banned/);
});
test("unconfirmed existing user is rejected", async () => {
  const inventory = await inventoryIdentity(adapter({ authUsers: [auth({ email_confirmed_at: null })] }), EMAIL);
  assert.throws(() => assertPromotableInventory(inventory), /confirmed/);
});
test("resume UUID mismatch is rejected", async () => {
  const inventory = await inventoryIdentity(adapter(), EMAIL);
  assert.throws(() => assertPromotableInventory(inventory, { expectedUuid: "wrong" }), /Resume UUID/);
});

test("new user creation observes trigger profile", async () => {
  const mock = adapter({ authUsers: [], profiles: [] });
  const result = await provisionNewUser(mock, { email: EMAIL, password: "never-logged", emailConfirm: true });
  assert.equal(result.auth.id, UUID); assert.equal(result.profile.id, UUID);
});
test("Auth creation with missing profile returns containment", async () => {
  const mock = adapter({ authUsers: [], profiles: [], profileMissing: true });
  await assert.rejects(provisionNewUser(mock, { email: EMAIL, password: "never-logged", waitAttempts: 2 }), (error) => error.code === "PROFILE_TRIGGER_MISSING");
});
test("retry after uncertain response returns resume UUID", async () => {
  const mock = adapter({ authUsers: [], profiles: [], createError: true, uncertainAuthUsers: [auth()] });
  await assert.rejects(provisionNewUser(mock, { email: EMAIL, password: "never-logged" }), (error) => error.code === "AUTH_CREATE_UNCERTAIN" && error.details.resumeUuid === UUID);
});
test("promotion succeeds and verifies", async () => assert.equal((await promoteVerifiedProfile(adapter(), await inventoryIdentity(adapter(), EMAIL))).outcome, "promoted"));
test("promotion affecting zero rows is contained", async () => {
  const mock = adapter({ promoteRows: [] });
  await assert.rejects(promoteVerifiedProfile(mock, await inventoryIdentity(mock, EMAIL)), (error) => error.code === "PROMOTION_CONTAINED");
});
test("promotion affecting multiple rows is contained", async () => {
  const mock = adapter({ promoteRows: [profile({ role: "admin" }), profile({ id: "two", role: "admin" })] });
  await assert.rejects(promoteVerifiedProfile(mock, await inventoryIdentity(mock, EMAIL)), (error) => error.details.changedRows === 2);
});
test("manufacturer business ownership blocks promotion", async () => {
  const mock = adapter({ businessCount: 1 });
  await assert.rejects(promoteVerifiedProfile(mock, await inventoryIdentity(mock, EMAIL)), (error) => error.code === "BUSINESS_OWNER_BLOCKED");
});
test("already-Admin result is idempotent", async () => {
  const mock = adapter({ profiles: [profile({ role: "admin" })], admins: [profile({ role: "admin" })] });
  assert.equal((await promoteVerifiedProfile(mock, await inventoryIdentity(mock, EMAIL))).outcome, "already_admin");
});

test("password and token fields are redacted", () => {
  const output = JSON.stringify(redact({ password: "plain", nested: { accessToken: "secret" }, message: "sb_secret_abcdefghijklmnopqrstuvwxyz" }));
  assert.doesNotMatch(output, /plain|abcdefghijklmnopqrstuvwxyz/);
});
test("JWT-like values in errors are redacted", () => assert.doesNotMatch(JSON.stringify(redact({ error: "eyJabcdefghijk.abcdefghijkl.abcdefghijkl" })), /eyJ/));
test("confirmation phrase mismatch is rejected", () => assert.throws(() => assertConfirmation("yes"), /confirmation/));
test("exact confirmation phrase passes", () => assert.doesNotThrow(() => assertConfirmation(STAGING_CONFIRMATION)));
test("audit record contains masked identifiers and no credentials", async () => {
  const inventory = await inventoryIdentity(adapter(), EMAIL);
  const record = buildAuditRecord({ gitCommit: "abc", guard: assertEnvironmentGuard(safeGuard), inventory, operationType: "existing", reason: "SEC-1", result: { outcome: "promoted", afterRole: "admin" } });
  const output = JSON.stringify(record); assert.doesNotMatch(output, new RegExp(EMAIL)); assert.match(output, /SEC-1/);
});
