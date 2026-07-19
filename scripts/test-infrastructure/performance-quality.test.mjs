import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { analyzeBundle } from "../quality/analyze-bundle.mjs";

function createFixture(t, overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), "prefab-quality-"));
  const dist = join(root, "dist");
  const assets = join(dist, "assets");
  mkdirSync(assets, { recursive: true });
  writeFileSync(join(dist, "index.html"), '<script type="module" src="/assets/index-AbCdEf12.js"></script><link rel="stylesheet" href="/assets/index-ZyXwVu98.css">');
  writeFileSync(join(assets, "index-AbCdEf12.js"), 'import("./route-Qwerty12.js");\n');
  writeFileSync(join(assets, "route-Qwerty12.js"), "export const route = true;\n");
  writeFileSync(join(assets, "index-ZyXwVu98.css"), "body { color: black; }\n");
  const budgetPath = join(root, "budgets.json");
  const budgets = {
    maxArtifactBytes: 10000,
    maxJavaScriptBytes: 5000,
    maxCssBytes: 5000,
    maxInitialJavaScriptBytes: 5000,
    maxLargestJavaScriptBytes: 5000,
    maxLargestCssBytes: 5000,
    maxJavaScriptFiles: 5,
    maxCssFiles: 2,
    maxSourceMaps: 0,
    maxDuplicateHashGroups: 0,
    maxUnreferencedAssetFiles: 0,
    ...overrides,
  };
  writeFileSync(budgetPath, JSON.stringify({ schemaVersion: 1, budgets }));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { dist, assets, budgetPath };
}

test("bundle analyzer reports deterministic totals, initial assets, and reachable lazy chunks", (t) => {
  const fixture = createFixture(t);
  const result = analyzeBundle({ distDirectory: fixture.dist, budgetPath: fixture.budgetPath });
  assert.equal(result.metrics.javascriptFiles, 2);
  assert.equal(result.metrics.cssFiles, 1);
  assert.equal(result.metrics.sourceMaps, 0);
  assert.deepEqual(result.metrics.indexAssets.sort(), [
    "assets/index-AbCdEf12.js",
    "assets/index-ZyXwVu98.css",
  ]);
  assert.deepEqual(result.metrics.unreferencedAssets, []);
  assert.deepEqual(result.metrics.duplicateHashGroups, []);
  assert.deepEqual(result.errors, []);
});

test("bundle analyzer fails explicit size, source-map, duplicate, and reachability budgets", (t) => {
  const fixture = createFixture(t, { maxArtifactBytes: 1 });
  writeFileSync(join(fixture.assets, "index-AbCdEf12.js.map"), "{}\n");
  writeFileSync(join(fixture.assets, "duplicate-a.txt"), "duplicate\n");
  writeFileSync(join(fixture.assets, "duplicate-b.txt"), "duplicate\n");
  writeFileSync(join(fixture.assets, "orphan-AbCdEf12.js"), "export {};\n");
  const result = analyzeBundle({ distDirectory: fixture.dist, budgetPath: fixture.budgetPath });
  assert.ok(result.errors.some((error) => error.startsWith("Total artifact bytes")));
  assert.ok(result.errors.some((error) => error.startsWith("Source map count")));
  assert.ok(result.errors.some((error) => error.startsWith("Duplicate exact-hash group count")));
  assert.ok(result.errors.some((error) => error.startsWith("Unreferenced JS/CSS asset count")));
});
