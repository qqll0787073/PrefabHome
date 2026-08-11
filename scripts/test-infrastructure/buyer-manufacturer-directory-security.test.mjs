import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(new URL("../../supabase/migrations/0027_buyer_manufacturer_directory.sql", import.meta.url), "utf8");
const grantsMigration = readFileSync(new URL("../../supabase/migrations/0028_restrict_buyer_manufacturer_directory_grants.sql", import.meta.url), "utf8");
const service = readFileSync(new URL("../../src/lib/buyerManufacturers.ts", import.meta.url), "utf8");

test("0027 is a narrow approved-only projection with authenticated grant", () => {
  assert.match(migration, /where m\.application_status = 'approved'/i);
  assert.match(migration, /p\.status = 'published'/i);
  assert.match(migration, /revoke all .* from public/is);
  assert.match(migration, /grant select .* to authenticated/is);
  assert.doesNotMatch(migration.match(/create view[\s\S]+?revoke all/i)?.[0] ?? "", /select\s+\*|owner_id|contact_person|contact_title|\bemail\b|\bphone\b|street_address|postal_code|review_notes|reviewed_by|reviewed_at|verification_status/);
  assert.doesNotMatch(migration, /security definer/i);
});

test("0028 establishes authenticated SELECT as the only browser relation privilege", () => {
  assert.match(grantsMigration, /revoke all privileges\s+on table public\.buyer_manufacturer_directory\s+from public/is);
  assert.match(grantsMigration, /revoke all privileges\s+on table public\.buyer_manufacturer_directory\s+from anon/is);
  assert.match(grantsMigration, /revoke all privileges\s+on table public\.buyer_manufacturer_directory\s+from authenticated/is);
  assert.match(grantsMigration, /grant select\s+on table public\.buyer_manufacturer_directory\s+to authenticated/is);
  assert.doesNotMatch(grantsMigration, /grant\s+(?:insert|update|delete|truncate|references|trigger|all)|security definer|create\s+(?:or replace\s+)?view/i);
});

test("browser service cannot query profiles, raw manufacturers, or service role", () => {
  assert.doesNotMatch(service, /\.from\(["'](?:profiles|manufacturers)["']\)|service[_-]?role|select\(["']\*["']\)/i);
  assert.match(service, /\.from\("buyer_manufacturer_directory"\)/);
  assert.match(service, /\.from\("marketplace_products"\)/);
  assert.doesNotMatch(service, /email|phone|owner_id|review_notes|street_address/);
});
