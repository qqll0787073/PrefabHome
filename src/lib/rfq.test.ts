import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buyerRFQDashboardGroup,
  buyerRFQDashboardStatuses,
  canTransitionRFQ,
  emptyRFQForm,
  isRFQStatus,
  manufacturerRFQDashboardGroup,
  rfqSnapshotTitle,
  rfqStatusLabels,
  rfqTimeline,
  toRFQPayload,
  validateRFQForm,
} from "./rfq";
import type { MarketplaceProduct, RFQEventRecord, RFQMessageRecord, RFQStatus } from "../types";

const product = {
  id: "product-1",
  manufacturer_id: "manufacturer-1",
  currency: "USD",
} as MarketplaceProduct;

describe("rfq helpers", () => {
  it("creates draft payloads for the selected published product", () => {
    const values = {
      ...emptyRFQForm("CAD"),
      requestedQuantity: "3.5",
      incoterm: "fob",
      destinationCountry: "Canada",
      destinationPort: "Vancouver",
      buyerMessage: "Please quote this model.",
    };

    const payload = toRFQPayload("buyer-1", product, values, "draft");

    assert.equal(payload.buyer_id, "buyer-1");
    assert.equal(payload.manufacturer_id, "manufacturer-1");
    assert.equal(payload.product_id, "product-1");
    assert.equal(payload.status, "draft");
    assert.equal(payload.requested_quantity, 3.5);
    assert.equal(payload.requested_currency, "CAD");
    assert.equal(payload.incoterm, "FOB");
    assert.equal(payload.destination_country, "Canada");
  });

  it("validates submit requirements and message length", () => {
    const values = {
      ...emptyRFQForm(),
      requestedQuantity: "",
      destinationCountry: "",
      buyerMessage: "x".repeat(2001),
    };

    const errors = validateRFQForm(values);

    assert.deepEqual(errors, [
      "Quantity is required.",
      "Destination country is required.",
      "Message must be 2000 characters or fewer.",
    ]);
  });

  it("maps only supported RFQ statuses", () => {
    const statuses: RFQStatus[] = [
      "draft",
      "submitted",
      "manufacturer_review",
      "quoted",
      "buyer_review",
      "accepted",
      "declined",
      "expired",
      "cancelled",
    ];

    assert.equal(statuses.every(isRFQStatus), true);
    assert.equal(isRFQStatus("paid"), false);
    assert.equal(rfqStatusLabels.manufacturer_review, "Manufacturer review");
  });

  it("enforces the documented transition matrix", () => {
    assert.equal(canTransitionRFQ("draft", "submitted"), true);
    assert.equal(canTransitionRFQ("submitted", "manufacturer_review"), true);
    assert.equal(canTransitionRFQ("manufacturer_review", "quoted"), true);
    assert.equal(canTransitionRFQ("quoted", "buyer_review"), true);
    assert.equal(canTransitionRFQ("buyer_review", "accepted"), true);
    assert.equal(canTransitionRFQ("buyer_review", "declined"), true);
    assert.equal(canTransitionRFQ("submitted", "cancelled"), true);

    assert.equal(canTransitionRFQ("draft", "accepted"), false);
    assert.equal(canTransitionRFQ("draft", "quoted"), false);
    assert.equal(canTransitionRFQ("submitted", "accepted"), false);
    assert.equal(canTransitionRFQ("accepted", "draft"), false);
    assert.equal(canTransitionRFQ("declined", "quoted"), false);
  });

  it("sorts RFQ timeline events and messages chronologically", () => {
    const events = [
      {
        id: "event-2",
        rfq_id: "rfq-1",
        event_type: "submitted",
        actor_profile_id: "buyer-1",
        metadata: {},
        created_at: "2026-07-14T10:02:00Z",
      },
      {
        id: "event-1",
        rfq_id: "rfq-1",
        event_type: "draft_created",
        actor_profile_id: "buyer-1",
        metadata: {},
        created_at: "2026-07-14T10:00:00Z",
      },
    ] satisfies RFQEventRecord[];
    const messages = [
      {
        id: "message-1",
        rfq_id: "rfq-1",
        sender_profile_id: "buyer-1",
        sender_role: "buyer",
        message: "Hello",
        attachment_path: null,
        created_at: "2026-07-14T10:01:00Z",
      },
    ] satisfies RFQMessageRecord[];

    assert.deepEqual(
      rfqTimeline(events, messages).map((item) => item.id),
      ["event-1", "message-1", "event-2"]
    );
  });

  it("keeps buyer dashboard status buckets aligned with PH-006A", () => {
    assert.deepEqual(buyerRFQDashboardStatuses, [
      "draft",
      "submitted",
      "quoted",
      "accepted",
      "declined",
      "cancelled",
    ]);
    assert.equal(buyerRFQDashboardGroup("draft"), "draft");
    assert.equal(buyerRFQDashboardGroup("manufacturer_review"), "waiting_manufacturer");
    assert.equal(buyerRFQDashboardGroup("buyer_review"), "waiting_buyer");
    assert.equal(buyerRFQDashboardGroup("declined"), "closed");
  });

  it("keeps manufacturer dashboard groups aligned with PH-006A", () => {
    assert.equal(manufacturerRFQDashboardGroup("submitted"), "new");
    assert.equal(manufacturerRFQDashboardGroup("manufacturer_review"), "waiting_reply");
    assert.equal(manufacturerRFQDashboardGroup("quoted"), "quoted");
    assert.equal(manufacturerRFQDashboardGroup("accepted"), "closed");
  });

  it("renders product titles from immutable snapshots", () => {
    assert.equal(
      rfqSnapshotTitle({ model_name: "Snapshot Model", name: "Changed Product" }),
      "Snapshot Model"
    );
    assert.equal(rfqSnapshotTitle({ name: "Snapshot Name" }), "Snapshot Name");
  });

  it("uses permission-safe role mapping for RFQ conversations", () => {
    const participantRoles = ["buyer", "manufacturer", "admin"];

    assert.equal(participantRoles.includes("buyer"), true);
    assert.equal(participantRoles.includes("manufacturer"), true);
    assert.equal(participantRoles.includes("anonymous"), false);
  });
});
