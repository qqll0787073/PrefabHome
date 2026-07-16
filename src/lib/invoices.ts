import { supabase } from "./supabase";
import { formatMoney } from "./quotes";
import type {
  InvoiceDraftValues,
  InvoiceEventRecord,
  InvoiceLineItemRecord,
  InvoiceRecord,
  InvoiceStatus,
  PurchaseOrderRecord,
  SignaturePackageRecord,
} from "../types";

export const invoiceStatuses: InvoiceStatus[] = ["draft", "issued", "cancelled"];

export const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  draft: "Draft",
  issued: "Issued",
  cancelled: "Cancelled",
};

export const invoiceEventLabels: Record<InvoiceEventRecord["event_type"], string> = {
  invoice_created: "Invoice created",
  invoice_updated: "Invoice draft updated",
  invoice_issued: "Invoice issued",
  invoice_cancelled: "Invoice cancelled",
};

export const invoiceCancellationReasonMaxLength = 2000;
export const invoiceBillingNameMaxLength = 160;
export const invoiceBillingEmailMaxLength = 254;
export const invoiceBillingAddressLimits = {
  addressLine1: 200,
  addressLine2: 200,
  city: 120,
  stateRegion: 120,
  postalCode: 32,
} as const;

function ensureSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

function toReadableInvoiceError(error: { message?: string }): Error {
  const message = error.message?.toLowerCase() ?? "";

  if (message.includes("row-level security") || message.includes("permission denied")) {
    return new Error("You are not authorized to access this invoice.");
  }
  if (message.includes("confirmed purchase order")) {
    return new Error("Invoices require a confirmed purchase order.");
  }
  if (message.includes("accepted contract")) {
    return new Error("Invoices require an accepted contract linked to the purchase order.");
  }
  if (message.includes("ready-to-send") || message.includes("ready to send")) {
    return new Error("Invoices require a ready-to-send signature package.");
  }
  if (message.includes("already exists") || message.includes("invoices_purchase_order_id_key")) {
    return new Error("An invoice already exists for this purchase order.");
  }
  if (message.includes("billing")) {
    return new Error("Complete and valid billing details are required before issuing.");
  }
  if (message.includes("discount")) {
    return new Error("Discount cannot exceed subtotal plus tax and shipping.");
  }
  if (message.includes("amount")) {
    return new Error("Invoice amounts must be zero or greater.");
  }
  if (message.includes("reason")) {
    return new Error(`Cancellation reason is required and must be ${invoiceCancellationReasonMaxLength} characters or fewer.`);
  }

  return new Error(error.message ?? "Unable to manage invoice.");
}

