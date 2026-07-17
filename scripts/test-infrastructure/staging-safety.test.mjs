import test from "node:test";
import assert from "node:assert/strict";
import { evaluateStagingSafety, formatSafetyReport, projectRefFromSupabaseUrl, PRODUCTION_PROJECT_REF } from "./staging-safety.mjs";

const validEnv = {
  PREFAB_TEST_ENVIRONMENT: "staging",
  PREFAB_ALLOW_FIXTURE_RESET: "true",
  PREFAB_STAGING_PROJECT_REF: "abcdefghijklmnopqrst",
  PREFAB_STAGING_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  PREFAB_STAGING_SUPABASE_PUBLISHABLE_KEY: "publishable-value-not-printed",
  PREFAB_STAGING_SUPABASE_SERVICE_ROLE_KEY: "service-value-not-printed",
  PREFAB_STAGING_DATABASE_PASSWORD: "password-value-not-printed",
};

test("extracts Supabase project ref from project URL", () => {
  assert.equal(projectRefFromSupabaseUrl(validEnv.PREFAB_STAGING_SUPABASE_URL), validEnv.PREFAB_STAGING_PROJECT_REF);
});

test("missing project ref is rejected", () => {
  const result = evaluateStagingSafety({ ...validEnv, PREFAB_STAGING_PROJECT_REF: "" });
  assert.equal(result.safe, false);
  assert.match(result.errors.join(" "), /PROJECT_REF/);
});

test("production project ref is rejected", () => {
  const result = evaluateStagingSafety({
    ...validEnv,
    PREFAB_STAGING_PROJECT_REF: PRODUCTION_PROJECT_REF,
    PREFAB_STAGING_SUPABASE_URL: `https://${PRODUCTION_PROJECT_REF}.supabase.co`,
  });
  assert.equal(result.safe, false);
  assert.match(result.errors.join(" "), /Production project ref/);
});

test("staging ref is accepted", () => {
  const result = evaluateStagingSafety(validEnv);
  assert.equal(result.safe, true);
  assert.equal(result.projectRef, validEnv.PREFAB_STAGING_PROJECT_REF);
});

test("URL and ref mismatch is rejected", () => {
  const result = evaluateStagingSafety({
    ...validEnv,
    PREFAB_STAGING_SUPABASE_URL: "https://zzzzzzzzzzzzzzzzzzzz.supabase.co",
  });
  assert.equal(result.safe, false);
  assert.match(result.errors.join(" "), /must match/);
});

test("missing allow reset is rejected", () => {
  const result = evaluateStagingSafety({ ...validEnv, PREFAB_ALLOW_FIXTURE_RESET: "" });
  assert.equal(result.safe, false);
  assert.match(result.errors.join(" "), /ALLOW_FIXTURE_RESET/);
});

test("secret values are not included in report", () => {
  const report = JSON.stringify(formatSafetyReport(evaluateStagingSafety(validEnv)));
  assert.doesNotMatch(report, /service-value-not-printed/);
  assert.doesNotMatch(report, /password-value-not-printed/);
  assert.doesNotMatch(report, /publishable-value-not-printed/);
  assert.match(report, /PREFAB_STAGING_SUPABASE_SERVICE_ROLE_KEY/);
});

test("local environment is not confused with staging", () => {
  const result = evaluateStagingSafety({
    ...validEnv,
    PREFAB_STAGING_PROJECT_REF: "local",
    PREFAB_STAGING_SUPABASE_URL: "http://localhost:54321",
  });
  assert.equal(result.safe, false);
  assert.match(result.errors.join(" "), /Localhost Supabase URL is not staging/);
});
