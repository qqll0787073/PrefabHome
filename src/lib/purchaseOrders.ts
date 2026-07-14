import { supabase } from "./supabase";
import { formatMoney } from "./quotes";
import type {
  PurchaseOrderDraftValues,
  PurchaseOrderEventRecord,
  PurchaseOrderItemRecord,
  PurchaseOrderRecord,
  PurchaseOrderStatus,
  PurchaseOrderWithItems,
  RFQQuoteWithItems,
} from "../types";

export const purchaseOrderStatuses: PurchaseOrderStatus[] = ["draft", "submitted", "cancelled"];

export const purchaseOrderStatusLabels: Record<PurchaseOrderStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  cancelled: "Cancelled",
};

export const buyerReferenceMaxLength = 120;
export const buyerNoteMaxLength = 2000;

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
  return po.status !== "draft";
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
  if (po.status !== "submitted" || !po.submitted_at) return null;
  return `Submitted ${new Date(po.submitted_at).toLocaleString()}`;
}

export function purchaseOrderCancelledAtLabel(
  po: Pick<PurchaseOrderRecord, "status" | "cancelled_at">
): string | null {
  if (po.status !== "cancelled" || !po.cancelled_at) return null;
  return `Cancelled ${new Date(po.cancelled_at).toLocaleString()}`;
}

export function purchaseOrderConfirmationText(po: PurchaseOrderRecord): string {
  const version = po.quote_snapshot.version ? `quote version ${po.quote_snapshot.version}` : "accepted quote";
  return `Submit ${po.po_number} for ${version} at ${formatMoney(po.subtotal, po.currency)}?`;
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
