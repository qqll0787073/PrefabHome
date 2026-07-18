import { supabase } from "./supabase";
import type {
  LogisticsBookingRequestDraftValues,
  LogisticsBookingRequestEventRecord,
  LogisticsBookingRequestEventType,
  LogisticsBookingRequestRecord,
  LogisticsBookingRequestStatus,
  LogisticsContainerPreference,
  LogisticsTransportMode,
  ShippingAddress,
  ShippingIncoterm,
  ShippingReadinessRecord,
} from "../types";

export const logisticsTransportModes: LogisticsTransportMode[] = ["ocean", "air", "truck", "rail", "multimodal", "other"];
export const logisticsIncoterms: ShippingIncoterm[] = ["EXW", "FCA", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP", "OTHER", "UNSPECIFIED"];
export const logisticsContainerPreferences: LogisticsContainerPreference[] = [
  "20ft_standard",
  "40ft_standard",
  "40ft_high_cube",
  "flat_rack",
  "open_top",
  "reefer",
  "less_than_container_load",
  "air_cargo",
  "truckload",
  "less_than_truckload",
  "not_specified",
  "other",
];

export const logisticsBookingStatusLabels: Record<LogisticsBookingRequestStatus, string> = {
  booking_draft: "Draft",
  submitted_for_arrangement: "Submitted for arrangement",
  carrier_options_available: "Provider options available",
  carrier_selected: "Provider selected",
  ready_for_external_booking: "Ready for external booking",
  withdrawn: "Withdrawn",
};

export const logisticsBookingEventLabels: Record<LogisticsBookingRequestEventType, string> = {
  booking_request_created: "Booking request created",
  booking_request_updated: "Booking request draft updated",
  booking_request_submitted: "Submitted for arrangement",
  booking_request_withdrawn: "Booking request withdrawn",
};

export const logisticsContainerPreferenceLabels: Record<LogisticsContainerPreference, string> = {
  "20ft_standard": "20ft standard",
  "40ft_standard": "40ft standard",
  "40ft_high_cube": "40ft high cube",
  flat_rack: "Flat rack",
  open_top: "Open top",
  reefer: "Reefer",
  less_than_container_load: "Less than container load",
  air_cargo: "Air cargo",
  truckload: "Truckload",
  less_than_truckload: "Less than truckload",
  not_specified: "Not specified",
  other: "Other",
};

export function logisticsPlanningDisclaimer(): string {
  return "Submitted for arrangement means internal planning information was sent for coordination only. No carrier or freight forwarder is selected, no cargo space or equipment is reserved, no pickup is scheduled, no booking is confirmed, no shipment is dispatched or in transit, no customs clearance is completed, and no delivery is completed.";
}

export function logisticsSubmitConfirmationText(record: LogisticsBookingRequestRecord): string {
  return `Submit ${record.booking_request_number} for logistics arrangement? This does not select a carrier, reserve cargo space, schedule pickup, confirm booking, dispatch a shipment, clear customs, or complete delivery.`;
}

export function logisticsWithdrawConfirmationText(): string {
  return "Withdraw this internal booking request? This does not cancel any external arrangement made outside the platform.";
}

function ensureSupabase() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

function dateInputIsPast(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  const input = new Date(Number(year), Number(month) - 1, Number(day));
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return input < today;
}

export function normalizeLogisticsLocation(values: {
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  countryCode: string;
}): ShippingAddress | null {
  const location: ShippingAddress = {};
  const line1 = values.addressLine1.trim();
  const line2 = values.addressLine2.trim();
  const city = values.city.trim();
  const stateRegion = values.stateRegion.trim();
  const postalCode = values.postalCode.trim();
  const countryCode = values.countryCode.trim().toUpperCase();
  if (line1) location.address_line1 = line1;
  if (line2) location.address_line2 = line2;
  if (city) location.city = city;
  if (stateRegion) location.state_region = stateRegion;
  if (postalCode) location.postal_code = postalCode;
  if (countryCode) location.country_code = countryCode;
  return Object.keys(location).length > 0 ? location : null;
}

function validateLocation(label: string, location: ShippingAddress | null, requireComplete: boolean): string[] {
  const errors: string[] = [];
  if (!location) {
    if (requireComplete) errors.push(`${label} location is required.`);
    return errors;
  }
  if (location.address_line1 && location.address_line1.length > 200) errors.push(`${label} address line 1 must be 200 characters or fewer.`);
  if (location.address_line2 && location.address_line2.length > 200) errors.push(`${label} address line 2 must be 200 characters or fewer.`);
  if (location.city && location.city.length > 120) errors.push(`${label} city must be 120 characters or fewer.`);
  if (location.state_region && location.state_region.length > 120) errors.push(`${label} state or region must be 120 characters or fewer.`);
  if (location.postal_code && location.postal_code.length > 32) errors.push(`${label} postal code must be 32 characters or fewer.`);
  if (location.country_code && !/^[A-Z]{2}$/.test(location.country_code)) errors.push(`${label} country code must be exactly two letters.`);
  if (requireComplete) {
    if (!location.address_line1) errors.push(`${label} address line 1 is required.`);
    if (!location.city) errors.push(`${label} city is required.`);
    if (!location.state_region) errors.push(`${label} state or region is required.`);
    if (!location.postal_code) errors.push(`${label} postal code is required.`);
    if (!location.country_code) errors.push(`${label} country code is required.`);
  }
  return errors;
}

export function emptyLogisticsBookingRequestDraftValues(record?: LogisticsBookingRequestRecord | null): LogisticsBookingRequestDraftValues {
  return {
    requestedTransportMode: record?.requested_transport_mode ?? "ocean",
    requestedIncoterm: record?.requested_incoterm ?? "UNSPECIFIED",
    preferredDepartureDate: record?.preferred_departure_date ?? "",
    latestAcceptableDepartureDate: record?.latest_acceptable_departure_date ?? "",
    originAddressLine1: record?.origin_location?.address_line1 ?? "",
    originAddressLine2: record?.origin_location?.address_line2 ?? "",
    originCity: record?.origin_location?.city ?? "",
    originStateRegion: record?.origin_location?.state_region ?? "",
    originPostalCode: record?.origin_location?.postal_code ?? "",
    originCountryCode: record?.origin_location?.country_code ?? "",
    destinationAddressLine1: record?.destination_location?.address_line1 ?? "",
    destinationAddressLine2: record?.destination_location?.address_line2 ?? "",
    destinationCity: record?.destination_location?.city ?? "",
    destinationStateRegion: record?.destination_location?.state_region ?? "",
    destinationPostalCode: record?.destination_location?.postal_code ?? "",
    destinationCountryCode: record?.destination_location?.country_code ?? "",
    containerPreference: record?.container_preference ?? "not_specified",
    equipmentNotes: record?.equipment_notes ?? "",
    handlingRequirements: record?.handling_requirements ?? "",
    bookingNotes: record?.booking_notes ?? "",
  };
}

export function validateLogisticsBookingDraft(values: LogisticsBookingRequestDraftValues, requireSubmit = false): string[] {
  const errors: string[] = [];
  const origin = normalizeLogisticsLocation({
    addressLine1: values.originAddressLine1,
    addressLine2: values.originAddressLine2,
    city: values.originCity,
    stateRegion: values.originStateRegion,
    postalCode: values.originPostalCode,
    countryCode: values.originCountryCode,
  });
  const destination = normalizeLogisticsLocation({
    addressLine1: values.destinationAddressLine1,
    addressLine2: values.destinationAddressLine2,
    city: values.destinationCity,
    stateRegion: values.destinationStateRegion,
    postalCode: values.destinationPostalCode,
    countryCode: values.destinationCountryCode,
  });
  if (!logisticsTransportModes.includes(values.requestedTransportMode)) errors.push("Choose a supported transport mode.");
  if (!logisticsIncoterms.includes(values.requestedIncoterm)) errors.push("Choose a supported Incoterm.");
  if (!logisticsContainerPreferences.includes(values.containerPreference)) errors.push("Choose a supported container preference.");
  errors.push(...validateLocation("Origin", origin, requireSubmit));
  errors.push(...validateLocation("Destination", destination, requireSubmit));
  if (values.equipmentNotes.trim().length > 2000) errors.push("Equipment notes must be 2000 characters or fewer.");
  if (values.handlingRequirements.trim().length > 2000) errors.push("Handling requirements must be 2000 characters or fewer.");
  if (values.bookingNotes.trim().length > 2000) errors.push("Booking notes must be 2000 characters or fewer.");
  if (values.preferredDepartureDate && Number.isNaN(Date.parse(values.preferredDepartureDate))) errors.push("Preferred departure date must be valid.");
  if (values.latestAcceptableDepartureDate && Number.isNaN(Date.parse(values.latestAcceptableDepartureDate))) errors.push("Latest acceptable departure date must be valid.");
  if (values.preferredDepartureDate && !Number.isNaN(Date.parse(values.preferredDepartureDate)) && dateInputIsPast(values.preferredDepartureDate)) errors.push("Preferred departure date cannot be in the past.");
  if (values.latestAcceptableDepartureDate && !Number.isNaN(Date.parse(values.latestAcceptableDepartureDate)) && dateInputIsPast(values.latestAcceptableDepartureDate)) errors.push("Latest acceptable departure date cannot be in the past.");
  if (values.preferredDepartureDate && values.latestAcceptableDepartureDate && new Date(values.latestAcceptableDepartureDate) < new Date(values.preferredDepartureDate)) {
    errors.push("Latest acceptable departure date must be on or after preferred departure date.");
  }
  if (requireSubmit) {
    if (!values.preferredDepartureDate) errors.push("Preferred departure date is required.");
    if (!values.latestAcceptableDepartureDate) errors.push("Latest acceptable departure date is required.");
  }
  return errors;
}

export function canCreateLogisticsBookingRequest(record: Pick<ShippingReadinessRecord, "id" | "status">, requests: Pick<LogisticsBookingRequestRecord, "shipping_readiness_id">[] = []): boolean {
  return record.status === "ready_for_logistics" && !requests.some((request) => request.shipping_readiness_id === record.id);
}

export function isLogisticsBookingRequestReadOnly(record: Pick<LogisticsBookingRequestRecord, "status">): boolean {
  return record.status !== "booking_draft";
}

export function canSubmitLogisticsBookingRequest(record: Pick<LogisticsBookingRequestRecord, "status">): boolean {
  return record.status === "booking_draft";
}

export function canWithdrawLogisticsBookingRequest(record: Pick<LogisticsBookingRequestRecord, "status">): boolean {
  return record.status === "booking_draft" || record.status === "submitted_for_arrangement";
}

export function validateLogisticsWithdrawalReason(reason: string): string[] {
  const errors: string[] = [];
  if (!reason.trim()) errors.push("Withdrawal reason is required.");
  if (reason.length > 2000) errors.push("Withdrawal reason must be 2000 characters or fewer.");
  return errors;
}

function requestPayload(values: LogisticsBookingRequestDraftValues) {
  return {
    requested_transport_mode_value: values.requestedTransportMode,
    requested_incoterm_value: values.requestedIncoterm,
    preferred_departure_date_value: values.preferredDepartureDate || null,
    latest_acceptable_departure_date_value: values.latestAcceptableDepartureDate || null,
    origin_location_value: normalizeLogisticsLocation({
      addressLine1: values.originAddressLine1,
      addressLine2: values.originAddressLine2,
      city: values.originCity,
      stateRegion: values.originStateRegion,
      postalCode: values.originPostalCode,
      countryCode: values.originCountryCode,
    }),
    destination_location_value: normalizeLogisticsLocation({
      addressLine1: values.destinationAddressLine1,
      addressLine2: values.destinationAddressLine2,
      city: values.destinationCity,
      stateRegion: values.destinationStateRegion,
      postalCode: values.destinationPostalCode,
      countryCode: values.destinationCountryCode,
    }),
    container_preference_value: values.containerPreference,
    equipment_notes_text: values.equipmentNotes.trim() || null,
    handling_requirements_text: values.handlingRequirements.trim() || null,
    booking_notes_text: values.bookingNotes.trim() || null,
  };
}

export async function createLogisticsBookingRequest(shippingReadinessId: string): Promise<LogisticsBookingRequestRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("create_logistics_booking_request", { shipping_readiness_uuid: shippingReadinessId });
  if (error) throw new Error(error.message);
  return data as LogisticsBookingRequestRecord;
}

