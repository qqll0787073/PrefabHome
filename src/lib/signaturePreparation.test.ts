import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  ContractRecord,
  SignaturePackageEventRecord,
  SignaturePackageRecord,
  SignatureParticipantRecord,
} from "../types";
import {
  canPrepareSignaturePackage,
  emptySignatureParticipantValues,
  findSignatureParticipant,
  isSignaturePackageReadOnly,
  isSignaturePackageReadyEligible,
  isSignatureParticipantComplete,
  signaturePackageEventLabel,
  signaturePackageReadyAtLabel,
  signaturePackageReadyConfirmationText,
  signaturePackageStatusLabels,
  signatureParticipantLabels,
  signatureParticipantOrderLabel,
  signatureReadinessReason,
  sortSignatureParticipants,
  validateSignatureParticipant,
} from "./signaturePreparation";

const acceptedContract = {
  id: "contract-1",
  contract_number: "CON-2026-000001",
  purchase_order_id: "po-1",
  po_number: "PO-2026-000001",
  rfq_id: "rfq-1",
  quote_id: "quote-1",
  quote_decision_id: "decision-1",
  buyer_id: "buyer-1",
  manufacturer_id: "manufacturer-1",
  status: "accepted",
  currency: "USD",
  subtotal: 100000,
  contract_title: "Accepted contract",
  governing_law: "Delaware",
  contract_terms: "Terms",
  buyer_reference: null,
  buyer_note: null,
  purchase_order_snapshot: {},
  buyer_snapshot: {},
  manufacturer_snapshot: {},
  quote_snapshot: {},
  product_snapshot: {},
  line_items_snapshot: [{ description: "Home", quantity: 1, amount: 100000 }],
  created_by: "buyer-1",
  ready_at: "2026-07-15T10:00:00Z",
  review_round: 1,
  first_ready_at: "2026-07-15T10:00:00Z",
  last_ready_at: "2026-07-15T10:00:00Z",
  accepted_at: "2026-07-15T12:00:00Z",
  rejected_at: null,
  created_at: "2026-07-15T09:00:00Z",
  updated_at: "2026-07-15T12:00:00Z",
} satisfies ContractRecord;

const signaturePackage = {
  id: "package-1",
  package_number: "SIG-2026-000001",
  contract_id: "contract-1",
  contract_number: "CON-2026-000001",
  buyer_id: "buyer-1",
  manufacturer_id: "manufacturer-1",
  status: "draft",
  version: 1,
  contract_snapshot: {},
  buyer_snapshot: {},
  manufacturer_snapshot: {},
  decision_snapshot: {},
  signing_content_snapshot: {},
  created_by: "buyer-1",
  ready_at: null,
  created_at: "2026-07-15T12:30:00Z",
  updated_at: "2026-07-15T12:30:00Z",
} satisfies SignaturePackageRecord;

const buyerParticipant = {
  id: "participant-1",
  signature_package_id: "package-1",
  participant_role: "buyer_signer",
  profile_id: "buyer-1",
  organization_id: null,
  full_name: "Buyer Signer",
  email: "buyer@example.com",
  title: "Director",
  signing_order: 1,
  status: "pending",
  created_at: "2026-07-15T12:30:00Z",
  updated_at: "2026-07-15T12:30:00Z",
} satisfies SignatureParticipantRecord;

const manufacturerParticipant = {
  ...buyerParticipant,
  id: "participant-2",
  participant_role: "manufacturer_signer",
  profile_id: "manufacturer-owner-1",
  organization_id: "manufacturer-1",
  full_name: "Factory Signer",
  email: "factory@example.com",
  title: "Sales Lead",
  signing_order: 2,
} satisfies SignatureParticipantRecord;

