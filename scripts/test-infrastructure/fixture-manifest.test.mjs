import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { addManifestIds, createFixtureManifest, manifestPath, readFixtureManifest, writeFixtureManifest } from "./fixture-manifest.mjs";

test("creates fixture manifest with required id arrays", () => {
  const manifest = createFixtureManifest({ fixturePrefix: "lbr_live_1_abcd", projectRef: "stagingref" });
  assert.equal(manifest.fixturePrefix, "lbr_live_1_abcd");
  assert.deepEqual(manifest.authUserIds, []);
  assert.deepEqual(manifest.bookingRequestIds, []);
});

test("adds manifest IDs idempotently", () => {
  const manifest = createFixtureManifest({ fixturePrefix: "lbr_live_2_abcd", projectRef: "stagingref" });
  addManifestIds(manifest, "authUserIds", ["u1", "u1", "u2"]);
  assert.deepEqual(manifest.authUserIds, ["u1", "u2"]);
});

test("manifest path rejects traversal", () => {
  assert.throws(() => manifestPath("../bad"), /Invalid fixture prefix/);
});

test("writes manifests only to caller-provided temp directory", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "prefab-manifest-test-"));
  const manifest = createFixtureManifest({ fixturePrefix: "lbr_live_3_abcd", projectRef: "stagingref" });
  addManifestIds(manifest, "bookingRequestIds", "b1");
  const file = writeFixtureManifest(manifest, dir);
  assert.equal(path.dirname(file), dir);
  assert.deepEqual(readFixtureManifest(file).bookingRequestIds, ["b1"]);
});
