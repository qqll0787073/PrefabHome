import assert from "node:assert/strict";
import test from "node:test";
import { assertProductionReadinessEnvironment } from "../release/verify-production-readiness.mjs";

const commitSha = "a".repeat(40);
const validEnvironment = {
  VITE_SUPABASE_URL: "https://nonconnecting.example.invalid",
  VITE_SUPABASE_ANON_KEY: "browser-publishable-placeholder",
  VITE_ENABLE_MARKETPLACE_DEMO: "false",
  VITE_DEPLOYMENT_ENV: "production",
  VITE_APP_VERSION: "production-verification",
  VITE_COMMIT_SHA: commitSha,
};

test("production readiness accepts only explicit production metadata and disabled demo mode", () => {
  assert.deepEqual(
    assertProductionReadinessEnvironment(validEnvironment, commitSha),
    {
      deploymentEnvironment: "production",
      marketplaceDemoEnabled: false,
      appVersion: "production-verification",
      commitSha,
      approvedBrowserVariables: Object.keys(validEnvironment).sort(),
    },
  );
});

test("production readiness rejects local environment and enabled demo mode", () => {
  assert.throws(
    () => assertProductionReadinessEnvironment({ ...validEnvironment, VITE_DEPLOYMENT_ENV: "local" }, commitSha),
    /VITE_DEPLOYMENT_ENV=production/,
  );
  assert.throws(
    () => assertProductionReadinessEnvironment({ ...validEnvironment, VITE_ENABLE_MARKETPLACE_DEMO: "true" }, commitSha),
    /VITE_ENABLE_MARKETPLACE_DEMO=false/,
  );
});

test("production readiness rejects privileged or unknown browser-prefixed variables", () => {
  for (const name of ["VITE_SUPABASE_SERVICE_ROLE_KEY", "VITE_DATABASE_PASSWORD", "VITE_PROVIDER_SECRET"]) {
    assert.throws(
      () => assertProductionReadinessEnvironment({ ...validEnvironment, [name]: "forbidden-value" }, commitSha),
      /unapproved browser variables/,
    );
  }
});

test("production readiness rejects missing metadata and a commit mismatch", () => {
  assert.throws(
    () => assertProductionReadinessEnvironment({ ...validEnvironment, VITE_APP_VERSION: "development" }, commitSha),
    /non-development VITE_APP_VERSION/,
  );
  assert.throws(
    () => assertProductionReadinessEnvironment({ ...validEnvironment, VITE_COMMIT_SHA: "b".repeat(40) }, commitSha),
    /full candidate commit SHA/,
  );
});
