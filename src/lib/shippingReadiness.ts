import { supabase } from "./supabase";
import type {
  ContractRecord,
  InvoiceRecord,
  PurchaseOrderRecord,
  ShippingAddress,
  ShippingIncoterm,
  ShippingMode,
  ShippingReadinessDraftValues,
  ShippingReadinessEventRecord,
  ShippingReadinessEventType,
  ShippingReadinessRecord,
  ShippingReadinessStatus,
} from "../types";

export const shippingModes: ShippingMode[] = ["ocean", "air", "truck", "rail", "multimodal", "other"];

export const shippingIncoterms: ShippingIncoterm[] = [
  "EXW",
  "FCA",
  "FOB",
  "CFR",
  "CIF",
  "CPT",
  "CIP",
  "DAP",
  "DPU",
  "DDP",
  "OTHER",
  "UNSPECIFIED",
];

export const shippingStatusLabels: Record<ShippingReadinessStatus, string> = {
  shipping_draft: "Draft",
  ready_for_logistics: "Ready for logistics",
  cancelled: "Cancelled",
};

export const shippingModeLabels: Record<ShippingMode, string> = {
  ocean: "Ocean",
  air: "Air",
  truck: "Truck",
  rail: "Rail",
  multimodal: "Multimodal",
  other: "Other",
};

export const shippingIncotermLabels: Record<ShippingIncoterm, string> = {
  EXW: "EXW",
  FCA: "FCA",
  FOB: "FOB",
  CFR: "CFR",
  CIF: "CIF",
  CPT: "CPT",
  CIP: "CIP",
  DAP: "DAP",
  DPU: "DPU",
  DDP: "DDP",
  OTHER: "Other",
  UNSPECIFIED: "Unspecified",
};

export const shippingEventLabels: Record<ShippingReadinessEventType, string> = {
  shipping_readiness_created: "Shipping readiness created",
  shipping_readiness_updated: "Shipping readiness draft updated",
  shipping_readiness_marked_ready: "Marked ready for logistics",
  shipping_readiness_cancelled: "Shipping readiness cancelled",
};

export const shippingCargoDescriptionMaxLength = 1000;
export const shippingSpecialInstructionsMaxLength = 2000;
export const shippingCancellationReasonMaxLength = 2000;

function ensureSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function isPastDateInput(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  const inputDate = new Date(Number(year), Number(month) - 1, Number(day));
  const today = new Date();
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return inputDate < todayDate;
}

function toReadableShippingError(error: { message?: string }): Error {
  const message = error.message?.toLowerCase() ?? "";

  if (message.includes("row-level security") || message.includes("permission denied") || message.includes("not authorized")) {
    return new Error("You are not authorized to access this shipping readiness record.");
  }
  if (message.includes("confirmed purchase order")) {
    return new Error("Shipping readiness requires a confirmed purchase order.");
  }
  if (message.includes("accepted contract")) {
    return new Error("Shipping readiness requires an accepted contract.");
  }
  if (message.includes("issued invoice")) {
    return new Error("Shipping readiness requires an issued invoice.");
  }
  if (message.includes("already exists")) {
    return new Error("A shipping readiness record already exists for this purchase order.");
  }
  if (message.includes("address")) {
    return new Error("Complete and valid origin and destination addresses are required before marking ready.");
  }
  if (message.includes("cargo") || message.includes("package") || message.includes("weight") || message.includes("volume")) {
    return new Error("Complete cargo details are required before marking ready.");
  }
  if (message.includes("date")) {
    return new Error(error.message ?? "Shipping readiness dates must be valid planning dates.");
  }
  if (message.includes("reason")) {
    return new Error(`Cancellation reason is required and must be ${shippingCancellationReasonMaxLength} characters or fewer.`);
  }

  return new Error(error.message ?? "Unable to manage shipping readiness.");
}

export function shippingPlanningDisclaimer(): string {
  return "Ready for logistics means internal information is complete and frozen only. No carrier is booked, freight forwarder engaged, pickup arranged, shipment dispatched, customs service confirmed, or delivery completed.";
}

export function shippingReadyConfirmationText(record: ShippingReadinessRecord): string {
  return `Mark ${record.shipping_number} ready for logistics? Information will be frozen. No carrier is booked, no freight forwarder is engaged, no pickup is arranged, no shipment is dispatched, and no customs or delivery service is confirmed.`;
}

