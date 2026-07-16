import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canCancelSignatureDelivery,
  canPrepareSignatureDelivery,
  canQueueSignatureDelivery,
  isSignatureDeliveryReadOnly,
  signatureDeliveryCancelledAtLabel,
  signatureDeliveryEventLabel,
  signatureDeliveryProviderLabel,
  signatureDeliveryQueueConfirmationText,
  signatureDeliveryQueuedAtLabel,
  signatureDeliveryQueuedNotice,
  signatureDeliveryStatusLabels,
  sortSignatureDeliveryRecipients,
  unconfiguredSignatureDeliveryProvider,
  validateSignatureDeliveryCancelReason,
} from "./signatureDelivery";
import type {
  SignatureDeliveryEventRecord,
  SignatureDeliveryRecipientRecord,
  SignatureDeliveryRequestRecord,
  SignaturePackageRecord,
} from "../types";

const readyPackage = {
  id: "package-1",
  status: "ready_to_send",
} as SignaturePackageRecord;

const draftDelivery = {
  id: "delivery-1",
  delivery_number: "SDL-2026-000001",
  signature_package_id: "package-1",
  package_number: "SIG-2026-000001",
  contract_id: "contract-1",
  contract_number: "CON-2026-000001",
  buyer_id: "buyer-1",
  manufacturer_id: "manufacturer-1",
  status: "delivery_draft",
  provider_key: "unconfigured",
  package_snapshot: {},
  recipient_snapshot: [],
  request_payload_snapshot: {},
  created_by: "buyer-1",
  queued_at: null,
  cancelled_at: null,
  cancellation_reason: null,
  created_at: "2026-07-16T00:00:00.000Z",
  updated_at: "2026-07-16T00:00:00.000Z",
} satisfies SignatureDeliveryRequestRecord;

describe("signature delivery helpers", () => {
  it("allows delivery preparation only for ready packages without existing deliveries", () => {
    assert.equal(canPrepareSignatureDelivery(readyPackage, []), true);
    assert.equal(canPrepareSignatureDelivery({ ...readyPackage, status: "draft" }, []), false);
    assert.equal(canPrepareSignatureDelivery(readyPackage, [{ signature_package_id: readyPackage.id }]), false);
  });

  it("keeps status labels and read-only mapping conservative", () => {
    assert.equal(signatureDeliveryStatusLabels.delivery_draft, "Delivery Draft");
    assert.equal(signatureDeliveryStatusLabels.queued, "Queued Internally");
    assert.equal(signatureDeliveryStatusLabels.cancelled, "Cancelled");
    assert.equal(isSignatureDeliveryReadOnly(draftDelivery), false);
    assert.equal(isSignatureDeliveryReadOnly({ ...draftDelivery, status: "queued" }), true);
    assert.equal(isSignatureDeliveryReadOnly({ ...draftDelivery, status: "cancelled" }), true);
  });

  it("allows queueing only from draft and cancellation from draft or queued", () => {
    assert.equal(canQueueSignatureDelivery(draftDelivery), true);
    assert.equal(canQueueSignatureDelivery({ ...draftDelivery, status: "queued" }), false);
    assert.equal(canQueueSignatureDelivery({ ...draftDelivery, status: "cancelled" }), false);
    assert.equal(canCancelSignatureDelivery(draftDelivery), true);
    assert.equal(canCancelSignatureDelivery({ ...draftDelivery, status: "queued" }), true);
    assert.equal(canCancelSignatureDelivery({ ...draftDelivery, status: "cancelled" }), false);
  });

  it("validates cancellation reasons", () => {
    assert.deepEqual(validateSignatureDeliveryCancelReason(""), ["Cancellation reason is required."]);
    assert.deepEqual(validateSignatureDeliveryCancelReason(" ".repeat(4)), ["Cancellation reason is required."]);
    assert.deepEqual(validateSignatureDeliveryCancelReason("x".repeat(2001)), [
      "Cancellation reason must be 2000 characters or fewer.",
    ]);
    assert.deepEqual(validateSignatureDeliveryCancelReason("Buyer paused request."), []);
  });

  it("builds queue copy with internal-only semantics", () => {
    const confirmation = signatureDeliveryQueueConfirmationText(draftDelivery);
    assert.equal(confirmation.includes("No provider will be contacted"), true);
    assert.equal(confirmation.includes("no email will be sent"), true);
    assert.equal(confirmation.includes("no signing link will be created"), true);
    assert.equal(confirmation.includes("will not be signed"), true);
    assert.equal(signatureDeliveryQueuedNotice(), "Queued internally. Not sent to a signature provider.");
  });

  it("renders provider and timestamp labels", () => {
    assert.equal(signatureDeliveryProviderLabel(draftDelivery), "Provider: Not configured");
    assert.equal(signatureDeliveryQueuedAtLabel(draftDelivery), null);
    assert.equal(
      signatureDeliveryQueuedAtLabel({ ...draftDelivery, status: "queued", queued_at: "2026-07-16T01:00:00.000Z" })?.startsWith("Queued internally"),
      true
    );
    assert.equal(signatureDeliveryCancelledAtLabel(draftDelivery), null);
    assert.equal(
      signatureDeliveryCancelledAtLabel({ ...draftDelivery, status: "cancelled", cancelled_at: "2026-07-16T02:00:00.000Z", cancellation_reason: "Paused" })?.startsWith("Cancelled"),
      true
    );
  });

  it("sorts recipients by fixed signing order", () => {
    const recipients = [
      { id: "2", signing_order: 2 },
      { id: "1", signing_order: 1 },
    ] as SignatureDeliveryRecipientRecord[];
    assert.deepEqual(sortSignatureDeliveryRecipients(recipients).map((item) => item.id), ["1", "2"]);
  });

  it("labels trusted events", () => {
    const event = {
      event_type: "signature_delivery_queued",
    } as SignatureDeliveryEventRecord;
    assert.equal(signatureDeliveryEventLabel(event), "Signature delivery request queued internally");
  });

  it("keeps provider adapter unconfigured and no-op", async () => {
    assert.equal(unconfiguredSignatureDeliveryProvider.providerKey, "unconfigured");
    await assert.rejects(() => unconfiguredSignatureDeliveryProvider.queue(), /not configured/i);
  });

  it("keeps positive sent signed completed executed effective claims out of labels after removing negative copy", () => {
    const labels = [
      ...Object.values(signatureDeliveryStatusLabels),
      signatureDeliveryQueueConfirmationText(draftDelivery),
      signatureDeliveryQueuedNotice(),
      signatureDeliveryProviderLabel(draftDelivery),
    ]
      .join(" ")
      .replace(/No provider will be contacted/gi, "")
      .replace(/no email will be sent/gi, "")
      .replace(/no signing link will be created/gi, "")
      .replace(/will not be signed/gi, "")
      .replace(/Not sent to a signature provider/gi, "");

    assert.equal(/sent|viewed|signed|completed|executed|effective|envelope|signing link/i.test(labels), false);
  });
});
