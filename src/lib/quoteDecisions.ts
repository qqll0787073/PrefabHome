import { supabase } from "./supabase";
import type {
  RFQQuoteDecisionRecord,
  RFQQuoteDecisionValue,
  RFQQuoteWithItems,
  RFQStatus,
} from "../types";

export const quoteDecisionValues: RFQQuoteDecisionValue[] = [
  "accepted",
  "rejected",
  "revision_requested",
];

export const quoteDecisionLabels: Record<RFQQuoteDecisionValue, string> = {
  accepted: "Accepted",
  rejected: "Rejected",
  revision_requested: "Revision requested",
};

export const decisionReasonMaxLength = 4000;

export interface QuoteDecisionPresentation {
  quote: RFQQuoteWithItems;
  decision: RFQQuoteDecisionRecord;
}

function ensureSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

function toReadableDecisionError(error: { message?: string }): Error {
  const message = error.message?.toLowerCase() ?? "";

  if (message.includes("row-level security") || message.includes("permission denied")) {
    return new Error("You are not authorized to review this quote.");
  }

  if (message.includes("revision") && message.includes("reason")) {
    return new Error("Revision requests require a reason.");
  }

  if (message.includes("already has a buyer decision")) {
    return new Error("This quote already has a buyer decision.");
  }

  if (message.includes("current submitted quote")) {
    return new Error("Only the current submitted quote can be reviewed.");
  }

  return new Error(error.message ?? "Unable to review quote.");
}

export function sortQuoteDecisions(
  decisions: RFQQuoteDecisionRecord[]
): RFQQuoteDecisionRecord[] {
  return [...decisions].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function getDecisionForQuote(
  quoteId: string,
  decisions: RFQQuoteDecisionRecord[]
): RFQQuoteDecisionRecord | null {
  return decisions.find((decision) => decision.quote_id === quoteId) ?? null;
}

export function getCurrentQuoteDecision(
  quotes: RFQQuoteWithItems[],
  decisions: RFQQuoteDecisionRecord[]
): RFQQuoteDecisionRecord | null {
  const currentSubmitted = getCurrentSubmittedQuote(quotes);
  return currentSubmitted ? getDecisionForQuote(currentSubmitted.id, decisions) : null;
}

export function getLatestQuoteDecision(
  quotes: RFQQuoteWithItems[],
  decisions: RFQQuoteDecisionRecord[]
): QuoteDecisionPresentation | null {
  const decidedQuotes = quotes
    .map((quote) => ({ quote, decision: getDecisionForQuote(quote.id, decisions) }))
    .filter((item): item is QuoteDecisionPresentation => item.decision !== null)
    .sort((a, b) => {
      if (b.quote.version !== a.quote.version) return b.quote.version - a.quote.version;
      return b.decision.created_at.localeCompare(a.decision.created_at);
    });

  return decidedQuotes[0] ?? null;
}

export function getCurrentSubmittedQuote(
  quotes: RFQQuoteWithItems[]
): RFQQuoteWithItems | null {
  return quotes.find((quote) => quote.status === "submitted") ?? null;
}

export function isCurrentSubmittedQuote(
  quote: RFQQuoteWithItems,
  quotes: RFQQuoteWithItems[]
): boolean {
  return getCurrentSubmittedQuote(quotes)?.id === quote.id;
}

export function getBuyerDecisionActions(
  quote: RFQQuoteWithItems,
  quotes: RFQQuoteWithItems[],
  decisions: RFQQuoteDecisionRecord[]
): RFQQuoteDecisionValue[] {
  if (!isCurrentSubmittedQuote(quote, quotes)) return [];
  if (getDecisionForQuote(quote.id, decisions)) return [];
  return ["accepted", "rejected", "revision_requested"];
}

export function validateDecisionReason(
  decision: RFQQuoteDecisionValue,
  reason: string
): string[] {
  const errors: string[] = [];
  const trimmed = reason.trim();

  if (decision === "revision_requested" && !trimmed) {
    errors.push("Revision requests require a reason.");
  }

  if (reason.length > decisionReasonMaxLength) {
    errors.push(`Decision reason must be ${decisionReasonMaxLength} characters or fewer.`);
  }

  return errors;
}

export function canManufacturerCreateRevision(
  quote: RFQQuoteWithItems,
  rfqStatus: RFQStatus,
  decisions: RFQQuoteDecisionRecord[]
): boolean {
  return (
    rfqStatus === "revision_requested" &&
    quote.status === "revision_requested" &&
    getDecisionForQuote(quote.id, decisions)?.decision === "revision_requested"
  );
}

export async function acceptQuote(
  quoteId: string,
  reason = ""
): Promise<RFQQuoteDecisionRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("accept_rfq_quote", {
    quote_uuid: quoteId,
    reason_text: reason.trim() || null,
  });
  if (error) throw toReadableDecisionError(error);
  return data as RFQQuoteDecisionRecord;
}

export async function rejectQuote(
  quoteId: string,
  reason = ""
): Promise<RFQQuoteDecisionRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("reject_rfq_quote", {
    quote_uuid: quoteId,
    reason_text: reason.trim() || null,
  });
  if (error) throw toReadableDecisionError(error);
  return data as RFQQuoteDecisionRecord;
}

export async function requestQuoteRevision(
  quoteId: string,
  reason: string
): Promise<RFQQuoteDecisionRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("request_rfq_quote_revision", {
    quote_uuid: quoteId,
    reason_text: reason.trim(),
  });
  if (error) throw toReadableDecisionError(error);
  return data as RFQQuoteDecisionRecord;
}

export async function fetchQuoteDecisionsForRFQ(
  rfqId: string
): Promise<RFQQuoteDecisionRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("rfq_quote_decisions")
    .select("*")
    .eq("rfq_id", rfqId)
    .order("created_at", { ascending: true });

  if (error) throw toReadableDecisionError(error);
  return sortQuoteDecisions((data ?? []) as RFQQuoteDecisionRecord[]);
}

export async function fetchCurrentQuoteDecision(
  rfqId: string
): Promise<RFQQuoteDecisionRecord | null> {
  const decisions = await fetchQuoteDecisionsForRFQ(rfqId);
  return decisions[decisions.length - 1] ?? null;
}

export async function markQuoteOpened(quoteId: string): Promise<void> {
  const client = ensureSupabase();
  const { error } = await client.rpc("record_rfq_quote_opened", { quote_uuid: quoteId });
  if (error) throw toReadableDecisionError(error);
}
