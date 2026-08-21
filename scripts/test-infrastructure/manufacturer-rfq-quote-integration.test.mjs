import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/0025_restore_rfq_quote_authority.sql", "utf8");
const rfqService = readFileSync("src/lib/rfq.ts", "utf8");
const quoteService = readFileSync("src/lib/quotes.ts", "utf8");
const inbox = readFileSync("src/features/rfqs/ManufacturerRFQInbox.tsx", "utf8");
const builder = readFileSync("src/features/quotes/QuoteBuilder.tsx", "utf8");

test("Sprint 5C.3 adds no migration and preserves migration 0025 authority and lineage enforcement", () => {
  const migrations = readdirSync("supabase/migrations").filter((file) => /^\d{4}_.+\.sql$/.test(file)).sort();
  assert.equal(migrations.length, 32);
  assert.match(migration, /create or replace function public\.create_rfq_quote_revision\(quote_uuid uuid\)/);
  assert.match(migration, /source_quote\.rfq_id is distinct from quote_record\.rfq_id/);
  assert.match(migration, /perform public\.assert_rfq_quote_lineage\(quote_record\.id, quote_record\.rfq_id, source_quote\.id\)/);
  assert.match(migration, /grant execute on function public\.create_rfq_quote_revision\(uuid\) to authenticated/);
});

test("Manufacturer RFQ and Quote services retain backend-derived authority", () => {
  const manufacturerFetch = rfqService.match(/export async function fetchManufacturerRFQs\(\)[\s\S]*?\n}/)?.[0] ?? "";
  assert.match(manufacturerFetch, /authenticatedProfileId\(\)/);
  assert.match(manufacturerFetch, /\.eq\("owner_id", ownerId\)/);
  assert.match(manufacturerFetch, /\.neq\("status", "draft"\)/);
  assert.doesNotMatch(manufacturerFetch, /buyer:profiles|\.select\([^)]*email/);
  for (const rpc of ["create_rfq_quote_draft", "create_rfq_quote_revision", "submit_rfq_quote"]) assert.match(quoteService, new RegExp(`\\.rpc\\("${rpc}"`));
  assert.doesNotMatch(quoteService, /manufacturer_id\s*:/);
});

test("Manufacturer portal reuses the established workflow and gates editing by parent RFQ state", () => {
  assert.match(inbox, /<RFQConversation/);
  assert.match(inbox, /<RFQActivityTimeline/);
  assert.match(inbox, /<QuoteBuilder/);
  assert.match(builder, /isQuoteEditableByManufacturer\(activeQuote, rfq\.status\)/);
  assert.match(builder, /canManufacturerCreateRevision\(activeQuote, rfq\.status, decisions\)/);
  assert.doesNotMatch(inbox, /buyer\.full_name|buyer\.email/);
});