export function emptyShippingReadinessDraftValues(record?: ShippingReadinessRecord | null): ShippingReadinessDraftValues {
  return {
    shippingMode: record?.shipping_mode ?? "ocean",
    incoterm: record?.incoterm ?? "UNSPECIFIED",
    originAddressLine1: record?.origin_address?.address_line1 ?? "",
    originAddressLine2: record?.origin_address?.address_line2 ?? "",
    originCity: record?.origin_address?.city ?? "",
    originStateRegion: record?.origin_address?.state_region ?? "",
    originPostalCode: record?.origin_address?.postal_code ?? "",
    originCountryCode: record?.origin_address?.country_code ?? "",
    destinationAddressLine1: record?.destination_address?.address_line1 ?? "",
    destinationAddressLine2: record?.destination_address?.address_line2 ?? "",
    destinationCity: record?.destination_address?.city ?? "",
    destinationStateRegion: record?.destination_address?.state_region ?? "",
    destinationPostalCode: record?.destination_address?.postal_code ?? "",
    destinationCountryCode: record?.destination_address?.country_code ?? "",
    cargoDescription: record?.cargo_description ?? "",
    packageCount: record?.package_count == null ? "" : String(record.package_count),
    grossWeightKg: record?.gross_weight_kg == null ? "" : String(record.gross_weight_kg),
    volumeCbm: record?.volume_cbm == null ? "" : String(record.volume_cbm),
    requestedShipDate: record?.requested_ship_date ?? "",
    estimatedReadyDate: record?.estimated_ready_date ?? "",
    specialInstructions: record?.special_instructions ?? "",
  };
}

export function normalizeShippingAddress(values: {
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  countryCode: string;
}): ShippingAddress | null {
  const address: ShippingAddress = {};
  const line1 = values.addressLine1.trim();
  const line2 = values.addressLine2.trim();
  const city = values.city.trim();
  const stateRegion = values.stateRegion.trim();
  const postalCode = values.postalCode.trim();
  const countryCode = values.countryCode.trim().toUpperCase();
  if (line1) address.address_line1 = line1;
  if (line2) address.address_line2 = line2;
  if (city) address.city = city;
  if (stateRegion) address.state_region = stateRegion;
  if (postalCode) address.postal_code = postalCode;
  if (countryCode) address.country_code = countryCode;
  return Object.keys(address).length > 0 ? address : null;
}

function validateAddressFields(prefix: string, address: ShippingAddress | null, requireComplete: boolean): string[] {
  const errors: string[] = [];
  if (!address) {
    if (requireComplete) errors.push(`${prefix} address is required.`);
    return errors;
  }
  if (address.address_line1 && address.address_line1.length > 200) errors.push(`${prefix} address line 1 must be 200 characters or fewer.`);
  if (address.address_line2 && address.address_line2.length > 200) errors.push(`${prefix} address line 2 must be 200 characters or fewer.`);
  if (address.city && address.city.length > 120) errors.push(`${prefix} city must be 120 characters or fewer.`);
  if (address.state_region && address.state_region.length > 120) errors.push(`${prefix} state or region must be 120 characters or fewer.`);
  if (address.postal_code && address.postal_code.length > 32) errors.push(`${prefix} postal code must be 32 characters or fewer.`);
  if (address.country_code && !/^[A-Z]{2}$/.test(address.country_code)) errors.push(`${prefix} country code must be exactly two letters.`);
  if (requireComplete) {
    if (!address.address_line1) errors.push(`${prefix} address line 1 is required.`);
    if (!address.city) errors.push(`${prefix} city is required.`);
    if (!address.state_region) errors.push(`${prefix} state or region is required.`);
    if (!address.postal_code) errors.push(`${prefix} postal code is required.`);
    if (!address.country_code) errors.push(`${prefix} country code is required.`);
  }
  return errors;
}

