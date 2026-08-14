import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../../supabase/migrations/0030_harden_buyer_purchase_order_entry.sql", import.meta.url), "utf8");
const service = readFileSync(new URL("../../src/lib/purchaseOrders.ts", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../../src/features/purchase-orders/BuyerPurchaseOrders.tsx", import.meta.url), "utf8");

test("0030 derives active Buyer authority and accepted commercial terms", () => {
  assert.match(migration, /p\.id = auth\.uid\(\)[\s\S]*p\.role = 'buyer'[\s\S]*p\.status = 'active'/);
  assert.match(migration, /rfq_record\.buyer_id is distinct from auth\.uid\(\)/);
  assert.match(migration, /quote_record\.status <> 'accepted'[\s\S]*rfq_record\.status <> 'accepted'/);
  assert.match(migration, /quote_record\.valid_until[\s\S]*current_date/);
  assert.match(migration, /quote_record\.manufacturer_id[\s\S]*verification_status = 'approved'[\s\S]*application_status = 'approved'/);
  assert.doesNotMatch(migration, /buyer_uuid|manufacturer_uuid|status_text/);
});

test("0030 is idempotent under retry and concurrency", () => {
  assert.match(migration, /purchase_orders[\s\S]*where quote_id = quote_record\.id and buyer_id = auth\.uid\(\)[\s\S]*if found then return po_record/);
  assert.match(migration, /when unique_violation then[\s\S]*return po_record/);
  assert.match(migration, /purchase_orders_quote_unique|quote_id = quote_uuid/);
});

test("browser supplies only Quote selector and does not perform per-Order reads", () => {
  assert.match(service, /rpc\("create_purchase_order_from_quote", \{ quote_uuid: quoteId \}\)/);
  assert.doesNotMatch(service, /rpc\("create_purchase_order_from_quote"[\s\S]{0,200}(buyer|manufacturer|status)_/);
  assert.doesNotMatch(workspace, /fetchPurchaseOrderDecisions\(/);
  assert.doesNotMatch(workspace, /orders\.map\(async|Promise\.all\([\s\S]*orders\.map/);
});

test("Buyer Orders UI has canonical routing, safe states, and stale-response containment", () => {
  assert.match(workspace, /workspace=orders&record=/);
  assert.match(workspace, /Unable to load your orders\./);
  assert.match(workspace, /No Orders yet/);
  assert.match(workspace, /No matching Orders/);
  assert.match(workspace, /Clear Filters/);
  assert.match(workspace, /generation\.current/);
  assert.doesNotMatch(workspace, /buyer_snapshot\.email|created_by|actor_profile_id/);
});
