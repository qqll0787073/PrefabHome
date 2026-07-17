import assert from "node:assert/strict";
import test from "node:test";
import {
  canManageProviderCandidates,
  canMarkReadyForExternalBooking,
  canSelectProviderCandidate,
  emptyLogisticsProviderCandidateValues,
  logisticsArrangementNotice,
  selectedProviderCandidate,
  validateLogisticsProviderCandidate,
} from "./logisticsArrangement";
import type {
  LogisticsBookingRequestRecord,
  LogisticsProviderCandidateRecord,
  LogisticsProviderSelectionRecord,
} from "../types";

const request = { id: "request-1", status: "carrier_options_available" } as LogisticsBookingRequestRecord;
const candidate = {
  id: "candidate-1",
  logistics_booking_request_id: request.id,
  provider_name: "Northstar Freight",
  provider_type: "freight_forwarder",
  service_level: "Port to port",
  estimated_departure_date: "2026-08-01",
  estimated_arrival_date: "2026-08-20",
  estimated_transit_days: 19,
  estimated_cost: 12500,
  currency: "USD",
  quote_reference: "Q-100",
  contact_name: null,
  contact_email: null,
  contact_phone: null,
  notes: null,
  candidate_status: "active",
  version: 1,
  created_by: "admin-1",
  updated_by: "admin-1",
  created_at: "2026-07-17T12:00:00Z",
  updated_at: "2026-07-17T12:00:00Z",
} as LogisticsProviderCandidateRecord;

test("validates provider candidate inputs and normalizes empty form values", () => {
  const values = emptyLogisticsProviderCandidateValues(candidate);
  assert.deepEqual(validateLogisticsProviderCandidate(values), []);
  assert.equal(values.currency, "USD");
  assert.equal(validateLogisticsProviderCandidate({ ...values, providerName: "" }).includes("Provider name is required."), true);
  assert.equal(validateLogisticsProviderCandidate({ ...values, currency: "US" }).includes("Currency must be a three-letter code."), true);
  assert.equal(validateLogisticsProviderCandidate({ ...values, estimatedCost: "-1" }).includes("Estimated cost must be zero or greater."), true);
  assert.equal(validateLogisticsProviderCandidate({ ...values, estimatedArrivalDate: "2026-07-01" }).includes("Estimated arrival cannot be before estimated departure."), true);
});

test("limits candidate management to arrangement lifecycle states", () => {
  assert.equal(canManageProviderCandidates(request), true);
  assert.equal(canManageProviderCandidates({ ...request, status: "submitted_for_arrangement" }), true);
  assert.equal(canManageProviderCandidates({ ...request, status: "carrier_selected" }), true);
  assert.equal(canManageProviderCandidates({ ...request, status: "booking_draft" }), false);
  assert.equal(canManageProviderCandidates({ ...request, status: "ready_for_external_booking" }), false);
  assert.equal(canManageProviderCandidates({ ...request, status: "withdrawn" }), false);
});

test("allows selection only for active candidates", () => {
  assert.equal(canSelectProviderCandidate(candidate), true);
  assert.equal(canSelectProviderCandidate({ ...candidate, candidate_status: "withdrawn" }), false);
  assert.equal(canSelectProviderCandidate({ ...candidate, candidate_status: "rejected" }), false);
  assert.equal(canSelectProviderCandidate({ ...candidate, candidate_status: "selected" }), false);
});

test("associates the current selection with its candidate", () => {
  const selection = {
    id: "selection-1",
    selected_candidate_id: candidate.id,
    selection_status: "selected",
  } as LogisticsProviderSelectionRecord;
  assert.equal(selectedProviderCandidate([candidate], [selection])?.id, candidate.id);
  assert.equal(selectedProviderCandidate([candidate], [{ ...selection, selection_status: "cancelled" }]), null);
});

test("requires a complete selected estimate before external-booking readiness", () => {
  const selected = { ...candidate, candidate_status: "selected" } as LogisticsProviderCandidateRecord;
  assert.equal(canMarkReadyForExternalBooking({ ...request, status: "carrier_selected" }, selected), true);
  assert.equal(canMarkReadyForExternalBooking(request, selected), false);
  assert.equal(canMarkReadyForExternalBooking({ ...request, status: "carrier_selected" }, { ...selected, currency: null }), false);
  assert.equal(canMarkReadyForExternalBooking({ ...request, status: "carrier_selected" }, { ...selected, estimated_cost: null }), false);
});

test("copy distinguishes internal selection from external fulfillment", () => {
  const notice = logisticsArrangementNotice();
  assert.match(notice, /Internal planning only/);
  assert.match(notice, /not an external booking/);
  assert.doesNotMatch(notice, /booking confirmed|shipment dispatched|customs cleared|delivered/i);
});
