import { arrangementFixturePlan } from "./logistics-arrangement-fixture.mjs";

const plan = arrangementFixturePlan();
console.log(JSON.stringify({
  phase: plan.phase,
  status: plan.status,
  environmentType: plan.environment.type,
  safeToCreateFixtures: plan.environment.safeToCreateFixtures,
  cleanupOrder: plan.cleanupOrder,
  remoteWritesExecuted: plan.remoteWritesExecuted,
  migrationApplicationEnabled: plan.migrationApplicationEnabled,
}, null, 2));

process.exitCode = 2;
