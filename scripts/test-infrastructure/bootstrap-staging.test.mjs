import test from "node:test";
import assert from "node:assert/strict";
import { assertExpectedMigrations, buildBootstrapPlan, createIsolatedWorkspacePlan, listMigrationVersions } from "./bootstrap-staging.mjs";

const validEnv = {
  PREFAB_TEST_ENVIRONMENT: "staging",
  PREFAB_ALLOW_FIXTURE_RESET: "true",
  PREFAB_STAGING_PROJECT_REF: "abcdefghijklmnopqrst",
  PREFAB_STAGING_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  PREFAB_STAGING_SUPABASE_PUBLISHABLE_KEY: "publishable-value-not-printed",
  PREFAB_STAGING_SUPABASE_SERVICE_ROLE_KEY: "service-value-not-printed",
  PREFAB_STAGING_DATABASE_PASSWORD: "password-value-not-printed",
};

test("local migrations are exactly 0001 through 0024", () => {
  const versions = listMigrationVersions();
  assert.equal(versions[0], "0001");
  assert.equal(versions.at(-1), "0024");
  assertExpectedMigrations(versions);
});

test("migration assertion rejects missing versions or 0025", () => {
  assert.throws(() => assertExpectedMigrations(["0001", "0025"]), /Expected migrations/);
});

test("isolated workspace plan passes staging ref explicitly", () => {
  const plan = createIsolatedWorkspacePlan("abcdefghijklmnopqrst");
  assert.deepEqual(plan.initializeCommand, ["npx", "supabase", "init"]);
  assert.deepEqual(plan.filesToCopy, ["supabase/migrations"]);
  assert.deepEqual(plan.linkCommand, ["npx", "supabase", "link", "--project-ref", "abcdefghijklmnopqrst"]);
  assert.deepEqual(plan.dryRunCommand, ["npx", "supabase", "db", "push", "--dry-run"]);
});

test("dry-run bootstrap plan does not execute remote writes", () => {
  const plan = buildBootstrapPlan(validEnv);
  assert.equal(plan.mode, "dry_run_plan_only");
  assert.equal(plan.remoteWritesExecuted, 0);
  assert.equal(plan.migrationApplicationEnabled, false);
  assert.equal(plan.applyBlockedByTaskScope, true);
  assert.equal(plan.pendingIfEmpty.length, 24);
});
