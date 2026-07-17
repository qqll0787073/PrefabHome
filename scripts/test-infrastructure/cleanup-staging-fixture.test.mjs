import test from "node:test";
import assert from "node:assert/strict";
import { buildCleanupPlan, summarizeCleanupPlan, verifyManifestProject } from "./cleanup-staging-fixture.mjs";
import { createFixtureManifest, addManifestIds } from "./fixture-manifest.mjs";
import { PRODUCTION_PROJECT_REF } from "./staging-safety.mjs";

test("cleanup plan uses reverse dependency order and exact IDs", () => {
  const manifest = createFixtureManifest({ fixturePrefix: "lbr_live_cleanup_abcd", projectRef: "stagingref" });
  addManifestIds(manifest, "bookingRequestIds", "booking-1");
  addManifestIds(manifest, "authUserIds", "user-1");
  const plan = buildCleanupPlan(manifest);
  assert.deepEqual(plan.map((step) => step.table), ["logistics_booking_requests", "auth.users"]);
  assert.deepEqual(plan[0].ids, ["booking-1"]);
});

test("cleanup rejects production project ref", () => {
  const manifest = createFixtureManifest({ fixturePrefix: "lbr_live_cleanup_prod", projectRef: PRODUCTION_PROJECT_REF });
  assert.throws(() => buildCleanupPlan(manifest), /Production project ref/);
});

test("manifest project must match staging environment", () => {
  const manifest = createFixtureManifest({ fixturePrefix: "lbr_live_cleanup_ref", projectRef: "staging-a" });
  assert.throws(() => verifyManifestProject(manifest, "staging-b"), /does not match/);
  assert.equal(verifyManifestProject(manifest, "staging-a"), true);
});

test("cleanup summary reports table counts without IDs", () => {
  const manifest = createFixtureManifest({ fixturePrefix: "lbr_live_cleanup_summary", projectRef: "stagingref" });
  addManifestIds(manifest, "bookingRequestIds", ["secret-looking-id"]);
  const summary = JSON.stringify(summarizeCleanupPlan(buildCleanupPlan(manifest)));
  assert.match(summary, /logistics_booking_requests/);
  assert.doesNotMatch(summary, /secret-looking-id/);
});
