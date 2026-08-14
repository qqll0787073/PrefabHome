import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/0031_secure_manufacturer_account_foundation.sql", "utf8");
const service = readFileSync("src/lib/manufacturers.ts", "utf8");
const statusPanel = readFileSync("src/features/manufacturers/ManufacturerStatusPanel.tsx", "utf8");

test("0031 derives active approved Manufacturer transaction authority", () => {
  assert.match(migration, /m\.owner_id = auth\.uid\(\)/);
  assert.match(migration, /p\.role = 'manufacturer'/);
  assert.match(migration, /p\.status = 'active'/);
  assert.match(migration, /m\.application_status = 'approved'/);
});

test("0031 exposes a safe own-account read without Admin review metadata", () => {
  const readFunction = migration.match(/create or replace function public\.get_my_manufacturer_account\(\)[\s\S]+?\n\$\$;/)?.[0] ?? "";
  assert.match(readFunction, /where p\.id = auth\.uid\(\)/);
  assert.match(readFunction, /p\.role = 'manufacturer'/);
  assert.doesNotMatch(readFunction, /review_notes|reviewed_by|reviewed_at|verification_status|factory_profile/);
});

test("0031 replaces direct Manufacturer DML with one explicit-field RPC while retaining Admin RLS", () => {
  assert.match(migration, /drop policy if exists "manufacturers_insert_one_own_application"/);
  assert.match(migration, /drop policy if exists "manufacturers_update_own_application"/);
  assert.doesNotMatch(migration, /revoke insert, update, delete on public\.manufacturers from authenticated/);
  assert.match(migration, /security definer[\s\S]+set search_path = public/);
  assert.doesNotMatch(migration, /jsonb_populate_record|jsonb_to_record|payload json/i);
  assert.match(service, /rpc\("save_my_manufacturer_application"/);
  const ownService = service.slice(service.indexOf("export async function fetchOwnManufacturerAccount"), service.indexOf("export async function fetchManufacturerApplications"));
  assert.doesNotMatch(ownService, /\.from\("manufacturers"\)|\.select\("\*"\)|\.insert\(|\.update\(/);
});

test("Manufacturer UI never renders Admin review notes", () => {
  assert.doesNotMatch(statusPanel, /application\.review_notes/);
  assert.match(statusPanel, /Internal review details remain private/);
});