export function validateShippingReadinessDraft(values: ShippingReadinessDraftValues, requireReady = false): string[] {
  const errors: string[] = [];
  const packageCount = parseOptionalNumber(values.packageCount);
  const grossWeight = parseOptionalNumber(values.grossWeightKg);
  const volume = parseOptionalNumber(values.volumeCbm);
  const origin = normalizeShippingAddress({
    addressLine1: values.originAddressLine1,
    addressLine2: values.originAddressLine2,
    city: values.originCity,
    stateRegion: values.originStateRegion,
    postalCode: values.originPostalCode,
    countryCode: values.originCountryCode,
  });
  const destination = normalizeShippingAddress({
    addressLine1: values.destinationAddressLine1,
    addressLine2: values.destinationAddressLine2,
    city: values.destinationCity,
    stateRegion: values.destinationStateRegion,
    postalCode: values.destinationPostalCode,
    countryCode: values.destinationCountryCode,
  });

  if (!shippingModes.includes(values.shippingMode)) errors.push("Choose a supported shipping mode.");
  if (!shippingIncoterms.includes(values.incoterm)) errors.push("Choose a supported Incoterm.");
  errors.push(...validateAddressFields("Origin", origin, requireReady));
  errors.push(...validateAddressFields("Destination", destination, requireReady));
  if (values.cargoDescription.trim().length > shippingCargoDescriptionMaxLength) {
    errors.push(`Cargo description must be ${shippingCargoDescriptionMaxLength} characters or fewer.`);
  }
  if (values.specialInstructions.trim().length > shippingSpecialInstructionsMaxLength) {
    errors.push(`Special instructions must be ${shippingSpecialInstructionsMaxLength} characters or fewer.`);
  }
  if (Number.isNaN(packageCount)) errors.push("Package count must be a valid number.");
  if (Number.isNaN(grossWeight)) errors.push("Gross weight must be a valid number.");
  if (Number.isNaN(volume)) errors.push("Volume must be a valid number.");
  if (packageCount !== null && !Number.isNaN(packageCount) && (!Number.isInteger(packageCount) || packageCount <= 0)) {
    errors.push("Package count must be a whole number greater than zero.");
  }
  if (grossWeight !== null && !Number.isNaN(grossWeight) && grossWeight <= 0) errors.push("Gross weight must be greater than zero.");
  if (volume !== null && !Number.isNaN(volume) && volume <= 0) errors.push("Volume must be greater than zero.");
  if (values.estimatedReadyDate && Number.isNaN(Date.parse(values.estimatedReadyDate))) errors.push("Estimated ready date must be valid.");
  if (values.requestedShipDate && Number.isNaN(Date.parse(values.requestedShipDate))) errors.push("Requested ship date must be valid.");
  if (values.estimatedReadyDate && !Number.isNaN(Date.parse(values.estimatedReadyDate)) && isPastDateInput(values.estimatedReadyDate)) {
    errors.push("Estimated ready date cannot be in the past.");
  }
  if (values.requestedShipDate && !Number.isNaN(Date.parse(values.requestedShipDate)) && isPastDateInput(values.requestedShipDate)) {
    errors.push("Requested ship date cannot be in the past.");
  }
  if (values.estimatedReadyDate && values.requestedShipDate && new Date(values.requestedShipDate) < new Date(values.estimatedReadyDate)) {
    errors.push("Requested ship date must be on or after estimated ready date.");
  }
  if (requireReady) {
    if (!values.cargoDescription.trim()) errors.push("Cargo description is required.");
    if (packageCount === null) errors.push("Package count is required.");
    if (grossWeight === null) errors.push("Gross weight is required.");
    if (volume === null) errors.push("Volume is required.");
    if (!values.estimatedReadyDate) errors.push("Estimated ready date is required.");
    if (!values.requestedShipDate) errors.push("Requested ship date is required.");
  }
  return errors;
}

export function canCreateShippingReadiness(
  purchaseOrder: Pick<PurchaseOrderRecord, "id" | "status">,
  contracts: Pick<ContractRecord, "purchase_order_id" | "status">[] = [],
  invoices: Pick<InvoiceRecord, "purchase_order_id" | "status">[] = [],
  records: Pick<ShippingReadinessRecord, "purchase_order_id">[] = []
): boolean {
  return (
    purchaseOrder.status === "confirmed" &&
    contracts.some((contract) => contract.purchase_order_id === purchaseOrder.id && contract.status === "accepted") &&
    invoices.some((invoice) => invoice.purchase_order_id === purchaseOrder.id && invoice.status === "issued") &&
    !records.some((record) => record.purchase_order_id === purchaseOrder.id)
  );
}