function parseAmount(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function addressString(address: Record<string, unknown> | null | undefined, key: string): string {
  const value = address?.[key];
  return typeof value === "string" ? value : "";
}

export function normalizeInvoiceBillingAddress(
  values: Pick<
    InvoiceDraftValues,
    | "billingAddressLine1"
    | "billingAddressLine2"
    | "billingCity"
    | "billingStateRegion"
    | "billingPostalCode"
    | "billingCountryCode"
  >
): Record<string, string> | null {
  const address = {
    address_line1: values.billingAddressLine1.trim(),
    address_line2: values.billingAddressLine2.trim(),
    city: values.billingCity.trim(),
    state_region: values.billingStateRegion.trim(),
    postal_code: values.billingPostalCode.trim(),
    country_code: values.billingCountryCode.trim().toUpperCase(),
  };
  const compact = Object.fromEntries(
    Object.entries(address).filter(([, value]) => value.length > 0)
  ) as Record<string, string>;
  return Object.keys(compact).length > 0 ? compact : null;
}

export function emptyInvoiceDraftValues(invoice?: InvoiceRecord | null): InvoiceDraftValues {
  return {
    issueDate: invoice?.issue_date ?? "",
    dueDate: invoice?.due_date ?? "",
    billingName: invoice?.billing_name ?? "",
    billingEmail: invoice?.billing_email ?? "",
    billingAddressLine1: addressString(invoice?.billing_address, "address_line1"),
    billingAddressLine2: addressString(invoice?.billing_address, "address_line2"),
    billingCity: addressString(invoice?.billing_address, "city"),
    billingStateRegion: addressString(invoice?.billing_address, "state_region"),
    billingPostalCode: addressString(invoice?.billing_address, "postal_code"),
    billingCountryCode: addressString(invoice?.billing_address, "country_code"),
    taxAmount: invoice ? String(invoice.tax_amount) : "0",
    shippingAmount: invoice ? String(invoice.shipping_amount) : "0",
    discountAmount: invoice ? String(invoice.discount_amount) : "0",
  };
}

export function calculateInvoiceTotalPreview(
  subtotal: number,
  values: Pick<InvoiceDraftValues, "taxAmount" | "shippingAmount" | "discountAmount">
): number {
  const tax = parseAmount(values.taxAmount);
  const shipping = parseAmount(values.shippingAmount);
  const discount = parseAmount(values.discountAmount);
  if ([tax, shipping, discount].some((amount) => Number.isNaN(amount))) return Number.NaN;
  return Math.round((subtotal + tax + shipping - discount) * 100) / 100;
}

export function validateInvoiceDraftValues(
  values: InvoiceDraftValues,
  subtotal: number,
  requireComplete = false
): string[] {
  const errors: string[] = [];
  const tax = parseAmount(values.taxAmount);
  const shipping = parseAmount(values.shippingAmount);
  const discount = parseAmount(values.discountAmount);

  if (values.billingName.length > invoiceBillingNameMaxLength) {
    errors.push(`Billing name must be ${invoiceBillingNameMaxLength} characters or fewer.`);
  }
  if (values.billingEmail.length > invoiceBillingEmailMaxLength) {
    errors.push(`Billing email must be ${invoiceBillingEmailMaxLength} characters or fewer.`);
  }
  if (values.billingEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.billingEmail.trim())) {
    errors.push("Billing email must be valid.");
  }
  if (values.billingAddressLine1.trim().length > invoiceBillingAddressLimits.addressLine1) {
    errors.push(`Address line 1 must be ${invoiceBillingAddressLimits.addressLine1} characters or fewer.`);
  }
  if (values.billingAddressLine2.trim().length > invoiceBillingAddressLimits.addressLine2) {
    errors.push(`Address line 2 must be ${invoiceBillingAddressLimits.addressLine2} characters or fewer.`);
  }
  if (values.billingCity.trim().length > invoiceBillingAddressLimits.city) {
    errors.push(`City must be ${invoiceBillingAddressLimits.city} characters or fewer.`);
  }
  if (values.billingStateRegion.trim().length > invoiceBillingAddressLimits.stateRegion) {
    errors.push(`State or region must be ${invoiceBillingAddressLimits.stateRegion} characters or fewer.`);
  }
  if (values.billingPostalCode.trim().length > invoiceBillingAddressLimits.postalCode) {
    errors.push(`Postal code must be ${invoiceBillingAddressLimits.postalCode} characters or fewer.`);
  }
  const countryCode = values.billingCountryCode.trim();
  if (countryCode && !/^[A-Za-z]{2}$/.test(countryCode)) {
    errors.push("Country code must be exactly two letters.");
  }
  if (values.issueDate && Number.isNaN(Date.parse(values.issueDate))) {
    errors.push("Issue date must be valid.");
  }
  if (values.dueDate && Number.isNaN(Date.parse(values.dueDate))) {
    errors.push("Due date must be valid.");
  }
  if (values.issueDate && values.dueDate && new Date(values.dueDate) < new Date(values.issueDate)) {
    errors.push("Due date must be on or after the issue date.");
  }
  if ([tax, shipping, discount].some((amount) => Number.isNaN(amount))) {
    errors.push("Amounts must be valid numbers.");
  }
  if ([tax, shipping, discount].some((amount) => amount < 0)) {
    errors.push("Amounts must be zero or greater.");
  }
  if (!Number.isNaN(discount) && !Number.isNaN(tax) && !Number.isNaN(shipping) && discount > subtotal + tax + shipping) {
    errors.push("Discount cannot exceed subtotal plus tax and shipping.");
  }
  if (requireComplete) {
    if (!values.billingName.trim()) errors.push("Billing name is required.");
    if (!values.billingEmail.trim()) errors.push("Billing email is required.");
    if (!values.billingAddressLine1.trim()) errors.push("Address line 1 is required.");
    if (!values.billingCity.trim()) errors.push("City is required.");
    if (!values.billingStateRegion.trim()) errors.push("State or region is required.");
    if (!values.billingPostalCode.trim()) errors.push("Postal code is required.");
    if (!values.billingCountryCode.trim()) errors.push("Country code is required.");
    if (!values.issueDate) errors.push("Issue date is required.");
    if (!values.dueDate) errors.push("Due date is required.");
  }

  return errors;
}

export function validateInvoiceCancellationReason(reason: string): string[] {
  const errors: string[] = [];
  if (!reason.trim()) errors.push("Cancellation reason is required.");
  if (reason.length > invoiceCancellationReasonMaxLength) {
    errors.push(`Cancellation reason must be ${invoiceCancellationReasonMaxLength} characters or fewer.`);
  }
  return errors;
}

export function canCreateInvoiceForPurchaseOrder(
  purchaseOrder: Pick<PurchaseOrderRecord, "id" | "status">,
  invoices: Pick<InvoiceRecord, "purchase_order_id">[],
  packages: Pick<SignaturePackageRecord, "contract_id" | "status">[] = [],
  contractId?: string
): boolean {
  const hasReadySignaturePackage = contractId
    ? packages.some((signaturePackage) => signaturePackage.contract_id === contractId && signaturePackage.status === "ready_to_send")
    : packages.some((signaturePackage) => signaturePackage.status === "ready_to_send");
  return (
    purchaseOrder.status === "confirmed" &&
    hasReadySignaturePackage &&
    !invoices.some((invoice) => invoice.purchase_order_id === purchaseOrder.id)
  );
}

