import assert from "node:assert/strict";
import test from "node:test";
import { selectBuyerOrders } from "./purchaseOrders";
import type { PurchaseOrderWithItems } from "../types";

function order(id: string, overrides: Partial<PurchaseOrderWithItems> = {}): PurchaseOrderWithItems {
  return {
    id, po_number: `PO-${id}`, rfq_id: `rfq-${id}`, quote_id: `quote-${id}`,
    quote_decision_id: `decision-${id}`, buyer_id: "buyer", manufacturer_id: "manufacturer",
    status: "draft", currency: "USD", subtotal: 100, incoterm: "FOB", origin_port: null,
    destination_port: null, production_lead_days: null, shipping_lead_days: null,
    requested_delivery_date: null, buyer_reference: null, buyer_note: null,
    quote_snapshot: {}, buyer_snapshot: {}, manufacturer_snapshot: { company_display_name: "Safe Factory" },
    product_snapshot: { model_name: "Model One" }, created_by: "buyer", submitted_at: null,
    last_submitted_at: null, cancelled_at: null, confirmed_at: null, rejected_at: null,
    review_round: 0, created_at: `2026-01-0${id}T00:00:00Z`, updated_at: `2026-02-0${id}T00:00:00Z`,
    items: [], ...overrides,
  };
}

test("Buyer Order selection searches only safe display fields", () => {
  const rows = [order("1"), order("2", { manufacturer_snapshot: { company_display_name: "Second Works" } })];
  assert.deepEqual(selectBuyerOrders(rows, " second ", "all", "updated").map((row) => row.id), ["2"]);
  assert.deepEqual(selectBuyerOrders(rows, "model one", "all", "updated").map((row) => row.id), ["2", "1"]);
});

test("Buyer Order filters and stable sorts are deterministic and non-mutating", () => {
  const rows = [order("1", { updated_at: "invalid" }), order("2", { status: "confirmed" })];
  const original = [...rows];
  assert.deepEqual(selectBuyerOrders(rows, "", "confirmed", "updated").map((row) => row.id), ["2"]);
  assert.deepEqual(selectBuyerOrders(rows, "", "all", "created").map((row) => row.id), ["2", "1"]);
  assert.deepEqual(selectBuyerOrders(rows, "", "all", "status").map((row) => row.id), ["2", "1"]);
  assert.deepEqual(rows, original);
});