export async function updateLogisticsBookingRequestDraft(id: string, values: LogisticsBookingRequestDraftValues): Promise<LogisticsBookingRequestRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("update_logistics_booking_request_draft", { booking_request_uuid: id, ...requestPayload(values) });
  if (error) throw new Error(error.message);
  return data as LogisticsBookingRequestRecord;
}

export async function submitLogisticsBookingRequest(id: string): Promise<LogisticsBookingRequestRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("submit_logistics_booking_request", { booking_request_uuid: id });
  if (error) throw new Error(error.message);
  return data as LogisticsBookingRequestRecord;
}

export async function withdrawLogisticsBookingRequest(id: string, reason: string): Promise<LogisticsBookingRequestRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("withdraw_logistics_booking_request", { booking_request_uuid: id, reason_text: reason.trim() });
  if (error) throw new Error(error.message);
  return data as LogisticsBookingRequestRecord;
}

async function fetchRequests(): Promise<LogisticsBookingRequestRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("logistics_booking_requests").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LogisticsBookingRequestRecord[];
}

export async function fetchManufacturerBookingRequests(): Promise<LogisticsBookingRequestRecord[]> {
  return fetchRequests();
}

export async function fetchBuyerBookingRequests(): Promise<LogisticsBookingRequestRecord[]> {
  return fetchRequests();
}

export async function fetchAdminBookingRequests(): Promise<LogisticsBookingRequestRecord[]> {
  return fetchRequests();
}

export async function fetchLogisticsBookingRequestEvents(id: string): Promise<LogisticsBookingRequestEventRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("logistics_booking_request_events").select("*").eq("booking_request_id", id).order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as LogisticsBookingRequestEventRecord[];
}
