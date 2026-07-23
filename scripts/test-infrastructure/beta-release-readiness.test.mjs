import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { auditBetaDocs, EXPECTED_MIGRATIONS, REQUIRED_BETA_FILES } from "../release/check-beta-docs.mjs";
import { auditTrackedSecrets } from "../release/scan-tracked-secrets.mjs";

test("Beta release manifest covers required documentation and exact migrations", () => {
  assert.equal(REQUIRED_BETA_FILES.length, 13);
  assert.deepEqual(EXPECTED_MIGRATIONS, Array.from({ length: 25 }, (_, index) => String(index + 1).padStart(4, "0")));
  assert.deepEqual(auditBetaDocs(), []);
});

test("Beta document audit reports missing files and broken links", () => {
  const root = mkdtempSync(join(tmpdir(), "prefab-beta-docs-"));
  mkdirSync(join(root, "docs"), { recursive: true });
  writeFileSync(join(root, "README.md"), "[Missing](docs/not-there.md)\n", "utf8");
  const errors = auditBetaDocs(root);
  assert.ok(errors.some((error) => error.includes("Missing required release file")));
  assert.ok(errors.some((error) => error.includes("Broken local link")));
  assert.ok(errors.some((error) => error.includes("Missing migration directory")));
});

test("tracked secret audit passes for the repository", () => {
  const result = auditTrackedSecrets();
  assert.ok(result.trackedFileCount > 0);
  assert.deepEqual(result.findings, []);
});
