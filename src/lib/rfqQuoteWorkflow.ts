import type {
  RFQQuoteStatus,
  RFQQuoteWithItems,
  RFQStatus,
  RFQWithDetails,
  Role,
} from "../types";

export type RFQWorkflowAction =
  | "edit"
  | "submit"
  | "cancel"
  | "delete"
  | "open_manufacturer_review"
  | "open_quote"
  | "accept_quote"
  | "reject_quote"
  | "request_revision";

export type QuoteWorkflowAction =
  | "edit"
  | "submit"
  | "delete"
  | "create_revision"
  | "accept"
  | "reject"
  | "request_revision";

export const terminalRFQStatuses: readonly RFQStatus[] = [
  "accepted",
  "declined",
  "expired",
  "cancelled",
];

export const terminalQuoteStatuses: readonly RFQQuoteStatus[] = [
  "superseded",
  "accepted",
  "rejected",
  "expired",
  "withdrawn",
];

const roleRFQTransitions: Record<Role, Partial<Record<RFQStatus, readonly RFQStatus[]>>> = {
  buyer: {
    draft: ["submitted", "cancelled"],
    submitted: ["cancelled"],
    quoted: ["buyer_review", "accepted", "declined", "revision_requested"],
    buyer_review: ["accepted", "declined", "revision_requested"],
  },
  manufacturer: {
    submitted: ["manufacturer_review"],
    manufacturer_review: ["quoted"],
    revision_requested: ["quoted"],
  },
  admin: {},
};

const roleQuoteTransitions: Record<Role, Partial<Record<RFQQuoteStatus, readonly RFQQuoteStatus[]>>> = {
  buyer: {
    submitted: ["accepted", "rejected", "revision_requested"],
  },
  manufacturer: {
    draft: ["submitted"],
  },
  admin: {},
};

export function isTerminalRFQStatus(status: RFQStatus): boolean {
  return terminalRFQStatuses.includes(status);
}

export function isTerminalQuoteStatus(status: RFQQuoteStatus): boolean {
  return terminalQuoteStatuses.includes(status);
}

export function canTransitionRfq(role: Role, from: RFQStatus, to: RFQStatus): boolean {
  return roleRFQTransitions[role][from]?.includes(to) ?? false;
}

export function canTransitionQuote(
  role: Role,
  from: RFQQuoteStatus,
  to: RFQQuoteStatus,
): boolean {
  return roleQuoteTransitions[role][from]?.includes(to) ?? false;
}

export function availableRfqActions(role: Role, status: RFQStatus): RFQWorkflowAction[] {
  if (role === "buyer") {
    if (status === "draft") return ["edit", "submit", "cancel", "delete"];
    if (status === "submitted") return ["cancel"];
    if (status === "quoted") return ["open_quote", "accept_quote", "reject_quote", "request_revision"];
    if (status === "buyer_review") return ["accept_quote", "reject_quote", "request_revision"];
    return [];
  }

  if (role === "manufacturer") {
    if (status === "submitted") return ["open_manufacturer_review"];
    return [];
  }

  return [];
}

export function availableQuoteActions(
  role: Role,
  status: RFQQuoteStatus,
  rfqStatus?: RFQStatus,
): QuoteWorkflowAction[] {
  if (role === "manufacturer") {
    if (status === "draft") return ["edit", "submit", "delete"];
    if (status === "revision_requested" && rfqStatus === "revision_requested") {
      return ["create_revision"];
    }
    return [];
  }

  const buyerReviewStatus = rfqStatus === "quoted" || rfqStatus === "buyer_review";
  if (role === "buyer" && status === "submitted" && buyerReviewStatus) {
    return ["accept", "reject", "request_revision"];
  }

  return [];
}

export function userCanViewRfq(
  role: Role,
  userId: string,
  rfq: Pick<RFQWithDetails, "buyer_id" | "manufacturer_id">,
  ownedManufacturerIds: readonly string[] = [],
): boolean {
  if (role === "admin") return true;
  if (role === "buyer") return rfq.buyer_id === userId;
  return ownedManufacturerIds.includes(rfq.manufacturer_id);
}

export function userCanViewQuote(
  role: Role,
  quote: Pick<RFQQuoteWithItems, "manufacturer_id" | "status">,
  canViewParentRfq: boolean,
  ownedManufacturerIds: readonly string[] = [],
): boolean {
  if (!canViewParentRfq) return false;
  if (role === "admin") return true;
  if (role === "buyer") return quote.status !== "draft";
  return ownedManufacturerIds.includes(quote.manufacturer_id);
}

export const liveRecordIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isLiveRecordId(value: string): boolean {
  return liveRecordIdPattern.test(value.trim());
}

export function assertLiveRecordId(value: string, label: string): void {
  if (!isLiveRecordId(value)) {
    throw new Error(`${label} is not a valid live record identifier.`);
  }
}

export interface QuoteComparisonModel {
  quotes: RFQQuoteWithItems[];
  warnings: string[];
}

function distinct(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export function buildQuoteComparison(quotes: RFQQuoteWithItems[]): QuoteComparisonModel {
  const visible = [...quotes]
    .filter((quote) => quote.status !== "draft")
    .sort((a, b) => b.version - a.version);
  const warnings: string[] = [];
  const rfqIds = distinct(visible.map((quote) => quote.rfq_id));
  const manufacturerIds = distinct(visible.map((quote) => quote.manufacturer_id));
  const currencies = distinct(visible.map((quote) => quote.currency));
  const incoterms = distinct(visible.map((quote) => quote.incoterm));
  const freightScopes = new Set(
    visible.map((quote) => quote.items.some((item) => item.item_type === "freight")),
  );

  if (rfqIds.length > 1 || manufacturerIds.length > 1) {
    return {
      quotes: [],
      warnings: ["Quotes from different RFQs or manufacturers cannot be compared in this workspace."],
    };
  }

  if (currencies.length > 1) {
    warnings.push("Currencies differ. Amounts are shown as quoted without exchange-rate conversion.");
  }
  if (incoterms.length > 1 || (visible.length > 1 && visible.some((quote) => !quote.incoterm))) {
    warnings.push("Incoterms differ or are unspecified. Review each version's commercial terms.");
  }
  if (freightScopes.size > 1) {
    warnings.push("Freight line-item scope differs. This is not an explicit shipping-inclusion guarantee.");
  } else if (visible.length > 0) {
    warnings.push("Shipping inclusion is not a dedicated quote field; review line items and notes.");
  }

  return { quotes: visible, warnings };
}
