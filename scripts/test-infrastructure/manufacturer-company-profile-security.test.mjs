import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/0033_secure_manufacturer_company_profile.sql", "utf8");
const service = readFileSync("src/lib/manufacturers.ts", "utf8");
const directory = readFileSync("supabase/migrations/0027_buyer_manufacturer_directory.sql", "utf8");
const workspace = readFileSync("src/features/manufacturers/ManufacturerWorkspace.tsx", "utf8");

test("0033 derives approved active Manufacturer authority and exposes no identity parameters", () => {
  assert.match(migration, /where owner_id = auth\.uid\(\) for update/i);
  assert.match(migration, /actor\.role <> 'manufacturer'.*actor\.status <> 'active'/s);
  assert.match(migration, /owned\.application_status <> 'approved'/);
  const signature = migration.match(/update_my_manufacturer_company_profile\([\s\S]+?\)\nreturns uuid/)?.[0] ?? "";
  assert.doesNotMatch(signature, /manufacturer_id|owner_id|role|status|review|verification/);
});

test("workspace guards stale loads and saves across identity changes", () => {
  assert.match(workspace, /loadGeneration\.current/);
  assert.match(workspace, /saveGeneration\.current/);
  assert.match(workspace, /request !== loadGeneration\.current/);
  assert.match(workspace, /request === saveGeneration\.current/);
});

test("approved-owner trigger exception independently locks authority and reviewed fields", () => {
  for (const field of ["company_legal_name","country","year_established","export_experience","product_categories","certifications","owner_id","application_status","review_notes","reviewed_by","reviewed_at","submitted_at","verification_status"]) assert.match(migration, new RegExp(`new\\.${field} is distinct from old\\.${field}`));
  assert.match(migration, /to_jsonb\(new\) - array/);
  assert.match(migration, /Approved Manufacturer profile update contains unexpected fields/);
});

test("RPC grants and frontend request stay narrow", () => {
  assert.match(migration, /revoke all on function public\.update_my_manufacturer_company_profile\([^)]+\) from public, anon, authenticated, service_role/);
  assert.match(migration, /grant execute on function public\.update_my_manufacturer_company_profile\([^)]+\) to authenticated/);
  const call = service.match(/supabase\.rpc\("update_my_manufacturer_company_profile", \{[\s\S]+?\n  \}\);/)?.[0] ?? "";
  assert.ok(call);
  assert.doesNotMatch(call, /manufacturerId|manufacturer_id|owner|role|status|review|verification/);
});

test("Buyer directory remains approved-only and excludes private fields", () => {
  assert.match(directory, /where m\.application_status = 'approved'/);
  assert.doesNotMatch(directory.match(/create view[\s\S]+?revoke all/i)?.[0] ?? "", /contact_person|contact_title|\bemail\b|\bphone\b|street_address|postal_code|owner_id/);
});