export function isShippingReadinessReadOnly(record: Pick<ShippingReadinessRecord, "status">): boolean {
  return record.status !== "shipping_draft";
}

export function canMarkShippingReady(record: Pick<ShippingReadinessRecord, "status">): boolean {
  return record.status === "shipping_draft";
}

export function canCancelShippingReadiness(record: Pick<ShippingReadinessRecord, "status">): boolean {
  return record.status === "shipping_draft" || record.status === "ready_for_logistics";
}

export function validateShippingCancellationReason(reason: string): string[] {
  const errors: string[] = [];
  if (!reason.trim()) errors.push("Cancellation reason is required.");
  if (reason.length > shippingCancellationReasonMaxLength) {
    errors.push(`Cancellation reason must be ${shippingCancellationReasonMaxLength} characters or fewer.`);
  }
  return errors;
}

export function shippingEventLabel(event: ShippingReadinessEventRecord): string {
  return shippingEventLabels[event.event_type];
}

export async function createShippingReadiness(purchaseOrderId: string): Promise<ShippingReadinessRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("create_shipping_readiness", { purchase_order_uuid: purchaseOrderId });
  if (error) throw toReadableShippingError(error);
  return data as ShippingReadinessRecord;
}

export async function updateShippingReadinessDraft(id: string, values: ShippingReadinessDraftValues): Promise<ShippingReadinessRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("update_shipping_readiness_draft", {
    shipping_uuid: id,
    shipping_mode_value: values.shippingMode,
    incoterm_value: values.incoterm,
    origin_address_value: normalizeShippingAddress({
      addressLine1: values.originAddressLine1,
      addressLine2: values.originAddressLine2,
      city: values.originCity,
      stateRegion: values.originStateRegion,
      postalCode: values.originPostalCode,
      countryCode: values.originCountryCode,
    }),
    destination_address_value: normalizeShippingAddress({
      addressLine1: values.destinationAddressLine1,
      addressLine2: values.destinationAddressLine2,
      city: values.destinationCity,
      stateRegion: values.destinationStateRegion,
      postalCode: values.destinationPostalCode,
      countryCode: values.destinationCountryCode,
    }),
    cargo_description_text: values.cargoDescription.trim() || null,
    package_count_value: parseOptionalNumber(values.packageCount),
    gross_weight_kg_value: parseOptionalNumber(values.grossWeightKg),
    volume_cbm_value: parseOptionalNumber(values.volumeCbm),
    requested_ship_date_value: values.requestedShipDate || null,
    estimated_ready_date_value: values.estimatedReadyDate || null,
    special_instructions_text: values.specialInstructions.trim() || null,
  });
  if (error) throw toReadableShippingError(error);
  return data as ShippingReadinessRecord;
}

export async function markShippingReadinessReady(id: string): Promise<ShippingReadinessRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("mark_shipping_readiness_ready", { shipping_uuid: id });
  if (error) throw toReadableShippingError(error);
  return data as ShippingReadinessRecord;
}

export async function cancelShippingReadiness(id: string, reason: string): Promise<ShippingReadinessRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("cancel_shipping_readiness", {
    shipping_uuid: id,
    reason_text: reason.trim(),
  });
  if (error) throw toReadableShippingError(error);
  return data as ShippingReadinessRecord;
}

async function fetchShippingReadiness(): Promise<ShippingReadinessRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("shipping_readiness_records")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw toReadableShippingError(error);
  return (data ?? []) as ShippingReadinessRecord[];
}

export async function fetchManufacturerShippingReadiness(): Promise<ShippingReadinessRecord[]> {
  return fetchShippingReadiness();
}

export async function fetchBuyerShippingReadiness(): Promise<ShippingReadinessRecord[]> {
  return fetchShippingReadiness();
}

export async function fetchAdminShippingReadiness(): Promise<ShippingReadinessRecord[]> {
  return fetchShippingReadiness();
}

export async function fetchShippingReadinessEvents(id: string): Promise<ShippingReadinessEventRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("shipping_readiness_events")
    .select("*")
    .eq("shipping_readiness_id", id)
    .order("created_at", { ascending: true });
  if (error) throw toReadableShippingError(error);
  return (data ?? []) as ShippingReadinessEventRecord[];
}
