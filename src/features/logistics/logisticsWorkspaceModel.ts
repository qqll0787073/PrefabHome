import type {
  LogisticsBookingRequestRecord,
  LogisticsBookingRequestStatus,
  LogisticsProviderCandidateRecord,
  ParticipantLogisticsProviderCandidateRecord,
} from "../../types";

export type LogisticsStatusFilter = "all" | LogisticsBookingRequestStatus;

export const participantCandidateFields: Array<keyof ParticipantLogisticsProviderCandidateRecord> = [
  "id",
  "logistics_booking_request_id",
  "provider_name",
  "provider_type",
  "transport_mode",
  "service_level",
  "estimated_departure_date",
  "estimated_arrival_date",
  "estimated_transit_days",
  "estimated_cost",
  "currency",
  "candidate_status",
  "is_selected",
  "public_planning_status",
  "created_at",
  "updated_at",
];

export const participantForbiddenFields = [
  "contact_name",
  "contact_email",
  "contact_phone",
  "quote_reference",
  "notes",
  "actor_profile_id",
  "metadata",
  "version",
] as const;

export function logisticsStatusCounts(requests: Pick<LogisticsBookingRequestRecord, "status">[]) {
  const counts: Record<LogisticsStatusFilter, number> = {
    all: requests.length,
    booking_draft: 0,
    submitted_for_arrangement: 0,
    carrier_options_available: 0,
    carrier_selected: 0,
    ready_for_external_booking: 0,
    withdrawn: 0,
  };
  requests.forEach((request) => { counts[request.status] += 1; });
  return counts;
}

export function filterLogisticsRequests(
  requests: LogisticsBookingRequestRecord[],
  filter: LogisticsStatusFilter,
  search = "",
): LogisticsBookingRequestRecord[] {
  const normalizedSearch = search.trim().toLowerCase();
  return requests
    .filter((request) => filter === "all" || request.status === filter)
    .filter((request) => !normalizedSearch || [
      request.booking_request_number,
      request.shipping_number,
      request.purchase_order_number,
      request.contract_number,
      request.invoice_number,
    ].some((value) => value.toLowerCase().includes(normalizedSearch)))
    .sort((left, right) => right.created_at.localeCompare(left.created_at) || left.booking_request_number.localeCompare(right.booking_request_number));
}

export function reconcileLogisticsRequestId(
  requests: Pick<LogisticsBookingRequestRecord, "id">[],
  selectedRequestId: string | null,
): string | null {
  if (selectedRequestId && requests.some((request) => request.id === selectedRequestId)) return selectedRequestId;
  return requests[0]?.id ?? null;
}

export function logisticsNextStep(status: LogisticsBookingRequestStatus, role: "buyer" | "manufacturer" | "admin"): string {
  const copy: Record<LogisticsBookingRequestStatus, Record<typeof role, string>> = {
    booking_draft: {
      buyer: "The Manufacturer is preparing the booking request.",
      manufacturer: "Complete the required planning fields, then submit the request.",
      admin: "The request remains with the Manufacturer until submission.",
    },
    submitted_for_arrangement: {
      buyer: "The request is awaiting internal provider review.",
      manufacturer: "The request is awaiting Admin provider planning.",
      admin: "Add at least one provider option for participant review.",
    },
    carrier_options_available: {
      buyer: "Provider options are available for planning review.",
      manufacturer: "Provider options are available for planning review.",
      admin: "Review active options and select the preferred provider.",
    },
    carrier_selected: {
      buyer: "A provider is selected for internal planning.",
      manufacturer: "A provider is selected for internal planning.",
      admin: "Complete the selected estimate, then mark it ready for external booking.",
    },
    ready_for_external_booking: {
      buyer: "Planning is ready for a separate external booking process.",
      manufacturer: "Planning is ready for a separate external booking process.",
      admin: "Internal arrangement is complete. No external booking is created by this status.",
    },
    withdrawn: {
      buyer: "This booking request was withdrawn.",
      manufacturer: "This request is closed. Create a new upstream transaction if planning restarts.",
      admin: "This request is closed and has no arrangement actions.",
    },
  };
  return copy[status][role];
}

export function isLogisticsLifecycleConflict(message: string): boolean {
  return /conflict|current arrangement state|already selected|only .* can|cannot be edited|not found/i.test(message);
}

export function participantRecordHasForbiddenFields(record: Record<string, unknown>): boolean {
  return participantForbiddenFields.some((field) => Object.prototype.hasOwnProperty.call(record, field));
}

export function canEditAdminCandidate(
  request: Pick<LogisticsBookingRequestRecord, "status">,
  candidate: Pick<LogisticsProviderCandidateRecord, "candidate_status">,
): boolean {
  return ["carrier_options_available", "carrier_selected"].includes(request.status)
    && ["draft", "active"].includes(candidate.candidate_status);
}

export function describePartialFailure(failedResources: string[]): string {
  if (failedResources.length === 0) return "";
  return `Some logistics details could not be refreshed: ${failedResources.join(", ")}.`;
}
