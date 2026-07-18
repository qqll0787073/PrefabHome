import assert from "node:assert/strict";
import test from "node:test";
import {
  canEditAdminCandidate,
  describePartialFailure,
  filterLogisticsRequests,
  isLogisticsLifecycleConflict,
  logisticsNextStep,
  logisticsStatusCounts,
  participantCandidateFields,
  participantForbiddenFields,
  participantRecordHasForbiddenFields,
  reconcileLogisticsRequestId,
} from "./logisticsWorkspaceModel";
import type { LogisticsBookingRequestRecord, LogisticsProviderCandidateRecord } from "../../types";

function request(id: string, status: LogisticsBookingRequestRecord["status"], createdAt: string): LogisticsBookingRequestRecord {
  return {
    id,
    status,
    created_at: createdAt,
    booking_request_number: `BKR-${id}`,
    shipping_number: `SHIP-${id}`,
    purchase_order_number: `PO-${id}`,
    contract_number: `CON-${id}`,
    invoice_number: `INV-${id}`,
  } as LogisticsBookingRequestRecord;
}

test("groups and filters logistics requests deterministically", () => {
  const rows = [request("1", "submitted_for_arrangement", "2026-01-01"), request("2", "carrier_selected", "2026-02-01")];
  assert.equal(logisticsStatusCounts(rows).all, 2);
  assert.equal(logisticsStatusCounts(rows).carrier_selected, 1);
  assert.deepEqual(filterLogisticsRequests(rows, "all").map((row) => row.id), ["2", "1"]);
  assert.deepEqual(filterLogisticsRequests(rows, "submitted_for_arrangement", "BKR-1").map((row) => row.id), ["1"]);
});

test("reconciles stale or unauthorized request identifiers", () => {
  const rows = [request("owned", "submitted_for_arrangement", "2026-01-01")];
  assert.equal(reconcileLogisticsRequestId(rows, "owned"), "owned");
  assert.equal(reconcileLogisticsRequestId(rows, "unrelated"), "owned");
  assert.equal(reconcileLogisticsRequestId([], "unrelated"), null);
});

test("uses neutral planning labels and next actions", () => {
  assert.match(logisticsNextStep("carrier_options_available", "buyer"), /Provider options/);
  assert.match(logisticsNextStep("carrier_selected", "manufacturer"), /provider is selected/i);
  assert.match(logisticsNextStep("ready_for_external_booking", "admin"), /No external booking/i);
});

test("keeps participant candidate fields separate from internal fields", () => {
  for (const forbidden of participantForbiddenFields) assert.equal(participantCandidateFields.includes(forbidden as never), false);
  assert.equal(participantRecordHasForbiddenFields({ provider_name: "Safe", transport_mode: "ocean" }), false);
  assert.equal(participantRecordHasForbiddenFields({ provider_name: "Unsafe", contact_email: "private@example.test" }), true);
});

test("maps conflict, partial failure, and Admin edit behavior", () => {
  assert.equal(isLogisticsLifecycleConflict("Provider candidate lifecycle conflict while updating."), true);
  assert.equal(isLogisticsLifecycleConflict("Network unavailable"), false);
  assert.match(describePartialFailure(["provider options", "timeline"]), /provider options, timeline/);
  assert.equal(canEditAdminCandidate(request("1", "carrier_options_available", "2026-01-01"), { candidate_status: "active" } as LogisticsProviderCandidateRecord), true);
  assert.equal(canEditAdminCandidate(request("1", "ready_for_external_booking", "2026-01-01"), { candidate_status: "active" } as LogisticsProviderCandidateRecord), false);
});