describe("signature preparation helpers", () => {
  it("allows Prepare Signature Package only for accepted contracts without an existing package", () => {
    assert.equal(canPrepareSignaturePackage(acceptedContract, []), true);
    assert.equal(canPrepareSignaturePackage(acceptedContract, [signaturePackage]), false);
    assert.equal(canPrepareSignaturePackage({ ...acceptedContract, status: "ready" }, []), false);
  });

  it("keeps package status labels and read-only mapping conservative", () => {
    assert.equal(signaturePackageStatusLabels.draft, "Draft");
    assert.equal(signaturePackageStatusLabels.ready_to_send, "Ready to Send");
    assert.equal(isSignaturePackageReadOnly({ status: "draft" }), false);
    assert.equal(isSignaturePackageReadOnly({ status: "ready_to_send" }), true);
  });

  it("validates Buyer and Manufacturer signer values", () => {
    assert.deepEqual(validateSignatureParticipant({ fullName: "", email: "", title: "" }), [
      "Signer name is required.",
      "Signer email is required.",
    ]);
    assert.deepEqual(validateSignatureParticipant({ fullName: "Signer", email: "invalid", title: "" }), [
      "Signer email must be valid.",
    ]);
    assert.deepEqual(validateSignatureParticipant({ fullName: "Signer", email: "name@example.com", title: "x".repeat(121) }), [
      "Signer title must be 120 characters or fewer.",
    ]);
    assert.deepEqual(validateSignatureParticipant({ fullName: "Signer", email: "name@example.com", title: "CEO" }), []);
  });

  it("tracks role-specific signer completeness and waiting state", () => {
    assert.equal(isSignatureParticipantComplete(buyerParticipant), true);
    assert.equal(isSignatureParticipantComplete({ ...buyerParticipant, email: null }), false);
    assert.equal(isSignaturePackageReadyEligible([buyerParticipant]), false);
    assert.equal(signatureReadinessReason([buyerParticipant]), "Waiting for Manufacturer signer details.");
    assert.equal(isSignaturePackageReadyEligible([buyerParticipant, manufacturerParticipant]), true);
    assert.equal(signatureReadinessReason([buyerParticipant, manufacturerParticipant]), "Both signers are complete.");
  });

  it("keeps fixed signing order and participant lookup stable", () => {
    const sorted = sortSignatureParticipants([manufacturerParticipant, buyerParticipant]);
    assert.deepEqual(sorted.map((participant) => participant.participant_role), ["buyer_signer", "manufacturer_signer"]);
    assert.equal(signatureParticipantOrderLabel(buyerParticipant), "Order 1: Buyer signer");
    assert.equal(signatureParticipantOrderLabel(manufacturerParticipant), "Order 2: Manufacturer signer");
    assert.equal(signatureParticipantLabels.buyer_signer, "Buyer signer");
    assert.equal(findSignatureParticipant(sorted, "manufacturer_signer")?.id, "participant-2");
  });

  it("builds ready confirmation with preparation-only semantics", () => {
    const confirmation = signaturePackageReadyConfirmationText(signaturePackage);
    assert.equal(confirmation.includes("does not send the package"), true);
    assert.equal(confirmation.includes("does not sign the Contract"), true);
    assert.equal(confirmation.includes("does not execute the Contract"), true);
    assert.equal(confirmation.includes("does not make it legally effective"), true);
  });

  it("renders ready labels and trusted event labels", () => {
    assert.equal(signaturePackageReadyAtLabel(signaturePackage), null);
    assert.equal(
      signaturePackageReadyAtLabel({
        ...signaturePackage,
        status: "ready_to_send",
        ready_at: "2026-07-15T13:00:00Z",
      }).startsWith("Ready "),
      true
    );
    assert.equal(
      signaturePackageEventLabel({
        id: "event-1",
        signature_package_id: "package-1",
        event_type: "signature_package_ready",
        actor_profile_id: "buyer-1",
        metadata: {},
        created_at: "2026-07-15T13:00:00Z",
      } satisfies SignaturePackageEventRecord),
      "Signature package ready to send"
    );
  });

  it("initializes signer editor values from participants", () => {
    assert.deepEqual(emptySignatureParticipantValues(buyerParticipant), {
      fullName: "Buyer Signer",
      email: "buyer@example.com",
      title: "Director",
    });
  });

  it("keeps sent signed completed executed effective claims out of labels and controls", () => {
    const labels = [
      Object.values(signaturePackageStatusLabels).join(" "),
      Object.values(signatureParticipantLabels).join(" "),
      signaturePackageReadyConfirmationText(signaturePackage).replace(/does not [^.]+/g, ""),
      signatureReadinessReason([buyerParticipant]),
    ].join(" ");
    assert.equal(/sent|viewed|signed|completed|executed|effective|payment|invoice|shipping/i.test(labels), false);
  });
});
