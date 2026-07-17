import {
  classifySmokeEnvironment,
  fixturePrefix,
  loadSmokeEnvironment,
  readLinkedProjectRef,
} from "./logistics-booking-fixture.mjs";

export function arrangementFixturePlan(env = loadSmokeEnvironment(), linkedProjectRef = readLinkedProjectRef()) {
  const environment = classifySmokeEnvironment(env, linkedProjectRef);
  return {
    phase: "PH-010C Phase B",
    status: environment.safeToCreateFixtures ? "awaiting_explicit_migration_approval" : "blocked_before_fixture_creation",
    environment,
    projectRef: linkedProjectRef,
    fixturePrefix: fixturePrefix().replace("lbr_live_", "arrangement_live_"),
    requiredRoles: ["buyer", "manufacturer", "admin"],
    plannedIds: {
      bookingRequestIds: [],
      candidateIds: [],
      selectionIds: [],
      eventIds: [],
    },
    cleanupOrder: [
      "logistics_arrangement_events",
      "logistics_provider_selections",
      "logistics_provider_candidates",
      "logistics_booking_request_events",
      "logistics_booking_requests",
    ],
    remoteWritesExecuted: 0,
    migrationApplicationEnabled: false,
  };
}
