import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canCreateContractForPurchaseOrder,
  canBuyerEditContractRevision,
  canBuyerResubmitContract,
  canManufacturerOpenContract,
  contractAcceptedAtLabel,
  contractCreatedAtLabel,
  contractDecisionLabels,
  contractEventLabel,
  contractFirstReadyAtLabel,
  contractLastReadyAtLabel,
  contractReadyAtLabel,
  contractReadyConfirmationText,
  contractRejectedAtLabel,
  contractResubmitConfirmationText,
  contractReviewRoundLabel,
  contractStatusLabels,
  contractSubtotalLabel,
  getManufacturerContractActions,
  emptyContractDraftValues,
  isContractReadOnly,
  manufacturerContractDecisionConfirmationText,
  sortContractReviewDecisions,
  validateContractDraft,
  validateContractReady,
  validateContractReviewReason,
} from "./contracts";
import type { ContractRecord, ContractReviewDecisionRecord, PurchaseOrderRecord } from "../types";

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
  review_round: 0,
  first_ready_at: null,
  last_ready_at: null,
  accepted_at: null,
  rejected_at: null,
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
    assert.equal(contractStatusLabels.participant_review, "Participant review");
    assert.equal(contractStatusLabels.revision_requested, "Revision requested");
    assert.equal(contractStatusLabels.accepted, "Accepted by Manufacturer");
    assert.equal(contractStatusLabels.rejected, "Rejected");
    assert.equal(isContractReadOnly({ status: "draft" }), false);
    assert.equal(isContractReadOnly({ status: "ready" }), true);
    assert.equal(isContractReadOnly({ status: "participant_review" }), true);
    assert.equal(isContractReadOnly({ status: "revision_requested" }), false);
    assert.equal(isContractReadOnly({ status: "accepted" }), true);
    assert.equal(isContractReadOnly({ status: "rejected" }), true);
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

  it("maps participant review actions conservatively by status", () => {
    assert.equal(canManufacturerOpenContract({ status: "ready" }), true);
    assert.equal(canManufacturerOpenContract({ status: "participant_review" }), false);
    assert.deepEqual(getManufacturerContractActions({ status: "participant_review" }), [
      "accepted",
      "rejected",
      "revision_requested",
    ]);
    assert.deepEqual(getManufacturerContractActions({ status: "ready" }), []);
    assert.equal(canBuyerEditContractRevision({ status: "revision_requested" }), true);
    assert.equal(canBuyerResubmitContract({ status: "revision_requested" }), true);
    assert.equal(canBuyerEditContractRevision({ status: "accepted" }), false);
  });

  it("validates manufacturer decision reasons", () => {
    assert.deepEqual(validateContractReviewReason("accepted", ""), []);
    assert.deepEqual(validateContractReviewReason("rejected", ""), ["A reason is required."]);
    assert.deepEqual(validateContractReviewReason("revision_requested", " "), ["A reason is required."]);
    assert.deepEqual(validateContractReviewReason("rejected", "x".repeat(4001)), [
      "Reason must be 4000 characters or fewer.",
    ]);
  });

  it("renders review-round and timestamp labels without duplicate round-one last-ready", () => {
    const readyContract = {
      ...contract,
      status: "ready",
      review_round: 1,
      ready_at: "2026-07-14T16:00:00Z",
      first_ready_at: "2026-07-14T16:00:00Z",
      last_ready_at: "2026-07-14T16:00:00Z",
    } satisfies ContractRecord;
    assert.equal(contractReviewRoundLabel(readyContract), "Review round 1");
    assert.equal(contractFirstReadyAtLabel(readyContract).startsWith("First ready "), true);
    assert.equal(contractLastReadyAtLabel(readyContract), null);

    const roundTwo = {
      ...readyContract,
      review_round: 2,
      last_ready_at: "2026-07-15T16:00:00Z",
      ready_at: "2026-07-15T16:00:00Z",
    } satisfies ContractRecord;
    assert.equal(contractLastReadyAtLabel(roundTwo).startsWith("Last ready "), true);
    assert.equal(contractAcceptedAtLabel({ ...roundTwo, status: "accepted", accepted_at: "2026-07-15T17:00:00Z" }).startsWith("Accepted "), true);
    assert.equal(contractRejectedAtLabel({ ...roundTwo, status: "rejected", rejected_at: "2026-07-15T17:00:00Z" }).startsWith("Rejected "), true);
  });

  it("builds review confirmations without signature or legal-effectiveness claims", () => {
    const acceptText = manufacturerContractDecisionConfirmationText(contract, "accepted");
    assert.equal(acceptText.includes("does not sign"), true);
    assert.equal(acceptText.includes("does not make it executed or legally effective"), true);
    assert.equal(manufacturerContractDecisionConfirmationText(contract, "revision_requested").includes("Commercial snapshots remain immutable"), true);
    assert.equal(contractResubmitConfirmationText({ ...contract, review_round: 1 }).includes("PO pricing, line items, ownership, and snapshots remain unchanged"), true);
  });

  it("orders immutable decision history by review round and timestamp", () => {
    const decisions = [
      {
        id: "decision-2",
        contract_id: "contract-1",
        review_round: 2,
        manufacturer_id: "manufacturer-1",
        actor_profile_id: "manufacturer-owner",
        decision: "accepted",
        reason: null,
        created_at: "2026-07-15T12:00:00Z",
      },
      {
        id: "decision-1",
        contract_id: "contract-1",
        review_round: 1,
        manufacturer_id: "manufacturer-1",
        actor_profile_id: "manufacturer-owner",
        decision: "revision_requested",
        reason: "Clarify",
        created_at: "2026-07-14T12:00:00Z",
      },
    ] satisfies ContractReviewDecisionRecord[];
    assert.deepEqual(sortContractReviewDecisions(decisions).map((decision) => decision.id), [
      "decision-1",
      "decision-2",
    ]);
    assert.equal(contractDecisionLabels.accepted, "Accepted by Manufacturer");
    assert.equal(contractEventLabel({
      id: "event-2",
      contract_id: "contract-1",
      event_type: "contract_resubmitted",
      actor_profile_id: "buyer-1",
      metadata: {},
      created_at: "2026-07-15T12:00:00Z",
    }), "Contract resubmitted");
  });

  it("keeps signature PDF payment invoice and shipping controls out of helper copy", () => {
    const helperText = [
      Object.values(contractStatusLabels).join(" "),
      Object.values(contractDecisionLabels).join(" "),
      Object.values({
        ready: contractReadyConfirmationText(contract),
        resubmit: contractResubmitConfirmationText({ ...contract, review_round: 1 }),
        accept: manufacturerContractDecisionConfirmationText(contract, "accepted"),
        revision: manufacturerContractDecisionConfirmationText(contract, "revision_requested"),
      }).join(" "),
    ].join(" ");
    assert.equal(/DocuSign|Adobe Sign|PDF|Payment|Invoice|Shipping|Legally binding|Executed|Effective/.test(helperText), false);
  });
});
