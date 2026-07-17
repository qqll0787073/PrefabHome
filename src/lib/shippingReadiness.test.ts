import assert from "node:assert/strict";
import test from "node:test";
import {
  canCancelShippingReadiness,
  canCreateShippingReadiness,
  canMarkShippingReady,
  emptyShippingReadinessDraftValues,
  isShippingReadinessReadOnly,
  normalizeShippingAddress,
  shippingEventLabel,
  shippingPlanningDisclaimer,
  shippingReadyConfirmationText,
  shippingStatusLabels,
  validateShippingCancellationReason,
  validateShippingReadinessDraft,
} from "./shippingReadiness";
import type {
  ContractRecord,
  InvoiceRecord,
  PurchaseOrderRecord,
  ShippingReadinessEventRecord,
  ShippingReadinessRecord,
} from "../types";

function dateInput(daysFromToday: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return date.toISOString().slice(0, 10);
}

const purchaseOrder = {
  id: "po-1",
  status: "confirmed",
} as PurchaseOrderRecord;

const contract = {
  id: "contract-1",
  purchase_order_id: "po-1",
  status: "accepted",
} as ContractRecord;

const invoice = {
  id: "invoice-1",
  purchase_order_id: "po-1",
  status: "issued",
} as InvoiceRecord;

const shippingRecord = {
  id: "shipping-1",
  shipping_number: "SHP-2026-000001",
  purchase_order_id: "po-1",
  purchase_order_number: "PO-2026-000001",
  contract_id: "contract-1",
  contract_number: "CON-2026-000001",
  invoice_id: "invoice-1",
  invoice_number: "INV-2026-000001",
  buyer_id: "buyer-1",
  manufacturer_id: "manufacturer-1",
  status: "shipping_draft",
  version: 1,
  shipping_mode: "ocean",
  incoterm: "FOB",
  origin_country_code: "CN",
  origin_address: null,
  destination_country_code: "US",
  destination_address: null,
  cargo_description: null,
  package_count: null,
  gross_weight_kg: null,
  volume_cbm: null,
  requested_ship_date: null,
  estimated_ready_date: null,
  special_instructions: null,
  purchase_order_snapshot: {},
  contract_snapshot: {},
  invoice_snapshot: {},
  party_snapshot: {},
  cargo_snapshot: {},
  readiness_snapshot: {},
  created_by: "manufacturer-user",
  ready_at: null,
  cancelled_at: null,
  cancellation_reason: null,
  created_at: "2026-07-16T00:00:00.000Z",
  updated_at: "2026-07-16T00:00:00.000Z",
} satisfies ShippingReadinessRecord;

const completeValues = {
  shippingMode: "ocean" as const,
  incoterm: "FOB" as const,
  originAddressLine1: "Factory Road 1",
  originAddressLine2: "",
  originCity: "Qingdao",
  originStateRegion: "Shandong",
  originPostalCode: "266000",
  originCountryCode: "cn",
  destinationAddressLine1: "1 Port Way",
  destinationAddressLine2: "",
  destinationCity: "Los Angeles",
  destinationStateRegion: "CA",
  destinationPostalCode: "90001",
  destinationCountryCode: "us",
  cargoDescription: "Prefab home modules",
  packageCount: "4",
  grossWeightKg: "12000",
  volumeCbm: "88.5",
  requestedShipDate: dateInput(21),
  estimatedReadyDate: dateInput(14),
  specialInstructions: "Coordinate internal readiness handoff.",
};

test("allows creation only for confirmed PO with accepted contract and issued invoice", () => {
  assert.equal(canCreateShippingReadiness(purchaseOrder, [contract], [invoice], []), true);
  assert.equal(canCreateShippingReadiness({ ...purchaseOrder, status: "submitted" }, [contract], [invoice], []), false);
  assert.equal(canCreateShippingReadiness(purchaseOrder, [{ ...contract, status: "ready" }], [invoice], []), false);
  assert.equal(canCreateShippingReadiness(purchaseOrder, [contract], [{ ...invoice, status: "draft" }], []), false);
  assert.equal(canCreateShippingReadiness(purchaseOrder, [contract], [invoice], [{ purchase_order_id: "po-1" }]), false);
});

test("normalizes supported shipping address fields", () => {
  assert.deepEqual(normalizeShippingAddress({
    addressLine1: "  Factory Road 1  ",
    addressLine2: "  ",
    city: " Qingdao ",
    stateRegion: " Shandong ",
    postalCode: " 266000 ",
    countryCode: " cn ",
  }), {
    address_line1: "Factory Road 1",
    city: "Qingdao",
    state_region: "Shandong",
    postal_code: "266000",
    country_code: "CN",
  });
  assert.equal(normalizeShippingAddress({
    addressLine1: "",
    addressLine2: "",
    city: "",
    stateRegion: "",
    postalCode: "",
    countryCode: "",
  }), null);
});

