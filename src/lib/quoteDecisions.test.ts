import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canManufacturerCreateRevision,
  getBuyerDecisionActions,
  getCurrentQuoteDecision,
  getCurrentSubmittedQuote,
  getDecisionForQuote,
  getLatestQuoteDecision,
  quoteDecisionLabels,
  sortQuoteDecisions,
  toReadableDecisionError,
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

function decisionFor(
  quoteId: string,
  decision: RFQQuoteDecisionRecord["decision"],
  createdAt: string,
  reason: string | null = null
): RFQQuoteDecisionRecord {
  return {
    id: `decision-${quoteId}-${decision}`,
    rfq_id: "rfq-1",
    quote_id: quoteId,
    buyer_id: "buyer-1",
    decision,
    reason,
    created_at: createdAt,
  };
}

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

  it("keeps accepted visible after the submitted quote disappears", () => {
    const acceptedQuote = { ...baseQuote, status: "accepted" } satisfies RFQQuoteWithItems;
    const acceptedDecision = decisionFor("quote-1", "accepted", "2026-07-14T11:00:00Z");
    const latest = getLatestQuoteDecision([acceptedQuote], [acceptedDecision]);

    assert.equal(latest?.quote.version, 1);
    assert.equal(latest?.decision.decision, "accepted");
    assert.deepEqual(getBuyerDecisionActions(acceptedQuote, [acceptedQuote], [acceptedDecision]), []);
  });

  it("keeps rejected visible after the submitted quote disappears", () => {
    const rejectedQuote = { ...baseQuote, status: "rejected" } satisfies RFQQuoteWithItems;
    const rejectedDecision = decisionFor("quote-1", "rejected", "2026-07-14T11:00:00Z", "Too high.");
    const latest = getLatestQuoteDecision([rejectedQuote], [rejectedDecision]);

    assert.equal(latest?.decision.decision, "rejected");
    assert.equal(latest?.decision.reason, "Too high.");
    assert.deepEqual(getBuyerDecisionActions(rejectedQuote, [rejectedQuote], [rejectedDecision]), []);
  });

  it("keeps revision requested and reason visible after submitted disappears", () => {
    const requestedQuote = { ...baseQuote, status: "revision_requested" } satisfies RFQQuoteWithItems;
    const latest = getLatestQuoteDecision([requestedQuote], [revisionDecision]);

    assert.equal(latest?.decision.decision, "revision_requested");
    assert.equal(latest?.decision.reason, "Please adjust the shipping lead time.");
    assert.deepEqual(getBuyerDecisionActions(requestedQuote, [requestedQuote], [revisionDecision]), []);
  });

  it("uses the newest quote decision over older history", () => {
    const oldQuote = { ...baseQuote, id: "quote-1", version: 1, status: "revision_requested" } satisfies RFQQuoteWithItems;
    const newQuote = { ...baseQuote, id: "quote-2", version: 2, status: "accepted" } satisfies RFQQuoteWithItems;
    const oldDecision = decisionFor("quote-1", "revision_requested", "2026-07-14T11:00:00Z", "Revise.");
    const newDecision = decisionFor("quote-2", "accepted", "2026-07-14T12:00:00Z");

    const latest = getLatestQuoteDecision([oldQuote, newQuote], [newDecision, oldDecision]);

    assert.equal(latest?.quote.id, "quote-2");
    assert.equal(latest?.decision.decision, "accepted");
  });

  it("does not let old decisions hide actions for a newer current submitted quote", () => {
    const oldQuote = { ...baseQuote, id: "quote-1", version: 1, status: "revision_requested" } satisfies RFQQuoteWithItems;
    const newQuote = { ...baseQuote, id: "quote-2", version: 2, status: "submitted" } satisfies RFQQuoteWithItems;
    const oldDecision = decisionFor("quote-1", "revision_requested", "2026-07-14T11:00:00Z", "Revise.");

    assert.deepEqual(getBuyerDecisionActions(newQuote, [oldQuote, newQuote], [oldDecision]), [
      "accepted",
      "rejected",
      "revision_requested",
    ]);
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

  it("sanitizes unknown decision failures while preserving expected authorization feedback", () => {
    assert.equal(toReadableDecisionError({ message: "private SQL function detail" }).message, "Unable to review quote. Refresh and try again.");
    assert.equal(toReadableDecisionError({ message: "permission denied" }).message, "You are not authorized to review this quote.");
  });
});
