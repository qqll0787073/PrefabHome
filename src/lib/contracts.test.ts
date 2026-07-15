import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canCreateContractForPurchaseOrder,
  contractCreatedAtLabel,
  contractEventLabel,
  contractReadyAtLabel,
  contractReadyConfirmationText,
  contractStatusLabels,
  contractSubtotalLabel,
  emptyContractDraftValues,
  isContractReadOnly,
  validateContractDraft,
  validateContractReady,
} from "./contracts";
import type { ContractRecord, PurchaseOrderRecord } from "../types";

const confirmedPurchaseOrder = {
  id: "po-1",
  po_number: "PO-2026-000001",
  rfq_id: "rfq-1",
  quote_id: "quote-1",
  quote_decision_id: "decision-1",
  buyer_id: "buyer-1",
  manufacturer_id: "manufacturer-1",
  status: "confirmed",
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
  submitted_at: "2026-07-14T12:00:00Z",
  last_submitted_at: "2026-07-14T12:00:00Z",
  cancelled_at: null,
  confirmed_at: "2026-07-14T14:00:00Z",
  rejected_at: null,
  review_round: 1,
  created_at: "2026-07-14T12:30:00Z",
  updated_at: "2026-07-14T14:00:00Z",
} satisfies PurchaseOrderRecord;

const contract = {
  id: "contract-1",
  contract_number: "CON-2026-000001",
  purchase_order_id: "po-1",
  po_number: "PO-2026-000001",
  rfq_id: "rfq-1",
  quote_id: "quote-1",
  quote_decision_id: "decision-1",
  buyer_id: "buyer-1",
  manufacturer_id: "manufacturer-1",
  status: "draft",
  currency: "USD",
  subtotal: 125000,
  contract_title: "Contract for PO-2026-000001",
  governing_law: "Delaware",
  contract_terms: "Foundation terms.",
  buyer_reference: null,
  buyer_note: null,
  purchase_order_snapshot: { po_number: "PO-2026-000001" },
  buyer_snapshot: { full_name: "Buyer" },
  manufacturer_snapshot: { company_display_name: "Factory" },
  quote_snapshot: { version: 2 },
  product_snapshot: { name: "Snapshot Home" },
  line_items_snapshot: [{ description: "Home package", amount: 125000 }],
  created_by: "buyer-1",
  ready_at: null,
  created_at: "2026-07-14T15:00:00Z",
  updated_at: "2026-07-14T15:00:00Z",
} satisfies ContractRecord;

describe("contract helpers", () => {
  it("allows contract creation only for confirmed POs without existing contracts", () => {
    assert.equal(canCreateContractForPurchaseOrder(confirmedPurchaseOrder, []), true);
    assert.equal(canCreateContractForPurchaseOrder(confirmedPurchaseOrder, [contract]), false);
    assert.equal(
      canCreateContractForPurchaseOrder({ ...confirmedPurchaseOrder, status: "submitted" }, []),
      false
    );
  });

  it("keeps the contract lifecycle conservative", () => {
    assert.equal(contractStatusLabels.draft, "Draft");
    assert.equal(contractStatusLabels.ready, "Ready");
    assert.equal(isContractReadOnly({ status: "draft" }), false);
    assert.equal(isContractReadOnly({ status: "ready" }), true);
  });

  it("validates draft and ready values without adding signature requirements", () => {
    assert.deepEqual(validateContractDraft(emptyContractDraftValues()), []);
    assert.deepEqual(validateContractReady(emptyContractDraftValues()), ["Contract title is required."]);
    assert.deepEqual(validateContractDraft({
      contractTitle: "x".repeat(201),
      governingLaw: "Delaware",
      contractTerms: "Terms",
    }), ["Contract title must be 200 characters or fewer."]);
    assert.deepEqual(validateContractDraft({
      contractTitle: "Contract",
      governingLaw: "x".repeat(121),
      contractTerms: "Terms",
    }), ["Governing law must be 120 characters or fewer."]);
    assert.deepEqual(validateContractDraft({
      contractTitle: "Contract",
      governingLaw: "Delaware",
      contractTerms: "x".repeat(8001),
    }), ["Contract terms must be 8000 characters or fewer."]);
  });

  it("formats contract labels and trusted event labels", () => {
    assert.equal(contractSubtotalLabel(contract), "$125,000.00");
    assert.equal(contractCreatedAtLabel(contract).startsWith("Created "), true);
    assert.equal(contractReadyAtLabel(contract), null);
    assert.equal(
      contractReadyAtLabel({ status: "ready", ready_at: "2026-07-14T16:00:00Z" }).startsWith("Ready "),
      true
    );
    assert.equal(contractReadyConfirmationText(contract), "Mark CON-2026-000001 ready for participant review?");
    assert.equal(contractEventLabel({
      id: "event-1",
      contract_id: "contract-1",
      event_type: "contract_ready",
      actor_profile_id: "buyer-1",
      metadata: {},
      created_at: "2026-07-14T16:00:00Z",
    }), "Contract ready");
  });
});
