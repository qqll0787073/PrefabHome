import { supabase } from "./supabase";
import type {
  LogisticsArrangementEventRecord,
  LogisticsBookingRequestRecord,
  LogisticsProviderCandidateRecord,
  LogisticsProviderCandidateValues,
  LogisticsProviderSelectionRecord,
  LogisticsProviderType,
} from "../types";

export const logisticsProviderTypes: LogisticsProviderType[] = [
  "carrier",
  "freight_forwarder",
  "broker",
  "multimodal_operator",
  "other",
];

export const logisticsProviderTypeLabels: Record<LogisticsProviderType, string> = {
  carrier: "Carrier",
  freight_forwarder: "Freight forwarder",
  broker: "Broker",
  multimodal_operator: "Multimodal operator",
  other: "Other",
};

export const logisticsArrangementEventLabels = {
  candidate_created: "Provider candidate created",
  candidate_updated: "Provider candidate updated",
  candidate_withdrawn: "Provider candidate withdrawn",
  carrier_options_available: "Carrier options available",
  provider_selected: "Provider selected",
  provider_selection_changed: "Provider selection changed",
  provider_selection_cancelled: "Provider selection cancelled",
  ready_for_external_booking: "Ready for external booking",
} as const;

export function logisticsArrangementNotice(): string {
  return "Internal planning only. A selected provider is not an external booking, cargo reservation, pickup appointment, dispatch, tracking event, customs filing, or delivery confirmation.";
}

export function emptyLogisticsProviderCandidateValues(
  candidate?: LogisticsProviderCandidateRecord | null,
): LogisticsProviderCandidateValues {
  return {
    providerName: candidate?.provider_name ?? "",
    providerType: candidate?.provider_type ?? "carrier",
    serviceLevel: candidate?.service_level ?? "",
    estimatedDepartureDate: candidate?.estimated_departure_date ?? "",
    estimatedArrivalDate: candidate?.estimated_arrival_date ?? "",
    estimatedTransitDays: candidate?.estimated_transit_days?.toString() ?? "",
    estimatedCost: candidate?.estimated_cost?.toString() ?? "",
    currency: candidate?.currency ?? "",
    quoteReference: candidate?.quote_reference ?? "",
    contactName: candidate?.contact_name ?? "",
    contactEmail: candidate?.contact_email ?? "",
    contactPhone: candidate?.contact_phone ?? "",
    notes: candidate?.notes ?? "",
  };
}

export function validateLogisticsProviderCandidate(values: LogisticsProviderCandidateValues): string[] {
  const errors: string[] = [];
  if (!values.providerName.trim()) errors.push("Provider name is required.");
  if (values.providerName.trim().length > 200) errors.push("Provider name must be 200 characters or fewer.");
  if (!logisticsProviderTypes.includes(values.providerType)) errors.push("Choose a supported provider type.");
  if (values.serviceLevel.trim().length > 160) errors.push("Service level must be 160 characters or fewer.");
  if (values.currency.trim() && !/^[A-Za-z]{3}$/.test(values.currency.trim())) errors.push("Currency must be a three-letter code.");
  const transitDays = values.estimatedTransitDays.trim() ? Number(values.estimatedTransitDays) : null;
  if (transitDays !== null && (!Number.isInteger(transitDays) || transitDays < 0 || transitDays > 3650)) errors.push("Estimated transit days must be a whole number from 0 to 3650.");
  const cost = values.estimatedCost.trim() ? Number(values.estimatedCost) : null;
  if (cost !== null && (!Number.isFinite(cost) || cost < 0)) errors.push("Estimated cost must be zero or greater.");
  if (values.estimatedDepartureDate && values.estimatedArrivalDate && values.estimatedArrivalDate < values.estimatedDepartureDate) errors.push("Estimated arrival cannot be before estimated departure.");
  if (values.quoteReference.trim().length > 160) errors.push("Quote reference must be 160 characters or fewer.");
  if (values.contactName.trim().length > 160) errors.push("Contact name must be 160 characters or fewer.");
  if (values.contactEmail.trim().length > 320) errors.push("Contact email must be 320 characters or fewer.");
  if (values.contactPhone.trim().length > 80) errors.push("Contact phone must be 80 characters or fewer.");
  if (values.notes.trim().length > 4000) errors.push("Notes must be 4000 characters or fewer.");
  return errors;
}

export function canManageProviderCandidates(request: Pick<LogisticsBookingRequestRecord, "status">): boolean {
  return request.status === "submitted_for_arrangement" || request.status === "carrier_options_available" || request.status === "carrier_selected";
}

export function canSelectProviderCandidate(candidate: Pick<LogisticsProviderCandidateRecord, "candidate_status">): boolean {
  return candidate.candidate_status === "active";
}

export function selectedProviderCandidate(
  candidates: LogisticsProviderCandidateRecord[],
  selections: LogisticsProviderSelectionRecord[],
): LogisticsProviderCandidateRecord | null {
  const current = selections.find((selection) => selection.selection_status === "selected");
  return current ? candidates.find((candidate) => candidate.id === current.selected_candidate_id) ?? null : null;
}

