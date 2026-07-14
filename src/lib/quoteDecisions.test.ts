import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canManufacturerCreateRevision,
  getBuyerDecisionActions,
  getCurrentQuoteDecision,
  getCurrentSubmittedQuote,
  getDecisionForQuote,
  quoteDecisionLabels,
  sortQuoteDecisions,
  validateDecisionReason,
} from "./quoteDecisions";
import type { RFQQuoteDecisionRecord, RFQQuoteWithItems } from "../types";

const baseQuote = {
  id: "quote-1",
  rfq_id: "rfq-1",
  manufacturer_id: "manufacturer-1",
  version: 1,
  status: "submitted",
  currency: "USD",
  unit_price: null,
  quantity: null,
  subtotal: 250000,
  incoterm: "FOB",
  origin_port: "Shanghai",
  destination_port: "Vancouver",
  production_lead_days: 45,
  shipping_lead_days: 21,
  valid_until: "2026-08-31",
  manufacturer_note: "Includes ocean freight.",
  created_by: "manufacturer-owner-1",
  submitted_at: "2026-07-14T10:00:00Z",
  created_at: "2026-07-14T09:00:00Z",
  updated_at: "2026-07-14T10:00:00Z",
  items: [
    {
      id: "item-1",
      quote_id: "quote-1",
      line_order: 1,
      item_type: "product",
      description: "Base home",
      quantity: 1,
      unit: "unit",
      unit_price: 250000,
      amount: 250000,
      created_at: "2026-07-14T09:00:00Z",
      updated_at: "2026-07-14T09:00:00Z",
    },
  ],
} satisfies RFQQuoteWithItems;

const revisionDecision = {
  id: "decision-1",
  rfq_id: "rfq-1",
  quote_id: "quote-1",
  buyer_id: "buyer-1",
  decision: "revision_requested",
  reason: "Please adjust the shipping lead time.",
  created_at: "2026-07-14T11:00:00Z",
} satisfies RFQQuoteDecisionRecord;

describe("quote decision helpers", () => {
  it("shows buyer decision buttons only for the current submitted quote", () => {
    const quotes = [
      { ...baseQuote, id: "quote-2", version: 2, status: "superseded" },
      baseQuote,
    ] satisfies RFQQuoteWithItems[];

    assert.deepEqual(getBuyerDecisionActions(baseQuote, quotes, []), [
      "accepted",
      "rejected",
      "revision_requested",
    ]);
    assert.deepEqual(getBuyerDecisionActions(quotes[0], quotes, []), []);
    assert.equal(getCurrentSubmittedQuote(quotes)?.id, "quote-1");
  });

  it("hides old version actions after an immutable decision exists", () => {
    assert.deepEqual(getBuyerDecisionActions(baseQuote, [baseQuote], [revisionDecision]), []);
    assert.equal(getCurrentQuoteDecision([baseQuote], [revisionDecision])?.decision, "revision_requested");
    assert.equal(getDecisionForQuote("quote-1", [revisionDecision])?.reason, revisionDecision.reason);
  });

  it("validates decision form reasons and labels decisions", () => {
    assert.deepEqual(validateDecisionReason("accepted", ""), []);
    assert.deepEqual(validateDecisionReason("rejected", "x".repeat(4001)), [
      "Decision reason must be 4000 characters or fewer.",
    ]);
    assert.deepEqual(validateDecisionReason("revision_requested", "   "), [
      "Revision requests require a reason.",
    ]);
    assert.equal(quoteDecisionLabels.accepted, "Accepted");
    assert.equal(quoteDecisionLabels.rejected, "Rejected");
    assert.equal(quoteDecisionLabels.revision_requested, "Revision requested");
  });

  it("shows manufacturer create revision only after buyer revision request", () => {
    const requestedQuote = { ...baseQuote, status: "revision_requested" } satisfies RFQQuoteWithItems;

    assert.equal(
      canManufacturerCreateRevision(requestedQuote, "revision_requested", [revisionDecision]),
      true
    );
    assert.equal(canManufacturerCreateRevision(baseQuote, "quoted", []), false);
    assert.equal(canManufacturerCreateRevision(requestedQuote, "quoted", [revisionDecision]), false);
  });

  it("orders admin negotiation history chronologically", () => {
    assert.deepEqual(
      sortQuoteDecisions([
        { ...revisionDecision, id: "decision-2", created_at: "2026-07-14T12:00:00Z" },
        revisionDecision,
      ]).map((decision) => decision.id),
      ["decision-1", "decision-2"]
    );
  });
});
