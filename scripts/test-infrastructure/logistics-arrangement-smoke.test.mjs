import assert from "node:assert/strict";
import test from "node:test";
import { arrangementFixturePlan } from "../smoke/logistics-arrangement-fixture.mjs";

const safeEnv = {
  PREFAB_LBR_SMOKE_ENVIRONMENT: "staging",
};

test("PH-010C fixture plan remains disabled until Phase B approval", () => {
  const plan = arrangementFixturePlan(safeEnv, "bvzbkjpbnczquecwqvlm");
  assert.equal(plan.status, "awaiting_explicit_migration_approval");
  assert.equal(plan.remoteWritesExecuted, 0);
  assert.equal(plan.migrationApplicationEnabled, false);
  assert.deepEqual(plan.plannedIds.candidateIds, []);
});

test("PH-010C cleanup order removes dependent rows first", () => {
  const plan = arrangementFixturePlan(safeEnv, "bvzbkjpbnczquecwqvlm");
  assert.deepEqual(plan.cleanupOrder.slice(0, 3), [
    "logistics_arrangement_events",
    "logistics_provider_selections",
    "logistics_provider_candidates",
  ]);
});

test("PH-010C fixture plan does not serialize credentials", () => {
  const plan = arrangementFixturePlan({
    ...safeEnv,
    PREFAB_STAGING_SUPABASE_SERVICE_ROLE_KEY: "must-not-appear",
    PREFAB_STAGING_DATABASE_PASSWORD: "must-not-appear",
  }, "bvzbkjpbnczquecwqvlm");
  const serialized = JSON.stringify(plan);
  assert.doesNotMatch(serialized, /must-not-appear/);
  assert.equal("credentials" in plan, false);
});