export function canMarkReadyForExternalBooking(
  request: Pick<LogisticsBookingRequestRecord, "status">,
  candidate: LogisticsProviderCandidateRecord | null,
): boolean {
  return request.status === "carrier_selected"
    && candidate?.candidate_status === "selected"
    && Boolean(candidate.estimated_departure_date)
    && Boolean(candidate.estimated_arrival_date)
    && candidate.estimated_transit_days !== null
    && candidate.estimated_cost !== null
    && Boolean(candidate.currency);
}

function ensureSupabase() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

function candidatePayload(values: LogisticsProviderCandidateValues) {
  return {
    provider_name_value: values.providerName.trim(),
    provider_type_value: values.providerType,
    service_level_value: values.serviceLevel.trim() || null,
    estimated_departure_date_value: values.estimatedDepartureDate || null,
    estimated_arrival_date_value: values.estimatedArrivalDate || null,
    estimated_transit_days_value: values.estimatedTransitDays.trim() ? Number(values.estimatedTransitDays) : null,
    estimated_cost_value: values.estimatedCost.trim() ? Number(values.estimatedCost) : null,
    currency_value: values.currency.trim().toUpperCase() || null,
    quote_reference_value: values.quoteReference.trim() || null,
    contact_name_value: values.contactName.trim() || null,
    contact_email_value: values.contactEmail.trim() || null,
    contact_phone_value: values.contactPhone.trim() || null,
    notes_value: values.notes.trim() || null,
  };
}

export async function fetchLogisticsProviderCandidates(requestId?: string): Promise<LogisticsProviderCandidateRecord[]> {
  if (!supabase) return [];
  let query = supabase.from("logistics_provider_candidates").select("*").order("created_at", { ascending: true });
  if (requestId) query = query.eq("logistics_booking_request_id", requestId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as LogisticsProviderCandidateRecord[];
}

export async function fetchLogisticsProviderSelections(requestId?: string): Promise<LogisticsProviderSelectionRecord[]> {
  if (!supabase) return [];
  let query = supabase.from("logistics_provider_selections").select("*").order("selected_at", { ascending: true });
  if (requestId) query = query.eq("logistics_booking_request_id", requestId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as LogisticsProviderSelectionRecord[];
}

export async function fetchLogisticsArrangementEvents(requestId?: string): Promise<LogisticsArrangementEventRecord[]> {
  if (!supabase) return [];
  let query = supabase.from("logistics_arrangement_events").select("*").order("created_at", { ascending: true });
  if (requestId) query = query.eq("logistics_booking_request_id", requestId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as LogisticsArrangementEventRecord[];
}

export async function createLogisticsProviderCandidate(requestId: string, values: LogisticsProviderCandidateValues): Promise<LogisticsProviderCandidateRecord> {
  const { data, error } = await ensureSupabase().rpc("admin_create_logistics_provider_candidate", { booking_request_uuid: requestId, ...candidatePayload(values) });
  if (error) throw new Error(error.message);
  return data as LogisticsProviderCandidateRecord;
}

export async function updateLogisticsProviderCandidate(candidateId: string, values: LogisticsProviderCandidateValues): Promise<LogisticsProviderCandidateRecord> {
  const { data, error } = await ensureSupabase().rpc("admin_update_logistics_provider_candidate", { candidate_uuid: candidateId, ...candidatePayload(values) });
  if (error) throw new Error(error.message);
  return data as LogisticsProviderCandidateRecord;
}

export async function withdrawLogisticsProviderCandidate(candidateId: string, reason: string): Promise<LogisticsProviderCandidateRecord> {
  const { data, error } = await ensureSupabase().rpc("admin_withdraw_logistics_provider_candidate", { candidate_uuid: candidateId, reason_text: reason.trim() });
  if (error) throw new Error(error.message);
  return data as LogisticsProviderCandidateRecord;
}

export async function selectLogisticsProviderCandidate(requestId: string, candidateId: string, reason: string, replaceExisting: boolean): Promise<LogisticsProviderSelectionRecord> {
  const { data, error } = await ensureSupabase().rpc("admin_select_logistics_provider_candidate", { booking_request_uuid: requestId, candidate_uuid: candidateId, reason_text: reason.trim() || null, replace_existing: replaceExisting });
  if (error) throw new Error(error.message);
  return data as LogisticsProviderSelectionRecord;
}

export async function cancelLogisticsProviderSelection(requestId: string, reason: string): Promise<LogisticsProviderSelectionRecord> {
  const { data, error } = await ensureSupabase().rpc("admin_cancel_logistics_provider_selection", { booking_request_uuid: requestId, reason_text: reason.trim() });
  if (error) throw new Error(error.message);
  return data as LogisticsProviderSelectionRecord;
}

export async function markReadyForExternalBooking(requestId: string): Promise<LogisticsBookingRequestRecord> {
  const { data, error } = await ensureSupabase().rpc("admin_mark_ready_for_external_booking", { booking_request_uuid: requestId });
  if (error) throw new Error(error.message);
  return data as LogisticsBookingRequestRecord;
}
