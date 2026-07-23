import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import {
  assertLiveRecordId,
  availableQuoteActions,
  availableRfqActions,
  buildQuoteComparison,
  canTransitionQuote,
  canTransitionRfq,
  isTerminalQuoteStatus,
  isTerminalRFQStatus,
  userCanViewQuote,
  userCanViewRfq,
} from "./rfqQuoteWorkflow";
import type { RFQQuoteStatus, RFQQuoteWithItems, RFQStatus } from "../types";

const quote = {
  id: "11111111-1111-4111-8111-111111111111",
  rfq_id: "22222222-2222-4222-8222-222222222222",
  manufacturer_id: "33333333-3333-4333-8333-333333333333",
  version: 1,
  status: "submitted",
  currency: "USD",
  unit_price: null,
  quantity: null,
  subtotal: 100,
  incoterm: "FOB",
  origin_port: null,
  destination_port: null,
  production_lead_days: 30,
  shipping_lead_days: null,
  valid_until: "2027-01-01",
  manufacturer_note: null,
  created_by: "44444444-4444-4444-8444-444444444444",
  submitted_at: "2026-07-22T10:00:00Z",
  created_at: "2026-07-22T09:00:00Z",
  updated_at: "2026-07-22T10:00:00Z",
  items: [],
} satisfies RFQQuoteWithItems;

describe("RFQ and quote workflow authority helpers", () => {
  it("allows every role transition supported by the approved participant surfaces", () => {
    assert.equal(canTransitionRfq("buyer", "draft", "submitted"), true);
    assert.equal(canTransitionRfq("buyer", "submitted", "cancelled"), true);
    assert.equal(canTransitionRfq("buyer", "quoted", "buyer_review"), true);
    assert.equal(canTransitionRfq("buyer", "buyer_review", "accepted"), true);
    assert.equal(canTransitionRfq("buyer", "buyer_review", "declined"), true);
    assert.equal(canTransitionRfq("buyer", "buyer_review", "revision_requested"), true);
    assert.equal(canTransitionRfq("manufacturer", "submitted", "manufacturer_review"), true);
    assert.equal(canTransitionRfq("manufacturer", "manufacturer_review", "quoted"), true);
    assert.equal(canTransitionRfq("manufacturer", "revision_requested", "quoted"), true);
    assert.equal(canTransitionQuote("manufacturer", "draft", "submitted"), true);
    assert.equal(canTransitionQuote("buyer", "submitted", "accepted"), true);
    assert.equal(canTransitionQuote("buyer", "submitted", "rejected"), true);
    assert.equal(canTransitionQuote("buyer", "submitted", "revision_requested"), true);
  });

  it("rejects every unsupported participant transition", () => {
    const rfqStatuses: RFQStatus[] = ["draft", "submitted", "manufacturer_review", "quoted", "buyer_review", "revision_requested", "accepted", "declined", "expired", "cancelled"];
    const allowed = new Set([
      "buyer:draft:submitted", "buyer:draft:cancelled", "buyer:submitted:cancelled",
      "buyer:quoted:buyer_review", "buyer:quoted:accepted", "buyer:quoted:declined", "buyer:quoted:revision_requested",
      "buyer:buyer_review:accepted", "buyer:buyer_review:declined", "buyer:buyer_review:revision_requested",
      "manufacturer:submitted:manufacturer_review", "manufacturer:manufacturer_review:quoted", "manufacturer:revision_requested:quoted",
    ]);
    for (const role of ["buyer", "manufacturer", "admin"] as const) {
      for (const from of rfqStatuses) {
        for (const to of rfqStatuses) {
          assert.equal(canTransitionRfq(role, from, to), allowed.has(`${role}:${from}:${to}`));
        }
      }
    }

    const quoteStatuses: RFQQuoteStatus[] = ["draft", "submitted", "superseded", "accepted", "rejected", "revision_requested", "expired", "withdrawn"];
    const quoteAllowed = new Set([
      "manufacturer:draft:submitted", "buyer:submitted:accepted", "buyer:submitted:rejected", "buyer:submitted:revision_requested",
    ]);
    for (const role of ["buyer", "manufacturer", "admin"] as const) {
      for (const from of quoteStatuses) {
        for (const to of quoteStatuses) {
          assert.equal(canTransitionQuote(role, from, to), quoteAllowed.has(`${role}:${from}:${to}`));
        }
      }
    }
  });

  it("marks terminal records and exposes only contextual actions", () => {
    assert.equal(isTerminalRFQStatus("accepted"), true);
    assert.equal(isTerminalRFQStatus("revision_requested"), false);
    assert.equal(isTerminalQuoteStatus("withdrawn"), true);
    assert.equal(isTerminalQuoteStatus("revision_requested"), false);
    assert.deepEqual(availableRfqActions("buyer", "draft"), ["edit", "submit", "cancel", "delete"]);
    assert.deepEqual(availableRfqActions("admin", "submitted"), []);
    assert.deepEqual(availableQuoteActions("manufacturer", "revision_requested", "revision_requested"), ["create_revision"]);
    assert.deepEqual(availableQuoteActions("buyer", "accepted", "accepted"), []);
  });

  it("keeps participant visibility tied to parent ownership and quote status", () => {
    const rfq = { buyer_id: "buyer-1", manufacturer_id: "manufacturer-1" };
    assert.equal(userCanViewRfq("buyer", "buyer-1", rfq), true);
    assert.equal(userCanViewRfq("buyer", "buyer-2", rfq), false);
    assert.equal(userCanViewRfq("manufacturer", "owner-1", rfq, ["manufacturer-1"]), true);
    assert.equal(userCanViewRfq("manufacturer", "owner-2", rfq, ["manufacturer-2"]), false);
    assert.equal(userCanViewQuote("buyer", quote, true), true);
    assert.equal(userCanViewQuote("buyer", { ...quote, status: "draft" }, true), false);
    assert.equal(userCanViewQuote("buyer", quote, false), false);
    assert.equal(userCanViewQuote("manufacturer", quote, true, [quote.manufacturer_id]), true);
    assert.equal(userCanViewQuote("manufacturer", quote, true, ["other"]), false);
  });

  it("blocks demo and malformed identifiers before live service calls", () => {
    assert.doesNotThrow(() => assertLiveRecordId(quote.id, "Quote"));
    assert.throws(() => assertLiveRecordId("demo-quote-1", "Quote"), /not a valid live record identifier/);
    assert.throws(() => assertLiveRecordId("product-1", "Product"), /not a valid live record identifier/);
  });
});

