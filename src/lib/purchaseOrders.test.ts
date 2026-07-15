import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canCreatePurchaseOrderForQuote,
  canBuyerRevisePurchaseOrder,
  canManufacturerOpenPurchaseOrder,
  emptyPurchaseOrderDraftValues,
  getManufacturerPurchaseOrderActions,
  isPurchaseOrderReadOnly,
  purchaseOrderCancelledAtLabel,
  purchaseOrderConfirmationText,
  purchaseOrderDecisionLabels,
  purchaseOrderEventLabel,
  purchaseOrderLastSubmittedAtLabel,
  manufacturerPurchaseOrderDecisionConfirmationText,
  purchaseOrderResubmitConfirmationText,
  purchaseOrderReviewRoundLabel,
  purchaseOrderStatusLabels,
  purchaseOrderSubmittedAtLabel,
  purchaseOrderSubtotalLabel,
  sortPurchaseOrderDecisions,
  sortPurchaseOrderItems,
  validatePurchaseOrderDecisionReason,
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
  last_submitted_at: null,
  cancelled_at: null,
  confirmed_at: null,
  rejected_at: null,
  review_round: 0,
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
    assert.equal(purchaseOrderStatusLabels.manufacturer_review, "Manufacturer review");
    assert.equal(purchaseOrderStatusLabels.revision_requested, "Revision requested");
    assert.equal(purchaseOrderStatusLabels.confirmed, "Confirmed");
    assert.equal(purchaseOrderStatusLabels.rejected, "Rejected");
    assert.equal(purchaseOrderStatusLabels.cancelled, "Cancelled");
    assert.equal(isPurchaseOrderReadOnly({ status: "draft" }), false);
    assert.equal(isPurchaseOrderReadOnly({ status: "submitted" }), true);
    assert.equal(isPurchaseOrderReadOnly({ status: "manufacturer_review" }), true);
    assert.equal(isPurchaseOrderReadOnly({ status: "revision_requested" }), false);
    assert.equal(isPurchaseOrderReadOnly({ status: "confirmed" }), true);
    assert.equal(isPurchaseOrderReadOnly({ status: "rejected" }), true);
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

  it("renders submitted timestamps only for submitted purchase orders", () => {
    const submitted = {
      ...purchaseOrder,
      status: "submitted",
      submitted_at: "2026-07-14T13:00:00Z",
      last_submitted_at: "2026-07-14T13:00:00Z",
      cancelled_at: null,
      confirmed_at: null,
      rejected_at: null,
      review_round: 1,
    } satisfies PurchaseOrderRecord;

    assert.match(purchaseOrderSubmittedAtLabel(submitted) ?? "", /^Submitted /);
    assert.equal(purchaseOrderCancelledAtLabel(submitted), null);
  });

  it("renders cancelled timestamps only for cancelled purchase orders", () => {
    const cancelled = {
      ...purchaseOrder,
      status: "cancelled",
      submitted_at: null,
      last_submitted_at: null,
      cancelled_at: "2026-07-14T13:30:00Z",
      confirmed_at: null,
      rejected_at: null,
      review_round: 0,
    } satisfies PurchaseOrderRecord;

    assert.match(purchaseOrderCancelledAtLabel(cancelled) ?? "", /^Cancelled /);
    assert.equal(purchaseOrderSubmittedAtLabel(cancelled), null);
  });

  it("never renders cancelled purchase orders as submitted", () => {
    const cancelledWithLegacySubmittedAt = {
      ...purchaseOrder,
      status: "cancelled",
      submitted_at: "2026-07-14T13:00:00Z",
      last_submitted_at: null,
      cancelled_at: "2026-07-14T13:30:00Z",
      confirmed_at: null,
      rejected_at: null,
      review_round: 0,
    } satisfies PurchaseOrderRecord;

    assert.equal(purchaseOrderSubmittedAtLabel(cancelledWithLegacySubmittedAt), null);
    assert.match(purchaseOrderCancelledAtLabel(cancelledWithLegacySubmittedAt) ?? "", /^Cancelled /);
  });

  it("renders neither lifecycle timestamp for draft purchase orders", () => {
    assert.equal(purchaseOrderSubmittedAtLabel(purchaseOrder), null);
    assert.equal(purchaseOrderCancelledAtLabel(purchaseOrder), null);
  });

  it("shows Open for Review only for submitted purchase orders", () => {
    assert.equal(canManufacturerOpenPurchaseOrder({ status: "submitted" }), true);
    assert.equal(canManufacturerOpenPurchaseOrder({ status: "manufacturer_review" }), false);
    assert.equal(canManufacturerOpenPurchaseOrder({ status: "confirmed" }), false);
  });

  it("shows decision controls only during manufacturer review", () => {
    assert.deepEqual(getManufacturerPurchaseOrderActions({ status: "manufacturer_review" }), [
      "confirmed",
      "rejected",
      "revision_requested",
    ]);
    assert.deepEqual(getManufacturerPurchaseOrderActions({ status: "submitted" }), []);
    assert.deepEqual(getManufacturerPurchaseOrderActions({ status: "revision_requested" }), []);
  });

  it("validates reject and revision reasons while allowing optional confirmation note", () => {
    assert.deepEqual(validatePurchaseOrderDecisionReason("confirmed", ""), []);
    assert.deepEqual(validatePurchaseOrderDecisionReason("rejected", ""), ["A reason is required."]);
    assert.deepEqual(validatePurchaseOrderDecisionReason("revision_requested", ""), ["A reason is required."]);
    assert.deepEqual(validatePurchaseOrderDecisionReason("confirmed", "x".repeat(4001)), [
      "Reason must be 4000 characters or fewer.",
    ]);
  });

  it("labels decisions and review rounds", () => {
    assert.equal(purchaseOrderDecisionLabels.confirmed, "Confirmed");
    assert.equal(purchaseOrderDecisionLabels.rejected, "Rejected");
    assert.equal(purchaseOrderDecisionLabels.revision_requested, "Revision requested");
    assert.equal(purchaseOrderReviewRoundLabel({ review_round: 2 }), "Review round 2");
  });

  it("builds manufacturer confirm dialog content", () => {
    assert.equal(
      manufacturerPurchaseOrderDecisionConfirmationText({ ...purchaseOrder, review_round: 1 }, "confirmed"),
      "Confirmed PO-2026-000001 for review round 1?"
    );
  });

  it("shows buyer revision form only for revision-requested purchase orders", () => {
    assert.equal(canBuyerRevisePurchaseOrder({ status: "revision_requested" }), true);
    assert.equal(canBuyerRevisePurchaseOrder({ status: "manufacturer_review" }), false);
    assert.equal(canBuyerRevisePurchaseOrder({ status: "confirmed" }), false);
  });

  it("builds Buyer resubmit confirmation with unchanged commercial terms", () => {
    assert.equal(
      purchaseOrderResubmitConfirmationText({ ...purchaseOrder, review_round: 1 }),
      "Resubmit PO-2026-000001 for review round 2 with unchanged commercial terms at $125,000.00?"
    );
  });

  it("renders last-submitted timestamp for review lifecycle states", () => {
    const reviewPO = {
      ...purchaseOrder,
      status: "manufacturer_review",
      submitted_at: "2026-07-14T13:00:00Z",
      last_submitted_at: "2026-07-14T14:00:00Z",
      review_round: 2,
    } satisfies PurchaseOrderRecord;

    assert.match(purchaseOrderLastSubmittedAtLabel(reviewPO) ?? "", /^Last submitted /);
  });

  it("orders decision history by review round and timestamp", () => {
    const ordered = sortPurchaseOrderDecisions([
      {
        id: "decision-2",
        purchase_order_id: "po-1",
        review_round: 2,
        manufacturer_id: "manufacturer-1",
        actor_profile_id: "manufacturer-owner",
        decision: "confirmed",
        reason: null,
        created_at: "2026-07-14T15:00:00Z",
      },
      {
        id: "decision-1",
        purchase_order_id: "po-1",
        review_round: 1,
        manufacturer_id: "manufacturer-1",
        actor_profile_id: "manufacturer-owner",
        decision: "revision_requested",
        reason: "Update delivery date",
        created_at: "2026-07-14T14:00:00Z",
      },
    ]);

    assert.deepEqual(ordered.map((decision) => decision.id), ["decision-1", "decision-2"]);
  });

  it("maps Admin timeline event labels", () => {
    assert.equal(
      purchaseOrderEventLabel({
        id: "event-1",
        purchase_order_id: "po-1",
        event_type: "po_resubmitted",
        actor_profile_id: "buyer-1",
        metadata: { review_round: 2 },
        created_at: "2026-07-14T15:00:00Z",
      }),
      "PO resubmitted"
    );
  });

  it("keeps contract and payment controls out of PH-007B helper labels", () => {
    const labels = [
      purchaseOrderDecisionLabels.confirmed,
      purchaseOrderDecisionLabels.rejected,
      purchaseOrderDecisionLabels.revision_requested,
      purchaseOrderResubmitConfirmationText(purchaseOrder),
    ].join(" ");

    assert.equal(/contract|payment|invoice|signature/i.test(labels), false);
  });
});
