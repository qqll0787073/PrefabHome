import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";

test("Admin provisioning is operator-only and not imported by frontend code", () => {
  const sourceFiles = execFileSync("git", ["ls-files", "src"], { encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
  for (const file of sourceFiles) assert.doesNotMatch(readFileSync(file, "utf8"), /admin-provisioning|admin:provision/);
});

test("Admin provisioning remains isolated with migrations 0001 through 0030", () => {
  const versions = readdirSync("supabase/migrations").filter((name) => /^\d{4}_.+\.sql$/.test(name)).map((name) => name.slice(0, 4)).sort();
  assert.deepEqual(versions, Array.from({ length: 30 }, (_, index) => String(index + 1).padStart(4, "0")));
});

test("CLI requires explicit mode and exposes no password argument", () => {
  const source = readFileSync("scripts/admin-provisioning/cli.mjs", "utf8");
  assert.match(source, /MODE_REQUIRED/);
  assert.doesNotMatch(source, /args\.password|--password/);
  assert.match(source, /Production execution is disabled/);
});

test("service-role credential remains server-side and environment-injected", () => {
  const adapter = readFileSync("scripts/admin-provisioning/supabase-adapter.mjs", "utf8");
  assert.match(adapter, /serviceRoleKey/);
  assert.doesNotMatch(adapter, /VITE_/);
});
