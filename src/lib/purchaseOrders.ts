import { supabase } from "./supabase";
import { formatMoney } from "./quotes";
import type {
  PurchaseOrderDecisionRecord,
  PurchaseOrderDecisionValue,
  PurchaseOrderDraftValues,
  PurchaseOrderEventRecord,
  PurchaseOrderItemRecord,
  PurchaseOrderRecord,
  PurchaseOrderStatus,
  PurchaseOrderWithItems,
  RFQQuoteWithItems,
} from "../types";

export const purchaseOrderStatuses: PurchaseOrderStatus[] = [
  "draft",
  "submitted",
  "manufacturer_review",
  "revision_requested",
  "confirmed",
  "rejected",
  "cancelled",
];

export const purchaseOrderStatusLabels: Record<PurchaseOrderStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  manufacturer_review: "Manufacturer review",
  revision_requested: "Revision requested",
  confirmed: "Confirmed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export const purchaseOrderDecisionLabels: Record<PurchaseOrderDecisionValue, string> = {
  confirmed: "Confirmed",
  rejected: "Rejected",
  revision_requested: "Revision requested",
};

export const purchaseOrderEventLabels: Record<PurchaseOrderEventRecord["event_type"], string> = {
  po_created: "PO created",
  po_submitted: "PO submitted",
  po_cancelled: "PO cancelled",
  po_manufacturer_opened: "Manufacturer opened",
  po_confirmed: "PO confirmed",
  po_rejected: "PO rejected",
  po_revision_requested: "Revision requested",
  po_resubmitted: "PO resubmitted",
};

export const buyerReferenceMaxLength = 120;
export const buyerNoteMaxLength = 2000;
export const purchaseOrderDecisionReasonMaxLength = 4000;

const purchaseOrderSelect = "*, items:purchase_order_items(*)";

function ensureSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

function toReadablePurchaseOrderError(error: { message?: string }): Error {
  const message = error.message?.toLowerCase() ?? "";

  if (message.includes("row-level security") || message.includes("permission denied")) {
    return new Error("You are not authorized to access this purchase order.");
  }
  if (message.includes("already exists")) {
    return new Error("A purchase order already exists for this accepted quote.");
  }
  if (message.includes("accepted")) {
    return new Error("Purchase orders can be created only from accepted quotes.");
  }
  if (message.includes("draft")) {
    return new Error("Only draft purchase orders can be changed.");
  }
  if (message.includes("reason")) {
    return new Error("A reason is required and must be 4000 characters or fewer.");
  }
  if (message.includes("manufacturer review")) {
    return new Error("Purchase order must be in manufacturer review.");
  }
  if (message.includes("revision-requested")) {
    return new Error("Only revision-requested purchase orders can be changed.");
  }

  return new Error(error.message ?? "Unable to manage purchase order.");
}

export function sortPurchaseOrderItems(
  items: PurchaseOrderItemRecord[] = []
): PurchaseOrderItemRecord[] {
  return [...items].sort((a, b) => a.line_order - b.line_order);
}

export function normalizePurchaseOrder(po: PurchaseOrderWithItems): PurchaseOrderWithItems {
  return {
    ...po,
    items: sortPurchaseOrderItems(po.items),
  };
}

export function sortPurchaseOrderDecisions(
  decisions: PurchaseOrderDecisionRecord[] = []
): PurchaseOrderDecisionRecord[] {
  return [...decisions].sort((a, b) => {
    if (a.review_round !== b.review_round) return a.review_round - b.review_round;
    return a.created_at.localeCompare(b.created_at);
  });
}

export function purchaseOrderEventLabel(event: PurchaseOrderEventRecord): string {
  return purchaseOrderEventLabels[event.event_type];
}

export function emptyPurchaseOrderDraftValues(
  po?: PurchaseOrderRecord | null
): PurchaseOrderDraftValues {
  return {
    buyerReference: po?.buyer_reference ?? "",
    buyerNote: po?.buyer_note ?? "",
    requestedDeliveryDate: po?.requested_delivery_date ?? "",
  };
}

export function validatePurchaseOrderDraft(values: PurchaseOrderDraftValues): string[] {
  const errors: string[] = [];

  if (values.buyerReference.length > buyerReferenceMaxLength) {
    errors.push(`Buyer reference must be ${buyerReferenceMaxLength} characters or fewer.`);
  }
  if (values.buyerNote.length > buyerNoteMaxLength) {
    errors.push(`Buyer note must be ${buyerNoteMaxLength} characters or fewer.`);
  }
  if (values.requestedDeliveryDate && Number.isNaN(Date.parse(values.requestedDeliveryDate))) {
    errors.push("Requested delivery date must be a valid date.");
  }

  return errors;
}

export function isPurchaseOrderReadOnly(po: Pick<PurchaseOrderRecord, "status">): boolean {
  return po.status !== "draft" && po.status !== "revision_requested";
}

export function isPurchaseOrderTerminal(po: Pick<PurchaseOrderRecord, "status">): boolean {
  return po.status === "confirmed" || po.status === "rejected" || po.status === "cancelled";
}