export function isInvoiceReadOnly(invoice: Pick<InvoiceRecord, "status">): boolean {
  return invoice.status !== "draft";
}

export function canIssueInvoice(invoice: Pick<InvoiceRecord, "status">): boolean {
  return invoice.status === "draft";
}

export function isInvoiceIssueReady(values: InvoiceDraftValues, subtotal: number): boolean {
  return validateInvoiceDraftValues(values, subtotal, true).length === 0;
}

export function canCancelInvoice(invoice: Pick<InvoiceRecord, "status">): boolean {
  return invoice.status === "draft" || invoice.status === "issued";
}

export function invoiceAmountLabel(
  invoice: Pick<InvoiceRecord, "total_amount" | "currency">
): string {
  return formatMoney(invoice.total_amount, invoice.currency);
}

export function invoiceSubtotalLabel(
  invoice: Pick<InvoiceRecord, "subtotal" | "currency">
): string {
  return formatMoney(invoice.subtotal, invoice.currency);
}

export function invoiceIssuedAtLabel(invoice: Pick<InvoiceRecord, "status" | "issued_at">): string | null {
  if (invoice.status !== "issued" || !invoice.issued_at) return null;
  return `Issued ${new Date(invoice.issued_at).toLocaleString()}`;
}

export function invoiceCancelledAtLabel(invoice: Pick<InvoiceRecord, "status" | "cancelled_at">): string | null {
  if (invoice.status !== "cancelled" || !invoice.cancelled_at) return null;
  return `Cancelled ${new Date(invoice.cancelled_at).toLocaleString()}`;
}

export function invoiceIssueConfirmationText(invoice: InvoiceRecord): string {
  return `Issue ${invoice.invoice_number}? Invoice contents will be frozen. The invoice is not sent and no payment is recorded.`;
}

export function invoiceTaxDisclaimer(): string {
  return "Tax is manually entered for invoice preparation only. No automatic tax determination is performed.";
}

export function invoiceNoPaymentNotice(): string {
  return "No payment has been recorded.";
}

export function invoiceEventLabel(event: InvoiceEventRecord): string {
  return invoiceEventLabels[event.event_type];
}

export function sortInvoiceLineItems(items: InvoiceLineItemRecord[] = []): InvoiceLineItemRecord[] {
  return [...items].sort((a, b) => a.line_number - b.line_number);
}

export async function createInvoiceFromPurchaseOrder(poId: string): Promise<InvoiceRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("create_invoice_from_purchase_order", {
    purchase_order_uuid: poId,
  });
  if (error) throw toReadableInvoiceError(error);
  return data as InvoiceRecord;
}

export async function updateInvoiceDraft(invoiceId: string, values: InvoiceDraftValues): Promise<InvoiceRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("update_invoice_draft", {
    invoice_uuid: invoiceId,
    issue_date_value: values.issueDate || null,
    due_date_value: values.dueDate || null,
    billing_name_text: values.billingName.trim() || null,
    billing_email_text: values.billingEmail.trim() || null,
    billing_address_value: normalizeInvoiceBillingAddress(values),
    tax_amount_value: parseAmount(values.taxAmount),
    shipping_amount_value: parseAmount(values.shippingAmount),
    discount_amount_value: parseAmount(values.discountAmount),
  });
  if (error) throw toReadableInvoiceError(error);
  return data as InvoiceRecord;
}

export async function issueInvoice(invoiceId: string): Promise<InvoiceRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("issue_invoice", { invoice_uuid: invoiceId });
  if (error) throw toReadableInvoiceError(error);
  return data as InvoiceRecord;
}

export async function cancelInvoice(invoiceId: string, reason: string): Promise<InvoiceRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("cancel_invoice", {
    invoice_uuid: invoiceId,
    reason_text: reason.trim(),
  });
  if (error) throw toReadableInvoiceError(error);
  return data as InvoiceRecord;
}

async function fetchInvoices(): Promise<InvoiceRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw toReadableInvoiceError(error);
  return (data ?? []) as InvoiceRecord[];
}

export async function fetchManufacturerInvoices(): Promise<InvoiceRecord[]> {
  return fetchInvoices();
}

export async function fetchBuyerInvoices(): Promise<InvoiceRecord[]> {
  return fetchInvoices();
}

export async function fetchAdminInvoices(): Promise<InvoiceRecord[]> {
  return fetchInvoices();
}

export async function fetchInvoiceLineItems(invoiceId: string): Promise<InvoiceLineItemRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("invoice_line_items")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("line_number", { ascending: true });
  if (error) throw toReadableInvoiceError(error);
  return sortInvoiceLineItems((data ?? []) as InvoiceLineItemRecord[]);
}

export async function fetchInvoiceEvents(invoiceId: string): Promise<InvoiceEventRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("invoice_events")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: true });
  if (error) throw toReadableInvoiceError(error);
  return (data ?? []) as InvoiceEventRecord[];
}
