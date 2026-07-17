import assert from "node:assert/strict";
import test from "node:test";
import {
  canCreateLogisticsBookingRequest,
  canSubmitLogisticsBookingRequest,
  canWithdrawLogisticsBookingRequest,
  emptyLogisticsBookingRequestDraftValues,
  isLogisticsBookingRequestReadOnly,
  logisticsPlanningDisclaimer,
  logisticsSubmitConfirmationText,
  logisticsWithdrawConfirmationText,
  normalizeLogisticsLocation,
  validateLogisticsBookingDraft,
  validateLogisticsWithdrawalReason,
} from "./logisticsBookingRequests";
import type { LogisticsBookingRequestRecord, ShippingReadinessRecord } from "../types";

function dateInput(daysFromToday: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const shippingReadiness = {
  id: "ship-1",
  status: "ready_for_logistics",
} as ShippingReadinessRecord;

const bookingRequest = {
  id: "bkr-1",
  booking_request_number: "BKR-2026-000001",
  shipping_readiness_id: "ship-1",
  status: "booking_draft",
  requested_transport_mode: "ocean",
  requested_incoterm: "FOB",
  preferred_departure_date: dateInput(14),
  latest_acceptable_departure_date: dateInput(21),
  origin_location: { address_line1: "10 Factory Rd", city: "Shenzhen", state_region: "Guangdong", postal_code: "518000", country_code: "CN" },
  destination_location: { address_line1: "1 Port Way", city: "Los Angeles", state_region: "CA", postal_code: "90001", country_code: "US" },
  container_preference: "40ft_high_cube",
  equipment_notes: null,
  handling_requirements: null,
  booking_notes: null,
} as LogisticsBookingRequestRecord;

const completeValues = emptyLogisticsBookingRequestDraftValues(bookingRequest);

test("allows creation only from ready shipping readiness without existing request", () => {
  assert.equal(canCreateLogisticsBookingRequest(shippingReadiness, []), true);
  assert.equal(canCreateLogisticsBookingRequest({ ...shippingReadiness, status: "shipping_draft" }, []), false);
  assert.equal(canCreateLogisticsBookingRequest(shippingReadiness, [{ shipping_readiness_id: "ship-1" }]), false);
});

test("normalizes supported logistics locations", () => {
  assert.deepEqual(normalizeLogisticsLocation({
    addressLine1: " 10 Factory Rd ",
    addressLine2: "",
    city: " Shenzhen ",
    stateRegion: " Guangdong ",
    postalCode: " 518000 ",
    countryCode: " cn ",
  }), {
    address_line1: "10 Factory Rd",
    city: "Shenzhen",
    state_region: "Guangdong",
    postal_code: "518000",
    country_code: "CN",
  });
});

test("allows partial drafts while enforcing submit requirements", () => {
  assert.deepEqual(validateLogisticsBookingDraft({
    ...completeValues,
    originAddressLine1: "",
    preferredDepartureDate: "",
  }), []);
  const errors = validateLogisticsBookingDraft({
    ...completeValues,
    originAddressLine1: "",
    preferredDepartureDate: "",
  }, true);
  assert.equal(errors.includes("Origin address line 1 is required."), true);
  assert.equal(errors.includes("Preferred departure date is required."), true);
});

test("validates planning dates and supported choices", () => {
  assert.deepEqual(validateLogisticsBookingDraft(completeValues, true), []);
  assert.equal(validateLogisticsBookingDraft({ ...completeValues, requestedTransportMode: "space" as never }).includes("Choose a supported transport mode."), true);
  assert.equal(validateLogisticsBookingDraft({ ...completeValues, containerPreference: "vessel_slot" as never }).includes("Choose a supported container preference."), true);
  assert.equal(validateLogisticsBookingDraft({ ...completeValues, preferredDepartureDate: dateInput(-1) }).includes("Preferred departure date cannot be in the past."), true);
  assert.equal(validateLogisticsBookingDraft({ ...completeValues, preferredDepartureDate: dateInput(14), latestAcceptableDepartureDate: dateInput(7) }).includes("Latest acceptable departure date must be on or after preferred departure date."), true);
});

test("maps booking request lifecycle conservatively", () => {
  assert.equal(isLogisticsBookingRequestReadOnly(bookingRequest), false);
  assert.equal(canSubmitLogisticsBookingRequest(bookingRequest), true);
  assert.equal(canWithdrawLogisticsBookingRequest(bookingRequest), true);
  assert.equal(isLogisticsBookingRequestReadOnly({ ...bookingRequest, status: "submitted_for_arrangement" }), true);
  assert.equal(canSubmitLogisticsBookingRequest({ ...bookingRequest, status: "submitted_for_arrangement" }), false);
  assert.equal(canWithdrawLogisticsBookingRequest({ ...bookingRequest, status: "submitted_for_arrangement" }), true);
  assert.equal(canWithdrawLogisticsBookingRequest({ ...bookingRequest, status: "withdrawn" }), false);
});

test("keeps booking request copy away from external logistics claims", () => {
  const copy = [
    logisticsPlanningDisclaimer(),
    logisticsSubmitConfirmationText(bookingRequest),
    logisticsWithdrawConfirmationText(),
  ].join(" ");
  assert.doesNotMatch(copy, /Booking Confirmed|Carrier Assigned|Freight Forwarder Assigned|Pickup Scheduled|Tracking Number|Bill of Lading|Air Waybill|Vessel|Flight|Departure Confirmed|Estimated Arrival|In Transit|Customs Cleared|Delivered/);
});

test("validates withdrawal reason", () => {
  assert.deepEqual(validateLogisticsWithdrawalReason(""), ["Withdrawal reason is required."]);
  assert.deepEqual(validateLogisticsWithdrawalReason("Plan changed"), []);
});
