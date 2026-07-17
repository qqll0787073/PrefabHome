import {
  assertNoSecretLikeValuesWereRequested,
  classifySmokeEnvironment,
  fixturePrefix,
  loadSmokeEnvironment,
  plannedCleanupOrder,
  readLinkedProjectRef,
  visibleEnvironmentSummary,
} from "./logistics-booking-fixture.mjs";

function main() {
  assertNoSecretLikeValuesWereRequested();

  const env = loadSmokeEnvironment();
  const linkedProjectRef = readLinkedProjectRef();
  const environment = classifySmokeEnvironment(env, linkedProjectRef);
  const summary = visibleEnvironmentSummary(env, linkedProjectRef);
  const prefix = fixturePrefix();

  const result = {
    project: "PH-010B.1 Logistics Booking Live Smoke and True-Concurrency Verification",
    status: environment.safeToCreateFixtures ? "ready_for_operator_confirmation" : "blocked_before_fixture_creation",
    environment,
    visibleEnvironmentSummary: summary,
    fixturePrefix: prefix,
    plannedCleanupOrder: plannedCleanupOrder(),
    safety: {
      createdFixtureRecords: false,
      printedSecrets: false,
      requiresExplicitLinkedProjectOptIn: environment.type === "linked",
      requiresCleanupProofBeforeCreation: true,
    },
    nextStep: environment.safeToCreateFixtures
      ? "Implement or run fixture setup only after cleanup proof is confirmed for this environment."
      : "Provide a disposable/staging Supabase project or local Supabase instance, or explicitly opt in to linked-project live smoke after proving exact cleanup is safe.",
  };

  console.log(JSON.stringify(result, null, 2));

  if (!environment.safeToCreateFixtures) {
    process.exitCode = 2;
  }
}

main();
