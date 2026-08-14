import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../../supabase/migrations/0029_require_active_buyer_for_rfq_drafts.sql", import.meta.url), "utf8");
const service = readFileSync(new URL("../../src/lib/rfq.ts", import.meta.url), "utf8");

test("0029 narrows RFQ draft entry to an active authenticated Buyer", () => {
  assert.match(migration, /p\.id = auth\.uid\(\)/);
  assert.match(migration, /p\.role = 'buyer'/);
  assert.match(migration, /p\.status = 'active'/);
  assert.match(migration, /p\.status = 'published'/);
  assert.match(migration, /m\.application_status = 'approved'/);
  assert.match(migration, /select p\.manufacturer_id into manufacturer_uuid/);
  assert.match(migration, /auth\.uid\(\), manufacturer_uuid, product_uuid, snapshot_value, 'draft'/);
});

test("0029 preserves hardened ownership, search path, and execute grants", () => {
  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = public, pg_temp/);
  assert.match(migration, /owner to postgres/);
  assert.match(migration, /revoke all[\s\S]*from public, anon, authenticated, service_role/);
  assert.match(migration, /grant execute[\s\S]*to authenticated/);
});

test("browser RFQ creation supplies no Buyer, Manufacturer, owner, or status authority", () => {
  const create = service.match(/export async function createDraftRFQ[\s\S]+?\n}/)?.[0] ?? "";
  assert.match(create, /rpc\("create_rfq_draft"/);
  assert.match(create, /product_uuid: product\.id/);
  assert.doesNotMatch(create, /buyer_id|manufacturer_id|owner_id|status/);
  assert.doesNotMatch(service, /\.from\("rfqs"\)\s*\.insert/);
});