export function canManufacturerOpenPurchaseOrder(po: Pick<PurchaseOrderRecord, "status">): boolean {
  return po.status === "submitted";
}

export function getManufacturerPurchaseOrderActions(
  po: Pick<PurchaseOrderRecord, "status">
): PurchaseOrderDecisionValue[] {
  return po.status === "manufacturer_review" ? ["confirmed", "rejected", "revision_requested"] : [];
}

export function canBuyerRevisePurchaseOrder(po: Pick<PurchaseOrderRecord, "status">): boolean {
  return po.status === "revision_requested";
}

export function canCreatePurchaseOrderForQuote(
  quote: RFQQuoteWithItems,
  purchaseOrders: PurchaseOrderRecord[]
): boolean {
  return quote.status === "accepted" && !purchaseOrders.some((po) => po.quote_id === quote.id);
}

export function purchaseOrderSubtotalLabel(po: Pick<PurchaseOrderRecord, "subtotal" | "currency">): string {
  return formatMoney(po.subtotal, po.currency);
}

export function purchaseOrderSubmittedAtLabel(
  po: Pick<PurchaseOrderRecord, "status" | "submitted_at">
): string | null {
  if (
    !["submitted", "manufacturer_review", "revision_requested", "confirmed", "rejected"].includes(po.status) ||
    !po.submitted_at
  ) {
    return null;
  }
  return `Submitted ${new Date(po.submitted_at).toLocaleString()}`;
}

export function purchaseOrderCancelledAtLabel(
  po: Pick<PurchaseOrderRecord, "status" | "cancelled_at">
): string | null {
  if (po.status !== "cancelled" || !po.cancelled_at) return null;
  return `Cancelled ${new Date(po.cancelled_at).toLocaleString()}`;
}

export function purchaseOrderLastSubmittedAtLabel(
  po: Pick<PurchaseOrderRecord, "status" | "submitted_at" | "last_submitted_at">
): string | null {
  if (!["submitted", "manufacturer_review", "revision_requested", "confirmed", "rejected"].includes(po.status)) {
    return null;
  }
  if (!po.last_submitted_at) return null;
  if (po.submitted_at && new Date(po.last_submitted_at).getTime() === new Date(po.submitted_at).getTime()) {
    return null;
  }
  return `Last submitted ${new Date(po.last_submitted_at).toLocaleString()}`;
}

export function purchaseOrderConfirmedAtLabel(
  po: Pick<PurchaseOrderRecord, "status" | "confirmed_at">
): string | null {
  if (po.status !== "confirmed" || !po.confirmed_at) return null;
  return `Confirmed ${new Date(po.confirmed_at).toLocaleString()}`;
}

export function purchaseOrderRejectedAtLabel(
  po: Pick<PurchaseOrderRecord, "status" | "rejected_at">
): string | null {
  if (po.status !== "rejected" || !po.rejected_at) return null;
  return `Rejected ${new Date(po.rejected_at).toLocaleString()}`;
}

export function purchaseOrderReviewRoundLabel(po: Pick<PurchaseOrderRecord, "review_round">): string {
  return `Review round ${po.review_round}`;
}

export function purchaseOrderConfirmationText(po: PurchaseOrderRecord): string {
  const version = po.quote_snapshot.version ? `quote version ${po.quote_snapshot.version}` : "accepted quote";
  return `Submit ${po.po_number} for ${version} at ${formatMoney(po.subtotal, po.currency)}?`;
}

export function purchaseOrderResubmitConfirmationText(po: PurchaseOrderRecord): string {
  return `Resubmit ${po.po_number} for review round ${po.review_round + 1} with unchanged commercial terms at ${formatMoney(po.subtotal, po.currency)}?`;
}

export function manufacturerPurchaseOrderDecisionConfirmationText(
  po: PurchaseOrderRecord,
  decision: PurchaseOrderDecisionValue
): string {
  return `${purchaseOrderDecisionLabels[decision]} ${po.po_number} for review round ${po.review_round}?`;
}

export function validatePurchaseOrderDecisionReason(
  decision: PurchaseOrderDecisionValue,
  reason: string
): string[] {
  const errors: string[] = [];
  const trimmed = reason.trim();
  if ((decision === "rejected" || decision === "revision_requested") && !trimmed) {
    errors.push("A reason is required.");
  }
  if (reason.length > purchaseOrderDecisionReasonMaxLength) {
    errors.push(`Reason must be ${purchaseOrderDecisionReasonMaxLength} characters or fewer.`);
  }
  return errors;
}

export async function createPurchaseOrderFromQuote(quoteId: string): Promise<PurchaseOrderRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("create_purchase_order_from_quote", { quote_uuid: quoteId });
  if (error) throw toReadablePurchaseOrderError(error);
  return data as PurchaseOrderRecord;
}

export async function updatePurchaseOrderDraft(
  poId: string,
  values: PurchaseOrderDraftValues
): Promise<PurchaseOrderRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("update_purchase_order_draft", {
    po_uuid: poId,
    buyer_reference_text: values.buyerReference.trim() || null,
    buyer_note_text: values.buyerNote.trim() || null,
    requested_delivery_date_value: values.requestedDeliveryDate || null,
  });
  if (error) throw toReadablePurchaseOrderError(error);
  return data as PurchaseOrderRecord;
}

