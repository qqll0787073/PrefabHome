import { supabase } from "./supabase";
import type {
  RFQIncoterm,
  RFQQuoteFormValues,
  RFQQuoteItemFormValues,
  RFQQuoteItemRecord,
  RFQQuoteItemType,
  RFQQuoteRecord,
  RFQQuoteStatus,
  RFQQuoteWithItems,
} from "../types";

export const quoteStatuses: RFQQuoteStatus[] = [
  "draft",
  "submitted",
  "superseded",
  "expired",
  "withdrawn",
];

export const quoteStatusLabels: Record<RFQQuoteStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  superseded: "Superseded",
  expired: "Expired",
  withdrawn: "Withdrawn",
};

export const quoteItemTypes: RFQQuoteItemType[] = [
  "product",
  "customization",
  "packaging",
  "freight",
  "insurance",
  "tax",
  "discount",
  "other",
];

export const quoteItemTypeLabels: Record<RFQQuoteItemType, string> = {
  product: "Product",
  customization: "Customization",
  packaging: "Packaging",
  freight: "Freight",
  insurance: "Insurance",
  tax: "Tax",
  discount: "Discount",
  other: "Other",
};

export const quoteIncoterms: RFQIncoterm[] = ["FOB", "CIF", "EXW", "DDP", "DAP"];
export const quoteNoteMaxLength = 4000;

const quoteSelect = "*, items:rfq_quote_items(*)";

function ensureSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function optionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function requiredNumber(value: string): number {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function sortQuoteItems(items: RFQQuoteItemRecord[] = []): RFQQuoteItemRecord[] {
  return [...items].sort((a, b) => a.line_order - b.line_order);
}

export function normalizeQuote(quote: RFQQuoteWithItems): RFQQuoteWithItems {
  return {
    ...quote,
    items: sortQuoteItems(quote.items),
  };
}

export function sortQuotesByVersion(quotes: RFQQuoteWithItems[]): RFQQuoteWithItems[] {
  return [...quotes].sort((a, b) => b.version - a.version);
}

export function isQuoteEditableByManufacturer(quote: Pick<RFQQuoteRecord, "status">): boolean {
  return quote.status === "draft";
}

export function isQuoteVisibleToBuyer(quote: Pick<RFQQuoteRecord, "status">): boolean {
  return quote.status !== "draft";
}

export function emptyQuoteForm(currency = "USD"): RFQQuoteFormValues {
  return {
    currency,
    incoterm: "",
    originPort: "",
    destinationPort: "",
    productionLeadDays: "",
    shippingLeadDays: "",
    validUntil: "",
    manufacturerNote: "",
  };
}

export function quoteToFormValues(quote: RFQQuoteRecord): RFQQuoteFormValues {
  return {
    currency: quote.currency,
    incoterm: quote.incoterm ?? "",
    originPort: quote.origin_port ?? "",
    destinationPort: quote.destination_port ?? "",
    productionLeadDays: quote.production_lead_days?.toString() ?? "",
    shippingLeadDays: quote.shipping_lead_days?.toString() ?? "",
    validUntil: quote.valid_until ?? "",
    manufacturerNote: quote.manufacturer_note ?? "",
  };
}

export function emptyQuoteItemForm(lineOrder = 1): RFQQuoteItemFormValues {
  return {
    lineOrder: String(lineOrder),
    itemType: "product",
    description: "",
    quantity: "1",
    unit: "unit",
    unitPrice: "0",
  };
}

export function itemToFormValues(item: RFQQuoteItemRecord): RFQQuoteItemFormValues {
  return {
    lineOrder: String(item.line_order),
    itemType: item.item_type,
    description: item.description,
    quantity: String(item.quantity),
    unit: item.unit ?? "",
    unitPrice: String(item.unit_price),
  };
}

export function calculateQuoteItemAmount(
  item: Pick<RFQQuoteItemFormValues, "quantity" | "unitPrice">
): number {
  const quantity = requiredNumber(item.quantity);
  const unitPrice = requiredNumber(item.unitPrice);
  if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return Number.NaN;
  return Number((quantity * unitPrice).toFixed(2));
}

export function calculateQuoteSubtotal(items: RFQQuoteItemRecord[]): number {
  return Number(items.reduce((total, item) => total + item.amount, 0).toFixed(2));
}

export function formatMoney(amount: number | null | undefined, currency: string): string {
  const value = amount ?? 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function validateQuoteDraftForm(values: RFQQuoteFormValues): string[] {
  const errors: string[] = [];

  if (!/^[A-Za-z]{3}$/.test(values.currency.trim())) {
    errors.push("Currency must be a 3-letter code.");
  }

  if (values.incoterm.trim() && !quoteIncoterms.includes(values.incoterm.trim().toUpperCase() as RFQIncoterm)) {
    errors.push("Incoterm is not supported.");
  }

  const productionLeadDays = optionalNumber(values.productionLeadDays);
  if (productionLeadDays !== null && (!Number.isFinite(productionLeadDays) || productionLeadDays < 0)) {
    errors.push("Production lead days must be zero or more.");
  }

  const shippingLeadDays = optionalNumber(values.shippingLeadDays);
  if (shippingLeadDays !== null && (!Number.isFinite(shippingLeadDays) || shippingLeadDays < 0)) {
    errors.push("Shipping lead days must be zero or more.");
  }

  if (values.manufacturerNote.length > quoteNoteMaxLength) {
    errors.push(`Manufacturer note must be ${quoteNoteMaxLength} characters or fewer.`);
  }

  return errors;
}

export function validateQuoteItemForm(values: RFQQuoteItemFormValues): string[] {
  const errors: string[] = [];
  const lineOrder = requiredNumber(values.lineOrder);
  const quantity = requiredNumber(values.quantity);
  const unitPrice = requiredNumber(values.unitPrice);

  if (!Number.isInteger(lineOrder) || lineOrder < 1) {
    errors.push("Line order must be a positive whole number.");
  }

  if (!quoteItemTypes.includes(values.itemType)) {
    errors.push("Line item type is not supported.");
  }

  if (!values.description.trim()) {
    errors.push("Line item description is required.");
  } else if (values.description.trim().length > 500) {
    errors.push("Line item description must be 500 characters or fewer.");
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    errors.push("Line item quantity must be greater than zero.");
  }

  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    errors.push("Line item unit price must be zero or more.");
  }

  if (values.unit.length > 40) {
    errors.push("Line item unit must be 40 characters or fewer.");
  }

  return errors;
}

export function validateQuoteForSubmission(quote: RFQQuoteWithItems): string[] {
  const errors = validateQuoteDraftForm(quoteToFormValues(quote));
  if (quote.items.length === 0) {
    errors.push("Quote must include at least one line item.");
  }
  return errors;
}

function toQuoteUpdatePayload(values: RFQQuoteFormValues) {
  return {
    currency: values.currency.trim().toUpperCase(),
    incoterm: optionalText(values.incoterm)?.toUpperCase() ?? null,
    origin_port: optionalText(values.originPort),
    destination_port: optionalText(values.destinationPort),
    production_lead_days: optionalNumber(values.productionLeadDays),
    shipping_lead_days: optionalNumber(values.shippingLeadDays),
    valid_until: optionalText(values.validUntil),
    manufacturer_note: optionalText(values.manufacturerNote),
  };
}

function toQuoteItemPayload(values: RFQQuoteItemFormValues) {
  return {
    line_order: requiredNumber(values.lineOrder),
    item_type: values.itemType,
    description: values.description.trim(),
    quantity: requiredNumber(values.quantity),
    unit: optionalText(values.unit),
    unit_price: requiredNumber(values.unitPrice),
  };
}

function toReadableQuoteError(error: { message?: string }): Error {
  const message = error.message?.toLowerCase() ?? "";

  if (message.includes("row-level security") || message.includes("permission denied")) {
    return new Error("You are not authorized to access this quote.");
  }

  if (message.includes("submitted quote")) {
    return new Error("Submitted quotes are read-only.");
  }

  if (message.includes("at least one line item")) {
    return new Error("Quote must include at least one line item.");
  }

  return new Error(error.message ?? "Unable to manage quote.");
}

export async function createQuoteDraft(rfqId: string): Promise<RFQQuoteRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("create_rfq_quote_draft", { rfq_uuid: rfqId });
  if (error) throw toReadableQuoteError(error);
  return data as RFQQuoteRecord;
}

