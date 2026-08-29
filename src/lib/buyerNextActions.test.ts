import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buyerContractNextAction, buyerInvoiceNextAction, buyerPurchaseOrderNextAction, buyerQuoteNextAction, buyerRFQNextAction, buyerShippingNextAction } from "./buyerNextActions";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

test("Buyer journey guidance covers representative actionable and waiting states", () => {
  const cases = [
    buyerRFQNextAction("draft", id), buyerRFQNextAction("submitted", id),
    buyerQuoteNextAction("submitted", id), buyerQuoteNextAction("accepted", id),
    buyerPurchaseOrderNextAction("draft", id), buyerPurchaseOrderNextAction("manufacturer_review", id), buyerPurchaseOrderNextAction("confirmed", id),
    buyerContractNextAction("revision_requested", id), buyerContractNextAction("participant_review", id),
    buyerInvoiceNextAction("issued", id), buyerShippingNextAction("ready_for_logistics", id),
  ];
  for (const action of cases) {
    assert.ok(action?.label);
    assert.ok(action?.description);
    assert.match(action?.href ?? "", /^\/marketplace\?view=dashboard&workspace=/);
  }
  assert.equal(cases[0]?.actionNeeded, true);
  assert.equal(cases[1]?.actionNeeded, false);
  assert.match(cases[2]?.href ?? "", /workspace=rfqs&record=/);
  assert.match(cases[3]?.href ?? "", /workspace=orders$/);
  assert.match(cases[6]?.href ?? "", /workspace=contracts$/);
  assert.match(cases[9]?.description ?? "", /does not process or verify payment/);
  assert.match(cases[10]?.description ?? "", /No carrier booking or customs clearance/);
});

test("terminal states do not advertise false next actions or broken related record links", () => {
  assert.equal(buyerRFQNextAction("cancelled", id), null);
  assert.equal(buyerQuoteNextAction("rejected", id), null);
  assert.equal(buyerPurchaseOrderNextAction("rejected", id), null);
  assert.equal(buyerContractNextAction("rejected", id), null);
  assert.equal(buyerInvoiceNextAction("cancelled", id), null);
  assert.equal(buyerShippingNextAction("cancelled", id), null);
  assert.equal(buyerPurchaseOrderNextAction("confirmed", id)?.href.includes("record="), false);
});

test("next-action model is presentation-only and never determines mutation eligibility", () => {
  const source = readFileSync("src/lib/buyerNextActions.ts", "utf8");
  assert.doesNotMatch(source, /supabase|\.rpc\(|\.from\(|canTransition|available.*Actions|\b(?:persist|update|create|submit)[A-Z]\w*\s*\(/i);
});
