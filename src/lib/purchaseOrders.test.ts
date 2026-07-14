import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canCreatePurchaseOrderForQuote,
  emptyPurchaseOrderDraftValues,
  isPurchaseOrderReadOnly,
  purchaseOrderConfirmationText,
  purchaseOrderStatusLabels,
  purchaseOrderSubtotalLabel,
  sortPurchaseOrderItems,
  validatePurchaseOrderDraft,
} from "./purchaseOrders";
import type { PurchaseOrderRecord, RFQQuoteWithItems } from "../types";

const quote = {
  id: "quote-1",
  rfq_id: "rfq-1",
  manufacturer_id: "manufacturer-1",
  version: 2,
  status: "accepted",
  currency: "USD",
  unit_price: null,
  quantity: null,
  subtotal: 125000,
  incoterm: "FOB",
  origin_port: "Shanghai",
  destination_port: "Los Angeles",
  production_lead_days: 45,
  shipping_lead_days: 21,
  valid_until: null,
  manufacturer_note: null,
  created_by: "manufacturer-owner",
  submitted_at: "2026-07-14T12:00:00Z",
  created_at: "2026-07-14T11:00:00Z",
  updated_at: "2026-07-14T12:00:00Z",
  items: [],
} satisfies RFQQuoteWithItems;

const purchaseOrder = {
  id: "po-1",
  po_number: "PO-2026-000001",
  rfq_id: "rfq-1",
  quote_id: "quote-1",
  quote_decision_id: "decision-1",
  buyer_id: "buyer-1",
  manufacturer_id: "manufacturer-1",
  status: "draft",
  currency: "USD",
  subtotal: 125000,
  incoterm: "FOB",
  origin_port: "Shanghai",
  destination_port: "Los Angeles",
  production_lead_days: 45,
  shipping_lead_days: 21,
  requested_delivery_date: null,
  buyer_reference: null,
  buyer_note: null,
  quote_snapshot: { version: 2 },
  buyer_snapshot: { full_name: "Buyer" },
  manufacturer_snapshot: { company_display_name: "Factory" },
  product_snapshot: { name: "Snapshot Home" },
  created_by: "buyer-1",
  submitted_at: null,
  created_at: "2026-07-14T12:30:00Z",
  updated_at: "2026-07-14T12:30:00Z",
} satisfies PurchaseOrderRecord;

describe("purchase order helpers", () => {
  it("allows Create PO only for accepted Quotes without existing POs", () => {
    assert.equal(canCreatePurchaseOrderForQuote(quote, []), true);
    assert.equal(canCreatePurchaseOrderForQuote(quote, [purchaseOrder]), false);
    assert.equal(canCreatePurchaseOrderForQuote({ ...quote, status: "submitted" }, []), false);
  });

  it("keeps PO status labels and read-only mapping conservative", () => {
    assert.equal(purchaseOrderStatusLabels.draft, "Draft");
    assert.equal(purchaseOrderStatusLabels.submitted, "Submitted");
    assert.equal(purchaseOrderStatusLabels.cancelled, "Cancelled");
    assert.equal(isPurchaseOrderReadOnly({ status: "draft" }), false);
    assert.equal(isPurchaseOrderReadOnly({ status: "submitted" }), true);
    assert.equal(isPurchaseOrderReadOnly({ status: "cancelled" }), true);
  });

  it("validates buyer reference, note, and requested delivery date", () => {
    assert.deepEqual(validatePurchaseOrderDraft(emptyPurchaseOrderDraftValues()), []);
    assert.deepEqual(validatePurchaseOrderDraft({
      buyerReference: "x".repeat(121),
      buyerNote: "ok",
      requestedDeliveryDate: "",
    }), ["Buyer reference must be 120 characters or fewer."]);
    assert.deepEqual(validatePurchaseOrderDraft({
      buyerReference: "ok",
      buyerNote: "x".repeat(2001),
      requestedDeliveryDate: "not-a-date",
    }), [
      "Buyer note must be 2000 characters or fewer.",
      "Requested delivery date must be a valid date.",
    ]);
  });

  it("orders copied line items by line order", () => {
    const [first] = sortPurchaseOrderItems([
      {
        id: "item-2",
        purchase_order_id: "po-1",
        source_quote_item_id: "quote-item-2",
        line_order: 2,
        item_type: "freight",
        description: "Freight",
        quantity: 1,
        unit: "lot",
        unit_price: 5000,
        amount: 5000,
        created_at: "2026-07-14T12:00:00Z",
      },
      {
        id: "item-1",
        purchase_order_id: "po-1",
        source_quote_item_id: "quote-item-1",
        line_order: 1,
        item_type: "product",
        description: "Home",
        quantity: 1,
        unit: "unit",
        unit_price: 120000,
        amount: 120000,
        created_at: "2026-07-14T12:00:00Z",
      },
    ]);
    assert.equal(first.id, "item-1");
  });

  it("renders subtotal and submission confirmation content", () => {
    assert.equal(purchaseOrderSubtotalLabel(purchaseOrder), "$125,000.00");
    assert.equal(
      purchaseOrderConfirmationText(purchaseOrder),
      "Submit PO-2026-000001 for quote version 2 at $125,000.00?"
    );
  });
});
