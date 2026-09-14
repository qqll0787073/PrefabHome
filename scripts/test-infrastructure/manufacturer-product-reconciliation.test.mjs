import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import test from "node:test";

const baseline = "8f836db97ca8d9f5156387e69be1dd9b73c93feb";
const read = (path) => readFileSync(path, "utf8").replaceAll("\r\n", "\n");
const original = read("supabase/migrations/0032_secure_manufacturer_product_management.sql");
const migration = read("supabase/migrations/0036_reconcile_manufacturer_product_numeric_validation.sql");
const extract = (source) => source.match(/create or replace function public\.save_my_manufacturer_product\([\s\S]*?\n\$\$;/)?.[0];

test("0036 replaces only the canonical Product RPC, retaining all existing authority and grants", () => {
  assert.equal(extract(migration), extract(original));
  assert.equal((migration.match(/create or replace function/gi) ?? []).length, 1);
  assert.doesNotMatch(migration, /\b(?:grant|revoke|drop|alter table|create table)\b/i);
  assert.match(migration, /begin;[\s\S]*commit;/);
  assert.doesNotMatch(migration, /greatest\s*\(/i);
  const parameters = extract(migration).split("returns uuid")[0];
  assert.doesNotMatch(parameters, /owner_id|manufacturer_id|reviewed_by|review_notes|status/);
  assert.match(migration, /public\.owns_manufacturer\(m\.id\)/);
  assert.match(migration, /existing\.manufacturer_id <> owned_manufacturer/);
  assert.match(migration, /existing\.status not in \('draft', 'rejected'\)/);
  assert.match(migration, /case when submit_product then 'submitted'/);
});

test("all historical migrations remain byte-identical as Git blobs", () => {
  const files = readdirSync("supabase/migrations").filter((f) => /^00(?:[0-2]\d|3[0-5])_/.test(f)).sort();
  assert.equal(files.length, 35);
  for (const file of files) {
    const path = "supabase/migrations/" + file;
    const expected = execFileSync("git", ["rev-parse", baseline + ":" + path], { encoding: "utf8", windowsHide: true }).trim();
    const actual = execFileSync("git", ["hash-object", path], { encoding: "utf8", windowsHide: true }).trim();
    assert.equal(actual, expected, path);
  }
});

test("read-only predicate regression executes the exact function predicate and covers masked negatives", () => {
  const predicate = extract(migration).match(/  if (\(fob_price_value[\s\S]*?) then\n    raise exception 'Invalid Product numeric value\.'/)[1];
  const sql = read("supabase/tests/manufacturer_product_numeric_predicate_readonly.sql");
  assert.ok(sql.includes(predicate));
  for (const field of ["fob_price", "floor_area", "bathrooms", "length", "width", "height", "snow_load", "bedrooms", "stories", "production_lead_time", "minimum_order_quantity"]) {
    assert.ok(sql.includes("'negative_" + field + "_value'"));
  }
  for (const caseName of ["zero_allowed", "positive", "optional_null", "minimum_order_zero"]) assert.ok(sql.includes("'" + caseName + "'"));
  assert.doesNotMatch(sql, /\b(insert|update|delete|create|alter|drop|do)\b/i);
});

test("executable rollback regression includes positive, null, cross-owner and lifecycle boundaries", () => {
  const sql = read("supabase/tests/manufacturer_product_management_security.sql");
  for (const marker of ["Allowed zero draft failed", "Null optional draft failed", "Cross-Manufacturer Product update accepted", "Manufacturer publication forgery accepted", "Submitted Product edit accepted"]) assert.ok(sql.includes(marker));
  assert.match(sql, /rollback;\s*$/);
  assert.match(read("scripts/local-db/run-disposable-database-validation.mjs"), /manufacturer_product_management_security.sql/);
});

test("normal npm test discovers both TS and TSX source tests", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.match(pkg.scripts.test, /scripts\/testing\/run-source-tests.mjs/);
  const runner = read("scripts/testing/run-source-tests.mjs");
  assert.ok(runner.includes("/\\.test\\.tsx?$/"));
  assert.ok(runner.includes('"--test", ...files'));
});

test("Staging candidate probe uses the same function in pg_temp and always rolls back", () => {
  const probe = read("audit/sprint-5c2/candidate-rollback-probe.sql");
  const candidate = extract(probe.replace("function pg_temp.save_my_manufacturer_product(", "function public.save_my_manufacturer_product("));
  assert.equal(candidate, extract(migration));
  assert.doesNotMatch(probe, /create or replace function public\./i);
  assert.doesNotMatch(probe, /\bcommit\s*;/i);
  assert.match(probe, /begin;[\s\S]*reset role;\s*rollback;/);
  assert.match(probe, /set local statement_timeout/);
  assert.match(probe, /set local lock_timeout/);
});