test("allows partial drafts while enforcing ready requirements", () => {
  assert.deepEqual(validateShippingReadinessDraft({
    ...completeValues,
    originAddressLine1: "",
    cargoDescription: "",
    packageCount: "",
    requestedShipDate: "",
  }), []);
  const readyErrors = validateShippingReadinessDraft({
    ...completeValues,
    originAddressLine1: "",
    cargoDescription: "",
    packageCount: "",
    requestedShipDate: "",
  }, true);
  assert.equal(readyErrors.includes("Origin address line 1 is required."), true);
  assert.equal(readyErrors.includes("Cargo description is required."), true);
  assert.equal(readyErrors.includes("Package count is required."), true);
  assert.equal(readyErrors.includes("Requested ship date is required."), true);
});

test("validates cargo and planning dates", () => {
  assert.deepEqual(validateShippingReadinessDraft(completeValues, true), []);
  assert.equal(validateShippingReadinessDraft({ ...completeValues, packageCount: "1.5" }, true).includes("Package count must be a whole number greater than zero."), true);
  assert.equal(validateShippingReadinessDraft({ ...completeValues, grossWeightKg: "0" }, true).includes("Gross weight must be greater than zero."), true);
  assert.equal(validateShippingReadinessDraft({ ...completeValues, volumeCbm: "-1" }, true).includes("Volume must be greater than zero."), true);
  assert.equal(validateShippingReadinessDraft({ ...completeValues, estimatedReadyDate: dateInput(-1) }).includes("Estimated ready date cannot be in the past."), true);
  assert.equal(validateShippingReadinessDraft({ ...completeValues, requestedShipDate: dateInput(7), estimatedReadyDate: dateInput(14) }).includes("Requested ship date must be on or after estimated ready date."), true);
});

test("maps shipping lifecycle conservatively", () => {
  assert.equal(isShippingReadinessReadOnly(shippingRecord), false);
  assert.equal(canMarkShippingReady(shippingRecord), true);
  assert.equal(canCancelShippingReadiness(shippingRecord), true);
  assert.equal(isShippingReadinessReadOnly({ ...shippingRecord, status: "ready_for_logistics" }), true);
  assert.equal(canMarkShippingReady({ ...shippingRecord, status: "ready_for_logistics" }), false);
  assert.equal(canCancelShippingReadiness({ ...shippingRecord, status: "ready_for_logistics" }), true);
  assert.equal(canCancelShippingReadiness({ ...shippingRecord, status: "cancelled" }), false);
  assert.equal(shippingStatusLabels.ready_for_logistics, "Ready for logistics");
});

test("keeps readiness and confirmation copy away from logistics execution claims", () => {
  const disclaimer = shippingPlanningDisclaimer();
  const confirmation = shippingReadyConfirmationText(shippingRecord);
  assert.equal(disclaimer.includes("complete and frozen only"), true);
  assert.equal(confirmation.includes("Information will be frozen"), true);
  assert.equal(/Track Shipment|Book Shipment|Carrier Confirmed|In Transit|Customs Cleared|Delivered|Live Tracking|Pickup Scheduled|Estimated Arrival/i.test(disclaimer), false);
  assert.equal(/Track Shipment|Book Shipment|Carrier Confirmed|In Transit|Customs Cleared|Delivered|Live Tracking|Pickup Scheduled|Estimated Arrival/i.test(confirmation), false);
});

test("labels events and validates cancellation reasons", () => {
  assert.equal(
    shippingEventLabel({ event_type: "shipping_readiness_marked_ready" } as ShippingReadinessEventRecord),
    "Marked ready for logistics"
  );
  assert.deepEqual(validateShippingCancellationReason(""), ["Cancellation reason is required."]);
  assert.deepEqual(validateShippingCancellationReason("x".repeat(2001)), ["Cancellation reason must be 2000 characters or fewer."]);
  assert.deepEqual(validateShippingCancellationReason("Internal readiness paused."), []);
});

test("initializes editor values from records", () => {
  assert.deepEqual(emptyShippingReadinessDraftValues({
    ...shippingRecord,
    origin_address: { address_line1: "A", city: "B", state_region: "C", postal_code: "D", country_code: "CN" },
    destination_address: { address_line1: "E", city: "F", state_region: "G", postal_code: "H", country_code: "US" },
    package_count: 2,
    gross_weight_kg: 1000,
    volume_cbm: 25,
  }).originCountryCode, "CN");
});