describe("quote comparison", () => {
  it("hides drafts, keeps version order, and warns without converting or scoring", () => {
    const model = buildQuoteComparison([
      quote,
      { ...quote, id: "55555555-5555-4555-8555-555555555555", version: 2, status: "superseded", currency: "CAD", incoterm: null, items: [{ id: "item-1", quote_id: quote.id, line_order: 1, item_type: "freight", description: "Freight", quantity: 1, unit: "lot", unit_price: 25, amount: 25, created_at: quote.created_at, updated_at: quote.updated_at }] },
      { ...quote, id: "66666666-6666-4666-8666-666666666666", version: 3, status: "draft" },
    ]);
    assert.deepEqual(model.quotes.map((item) => item.version), [2, 1]);
    assert.equal(model.warnings.some((warning) => warning.includes("without exchange-rate conversion")), true);
    assert.equal(model.warnings.some((warning) => warning.includes("Incoterms differ")), true);
    assert.equal(model.warnings.some((warning) => warning.includes("Freight line-item scope differs")), true);
  });

  it("refuses to combine different RFQs or manufacturers", () => {
    const model = buildQuoteComparison([quote, { ...quote, id: "other", rfq_id: "other-rfq" }]);
    assert.deepEqual(model.quotes, []);
    assert.match(model.warnings[0], /different RFQs or manufacturers/);
  });
});

describe("RFQ service participant boundary", () => {
  it("derives profile ownership from Auth and keeps participant selects away from profile fields", () => {
    const source = readFileSync(new URL("./rfq.ts", import.meta.url), "utf8");
    assert.match(source, /export async function fetchBuyerRFQs\(\)/);
    assert.match(source, /export async function fetchManufacturerRFQs\(\)/);
    assert.match(source, /client\.auth\.getUser\(\)/);
    assert.match(source, /participantRFQDetailSelect = "\*, product:products/);
    assert.match(source, /\.neq\("status", "draft"\)/);
    assert.match(source, /\.filter\(\(rfq\) => isRFQVisibleToManufacturer\(rfq\.status\)\)/);
    assert.doesNotMatch(source.match(/const participantRFQDetailSelect[^;]+;/)?.[0] ?? "", /profiles|manufacturers/);
    assert.doesNotMatch(source, /console\.(?:log|error|warn)/);
  });

  it("uses trusted RFQ and Message RPCs without caller-supplied identity", () => {
    const source = readFileSync(new URL("./rfq.ts", import.meta.url), "utf8");
    for (const rpc of [
      "create_rfq_draft",
      "update_rfq_draft",
      "submit_rfq",
      "cancel_rfq",
      "delete_rfq_draft",
      "send_rfq_message",
    ]) {
      assert.match(source, new RegExp(`\\.rpc\\(\"${rpc}\"`));
    }
    assert.doesNotMatch(source, /from\(\"rfq_messages\"\)\s*\.insert/);
    assert.doesNotMatch(source, /from\(\"rfqs\"\)\s*\.(?:insert|update|delete)/);
    const messageFunction = source.match(/export async function postRFQMessage[\s\S]+?\n}/)?.[0] ?? "";
    assert.doesNotMatch(messageFunction, /sender_profile_id|sender_role|buyer_id|manufacturer_id/);
  });
});