export async function submitQuote(quoteId: string): Promise<RFQQuoteRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("submit_rfq_quote", { quote_uuid: quoteId });
  if (error) throw toReadableQuoteError(error);
  return data as RFQQuoteRecord;
}

export async function createQuoteRevision(quoteId: string): Promise<RFQQuoteRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("create_rfq_quote_revision", { quote_uuid: quoteId });
  if (error) throw toReadableQuoteError(error);
  return data as RFQQuoteRecord;
}

export async function deleteQuoteDraft(quoteId: string): Promise<void> {
  const client = ensureSupabase();
  const { error } = await client.rpc("delete_rfq_quote_draft", { quote_uuid: quoteId });
  if (error) throw toReadableQuoteError(error);
}

export async function fetchQuote(quoteId: string): Promise<RFQQuoteWithItems | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("rfq_quotes")
    .select(quoteSelect)
    .eq("id", quoteId)
    .maybeSingle();

  if (error) throw toReadableQuoteError(error);
  return data ? normalizeQuote(data as RFQQuoteWithItems) : null;
}

export async function fetchQuotesForRFQ(rfqId: string): Promise<RFQQuoteWithItems[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("rfq_quotes")
    .select(quoteSelect)
    .eq("rfq_id", rfqId)
    .order("version", { ascending: false });

  if (error) throw toReadableQuoteError(error);
  return sortQuotesByVersion(((data ?? []) as RFQQuoteWithItems[]).map(normalizeQuote));
}

export async function fetchManufacturerQuotes(): Promise<RFQQuoteWithItems[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("rfq_quotes")
    .select(quoteSelect)
    .order("updated_at", { ascending: false });

  if (error) throw toReadableQuoteError(error);
  return sortQuotesByVersion(((data ?? []) as RFQQuoteWithItems[]).map(normalizeQuote));
}

export async function fetchBuyerQuotes(): Promise<RFQQuoteWithItems[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("rfq_quotes")
    .select(quoteSelect)
    .neq("status", "draft")
    .order("version", { ascending: false });

  if (error) throw toReadableQuoteError(error);
  return sortQuotesByVersion(((data ?? []) as RFQQuoteWithItems[]).map(normalizeQuote));
}

export async function fetchAdminQuotes(): Promise<RFQQuoteWithItems[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("rfq_quotes")
    .select(quoteSelect)
    .order("updated_at", { ascending: false });

  if (error) throw toReadableQuoteError(error);
  return sortQuotesByVersion(((data ?? []) as RFQQuoteWithItems[]).map(normalizeQuote));
}

export async function updateQuoteDraft(
  quoteId: string,
  values: RFQQuoteFormValues
): Promise<RFQQuoteRecord> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from("rfq_quotes")
    .update(toQuoteUpdatePayload(values))
    .eq("id", quoteId)
    .select("*")
    .single();

  if (error) throw toReadableQuoteError(error);
  return data as RFQQuoteRecord;
}

export async function addQuoteItem(
  quoteId: string,
  values: RFQQuoteItemFormValues
): Promise<RFQQuoteItemRecord> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from("rfq_quote_items")
    .insert({ quote_id: quoteId, ...toQuoteItemPayload(values) })
    .select("*")
    .single();

  if (error) throw toReadableQuoteError(error);
  return data as RFQQuoteItemRecord;
}

export async function updateQuoteItem(
  itemId: string,
  values: RFQQuoteItemFormValues
): Promise<RFQQuoteItemRecord> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from("rfq_quote_items")
    .update(toQuoteItemPayload(values))
    .eq("id", itemId)
    .select("*")
    .single();

  if (error) throw toReadableQuoteError(error);
  return data as RFQQuoteItemRecord;
}

export async function deleteQuoteItem(itemId: string): Promise<void> {
  const client = ensureSupabase();
  const { error } = await client.from("rfq_quote_items").delete().eq("id", itemId);
  if (error) throw toReadableQuoteError(error);
}