export async function submitPurchaseOrder(poId: string): Promise<PurchaseOrderRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("submit_purchase_order", { po_uuid: poId });
  if (error) throw toReadablePurchaseOrderError(error);
  return data as PurchaseOrderRecord;
}

export async function recordPurchaseOrderOpened(poId: string): Promise<void> {
  const client = ensureSupabase();
  const { error } = await client.rpc("record_purchase_order_opened", { po_uuid: poId });
  if (error) throw toReadablePurchaseOrderError(error);
}

export async function confirmPurchaseOrder(poId: string, reason = ""): Promise<PurchaseOrderDecisionRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("confirm_purchase_order", {
    po_uuid: poId,
    reason_text: reason.trim() || null,
  });
  if (error) throw toReadablePurchaseOrderError(error);
  return data as PurchaseOrderDecisionRecord;
}

export async function rejectPurchaseOrder(poId: string, reason: string): Promise<PurchaseOrderDecisionRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("reject_purchase_order", {
    po_uuid: poId,
    reason_text: reason.trim(),
  });
  if (error) throw toReadablePurchaseOrderError(error);
  return data as PurchaseOrderDecisionRecord;
}

export async function requestPurchaseOrderRevision(poId: string, reason: string): Promise<PurchaseOrderDecisionRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("request_purchase_order_revision", {
    po_uuid: poId,
    reason_text: reason.trim(),
  });
  if (error) throw toReadablePurchaseOrderError(error);
  return data as PurchaseOrderDecisionRecord;
}

export async function updatePurchaseOrderRevision(
  poId: string,
  values: PurchaseOrderDraftValues
): Promise<PurchaseOrderRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("update_purchase_order_revision", {
    po_uuid: poId,
    buyer_reference_text: values.buyerReference.trim() || null,
    buyer_note_text: values.buyerNote.trim() || null,
    requested_delivery_date_value: values.requestedDeliveryDate || null,
  });
  if (error) throw toReadablePurchaseOrderError(error);
  return data as PurchaseOrderRecord;
}

export async function resubmitPurchaseOrder(poId: string): Promise<PurchaseOrderRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("resubmit_purchase_order", { po_uuid: poId });
  if (error) throw toReadablePurchaseOrderError(error);
  return data as PurchaseOrderRecord;
}

export async function cancelPurchaseOrderDraft(poId: string): Promise<PurchaseOrderRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("cancel_purchase_order_draft", { po_uuid: poId });
  if (error) throw toReadablePurchaseOrderError(error);
  return data as PurchaseOrderRecord;
}

export async function fetchBuyerPurchaseOrders(): Promise<PurchaseOrderWithItems[]> {
  return fetchPurchaseOrders();
}

export async function fetchManufacturerPurchaseOrders(): Promise<PurchaseOrderWithItems[]> {
  return fetchPurchaseOrders();
}

export async function fetchAdminPurchaseOrders(): Promise<PurchaseOrderWithItems[]> {
  return fetchPurchaseOrders();
}

async function fetchPurchaseOrders(): Promise<PurchaseOrderWithItems[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("purchase_orders")
    .select(purchaseOrderSelect)
    .order("created_at", { ascending: false });
  if (error) throw toReadablePurchaseOrderError(error);
  return ((data ?? []) as PurchaseOrderWithItems[]).map(normalizePurchaseOrder);
}

export async function fetchPurchaseOrder(poId: string): Promise<PurchaseOrderWithItems | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("purchase_orders")
    .select(purchaseOrderSelect)
    .eq("id", poId)
    .maybeSingle();
  if (error) throw toReadablePurchaseOrderError(error);
  return data ? normalizePurchaseOrder(data as PurchaseOrderWithItems) : null;
}

export async function fetchPurchaseOrderItems(poId: string): Promise<PurchaseOrderItemRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("purchase_order_items")
    .select("*")
    .eq("purchase_order_id", poId)
    .order("line_order", { ascending: true });
  if (error) throw toReadablePurchaseOrderError(error);
  return sortPurchaseOrderItems((data ?? []) as PurchaseOrderItemRecord[]);
}

export async function fetchPurchaseOrderEvents(poId: string): Promise<PurchaseOrderEventRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("purchase_order_events")
    .select("*")
    .eq("purchase_order_id", poId)
    .order("created_at", { ascending: true });
  if (error) throw toReadablePurchaseOrderError(error);
  return (data ?? []) as PurchaseOrderEventRecord[];
}

export async function fetchPurchaseOrderDecisions(poId: string): Promise<PurchaseOrderDecisionRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("purchase_order_decisions")
    .select("*")
    .eq("purchase_order_id", poId)
    .order("review_round", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw toReadablePurchaseOrderError(error);
  return sortPurchaseOrderDecisions((data ?? []) as PurchaseOrderDecisionRecord[]);
}
