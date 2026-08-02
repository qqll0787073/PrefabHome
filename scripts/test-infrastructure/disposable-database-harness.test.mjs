import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationRunner = readFileSync("scripts/local-db/run-disposable-database-validation.mjs", "utf8");
const authorityRunner = readFileSync("scripts/local-db/rfq-authority-integration.mjs", "utf8");
const atomicityRunner = readFileSync("scripts/local-db/verify-rfq-migration-atomicity.mjs", "utf8");
const apiRunner = readFileSync("scripts/local-db/rfq-postgrest-integration.mjs", "utf8");
const bootstrap = readFileSync("scripts/local-db/supabase-compat-bootstrap.sql", "utf8");
const combined = [migrationRunner, authorityRunner, atomicityRunner, apiRunner, bootstrap].join("\n");

test("disposable database harnesses require explicit loopback endpoints", () => {
  for (const source of [migrationRunner, authorityRunner, atomicityRunner]) {
    assert.match(source, /127\.0\.0\.1/);
    assert.match(source, /localhost/);
    assert.match(source, /loopback/i);
  }
  assert.match(apiRunner, /PostgREST host must be loopback/);
});

test("disposable harness has no Supabase project or remote migration command", () => {
  assert.doesNotMatch(combined, /[a-z]{20}\.supabase\.co/i);
  assert.doesNotMatch(combined, /supabase\s+(?:link|db\s+push|db\s+reset|migration\s+(?:up|repair))/i);
  assert.doesNotMatch(combined, /SUPABASE_ACCESS_TOKEN\s*=/);
});

test("migration runner scrubs inherited remote database and Supabase variables", () => {
  for (const name of [
    "DATABASE_URL", "PGHOST", "SUPABASE_ACCESS_TOKEN", "SUPABASE_DB_URL",
    "SUPABASE_SERVICE_ROLE_KEY", "VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY",
  ]) {
    assert.match(migrationRunner, new RegExp(`"${name}"`));
  }
  assert.match(migrationRunner, /delete process\.env\[variable\]/);
});

test("compatibility bootstrap models auth JWT claims and Storage RLS dependencies", () => {
  assert.match(bootstrap, /current_setting\('request\.jwt\.claims'/);
  assert.match(bootstrap, /current_setting\('request\.jwt\.claim\.sub'/);
  assert.match(bootstrap, /create table auth\.users/);
  assert.match(bootstrap, /create table storage\.buckets/);
  assert.match(bootstrap, /create table storage\.objects/);
  assert.match(bootstrap, /alter table storage\.objects enable row level security/);
});

test("PostgREST validation uses in-memory local JWTs and no service role", () => {
  assert.match(apiRunner, /createHmac\("sha256", jwtSecret\)/);
  assert.match(apiRunner, /role: "authenticated"/);
  assert.doesNotMatch(apiRunner, /service_role/);
  assert.doesNotMatch(apiRunner, /SUPABASE_(?:URL|KEY|TOKEN)/);
});
