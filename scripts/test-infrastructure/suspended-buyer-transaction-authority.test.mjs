import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/0035_harden_suspended_buyer_transaction_authority.sql", "utf8");
const databaseTest = readFileSync("supabase/tests/suspended_buyer_transaction_authority_security.sql", "utf8");

function functionBody(name) {
  return migration.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]+?\\n\\$\\$;`, "i"))?.[0] ?? "";
}

test("0035 is the only migration after the merged 0034 baseline", () => {
  const migrations = readdirSync("supabase/migrations").filter((file) => /^\d{4}_.+\.sql$/.test(file)).sort();
  assert.equal(migrations.length, 35);
  assert.equal(migrations.at(-1), "0035_harden_suspended_buyer_transaction_authority.sql");
});

test("participant access helpers require active Buyer authority without weakening other participants", () => {
  for (const name of [
    "can_access_rfq", "can_access_rfq_quote", "can_access_purchase_order", "can_access_contract",
    "can_access_signature_package", "can_access_signature_delivery_request", "can_access_invoice",
    "can_access_payment_record", "can_access_shipping_readiness", "can_access_logistics_booking_request",
  ]) {
    const body = functionBody(name);
    assert.match(body, /auth\.uid\(\)[\s\S]+public\.is_active_buyer\(\)/, `${name} lacks active Buyer enforcement`);
    assert.match(body, /public\.is_admin\(\)/, `${name} lost Admin read authority`);
    assert.match(body, /public\.owns_manufacturer\(/, `${name} lost Manufacturer participant authority`);
  }
});

test("trusted write boundaries reject inactive stored Buyer identities", () => {
  for (const name of [
    "is_trusted_purchase_order_write", "is_trusted_contract_write",
    "is_trusted_signature_preparation_write", "is_trusted_signature_delivery_write",
  ]) {
    const body = functionBody(name);
    assert.match(body, /p\.role = 'buyer'/);
    assert.match(body, /public\.is_active_buyer\(\)/);
  }
  assert.doesNotMatch(migration, /grant\s+(insert|update|delete)\s+on/i);
});

test("security-definer invoice payment summary requires active Buyer authority", () => {
  const body = functionBody("get_invoice_payment_summary");
  assert.match(body, /invoice_row\.buyer_id\s*=\s*auth\.uid\(\)\s+and\s+public\.is_active_buyer\(\)/i);
  assert.match(body, /public\.owns_manufacturer\(invoice_row\.manufacturer_id\)/i);
  assert.match(body, /public\.is_admin\(\)/i);
});

test("database regression covers each audited mutation and denied state preservation", () => {
  for (const operation of [
    "update_purchase_order_draft", "submit_purchase_order", "cancel_purchase_order_draft",
    "update_purchase_order_revision", "resubmit_purchase_order", "update_contract_draft",
    "mark_contract_ready", "update_contract_revision", "resubmit_contract",
    "update_buyer_signature_participant", "mark_signature_package_ready",
    "create_signature_delivery_request", "queue_signature_delivery_request", "cancel_signature_delivery_request",
  ]) assert.match(databaseTest, new RegExp(operation));
  assert.match(databaseTest, /admin_set_profile_status\(buyer,'suspended'\)/);
  assert.match(databaseTest, /admin_set_profile_status\(buyer,'active'\)/);
  assert.match(databaseTest, /state changed after denied operation/i);
  assert.match(databaseTest, /rollback;/i);
});
