import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { verifyProductionArtifact } from "../release/verify-production-artifact.mjs";

function createArtifactFixture(t) {
  const root = mkdtempSync(join(tmpdir(), "prefab-artifact-test-"));
  const dist = join(root, "dist");
  const assets = join(dist, "assets");
  const manifests = join(root, "manifests");
  mkdirSync(assets, { recursive: true });
  writeFileSync(join(dist, "index.html"), [
    "<!doctype html>",
    '<script type="module" src="/assets/index-AbCdEf12.js"></script>',
    '<link rel="stylesheet" href="/assets/index-ZyXwVu98.css">',
  ].join("\n"));
  writeFileSync(join(assets, "index-AbCdEf12.js"), "console.info('fixture');\n");
  writeFileSync(join(assets, "index-ZyXwVu98.css"), "body { color: #123456; }\n");
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, dist, assets, manifests };
}

test("production artifact verifier writes deterministic file checksums to a temporary manifest", (t) => {
  const fixture = createArtifactFixture(t);
  const options = {
    root: fixture.root,
    distDirectory: fixture.dist,
    manifestDirectory: fixture.manifests,
    checkTrackedRepository: false,
    publicAnonKey: "",
  };
  const first = verifyProductionArtifact(options);
  const second = verifyProductionArtifact(options);

  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.equal(first.fileCount, 3);
  assert.equal(first.javascriptAssets, 1);
  assert.equal(first.cssAssets, 1);
  assert.equal(first.sourceMapCount, 0);
  assert.equal(existsSync(first.manifestPath), true);
  const manifest = JSON.parse(readFileSync(first.manifestPath, "utf8"));
  assert.equal(manifest.artifactSha256, first.artifactSha256);
  assert.deepEqual(manifest.files.map((file) => file.path), [
    "assets/index-AbCdEf12.js",
    "assets/index-ZyXwVu98.css",
    "index.html",
  ]);
  assert.ok(manifest.files.every((file) => /^[0-9a-f]{64}$/.test(file.sha256)));
});

test("production artifact verifier rejects source maps unless explicitly allowed", (t) => {
  const fixture = createArtifactFixture(t);
  writeFileSync(join(fixture.assets, "index-AbCdEf12.js.map"), "{}\n");
  assert.throws(
    () => verifyProductionArtifact({
      root: fixture.root,
      distDirectory: fixture.dist,
      manifestDirectory: fixture.manifests,
      checkTrackedRepository: false,
    }),
    /source maps are not approved/i,
  );
});

test("production artifact verifier rejects bundled environment files and secret signatures", (t) => {
  const environmentFixture = createArtifactFixture(t);
  writeFileSync(join(environmentFixture.dist, ".env.local"), "EXAMPLE=value\n");
  assert.throws(
    () => verifyProductionArtifact({
      root: environmentFixture.root,
      distDirectory: environmentFixture.dist,
      manifestDirectory: environmentFixture.manifests,
      checkTrackedRepository: false,
    }),
    /environment\/local file/i,
  );

  const secretFixture = createArtifactFixture(t);
  writeFileSync(
    join(secretFixture.assets, "secret-AbCdEf12.js"),
    `const value = "${["sb", "secret", "fixturevalue1234567890"].join("_")}";\n`,
  );
  assert.throws(
    () => verifyProductionArtifact({
      root: secretFixture.root,
      distDirectory: secretFixture.dist,
      manifestDirectory: secretFixture.manifests,
      checkTrackedRepository: false,
    }),
    /obvious Supabase secret key signature/i,
  );

  const manifestFixture = createArtifactFixture(t);
  writeFileSync(
    join(manifestFixture.dist, "manifest.webmanifest"),
    JSON.stringify({ token: ["sb", "secret", "fixturevalue1234567890"].join("_") }),
  );
  assert.throws(
    () => verifyProductionArtifact({
      root: manifestFixture.root,
      distDirectory: manifestFixture.dist,
      manifestDirectory: manifestFixture.manifests,
      checkTrackedRepository: false,
    }),
    /obvious Supabase secret key signature/i,
  );
});

test("production artifact verifier rejects missing and non-hashed entry assets", (t) => {
  const fixture = createArtifactFixture(t);
  writeFileSync(join(fixture.dist, "index.html"), '<script type="module" src="/assets/index.js"></script><link rel="stylesheet" href="/assets/missing.css">');
  assert.throws(
    () => verifyProductionArtifact({
      root: fixture.root,
      distDirectory: fixture.dist,
      manifestDirectory: fixture.manifests,
      checkTrackedRepository: false,
    }),
    /non-hashed JS\/CSS asset/i,
  );
});
