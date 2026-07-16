import { supabase } from "./supabase";
import { formatMoney } from "./quotes";
import type {
  InvoicePaymentSummary,
  InvoiceRecord,
  PaymentDraftValues,
  PaymentEventRecord,
  PaymentEventType,
  PaymentMethod,
  PaymentRecord,
  PaymentRecordStatus,
} from "../types";

export const paymentRecordStatuses: PaymentRecordStatus[] = ["draft", "recorded", "voided"];

export const paymentMethods: PaymentMethod[] = ["bank_transfer", "wire", "check", "cash", "other"];

export const paymentStatusLabels: Record<PaymentRecordStatus, string> = {
  draft: "Draft",
  recorded: "Recorded",
  voided: "Voided",
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  bank_transfer: "Bank transfer",
  wire: "Wire",
  check: "Check",
  cash: "Cash",
  other: "Other",
};

export const paymentEventLabels: Record<PaymentEventType, string> = {
  payment_record_created: "Payment record created",
  payment_record_updated: "Payment draft updated",
  payment_recorded: "Payment recorded",
  payment_record_voided: "Payment record voided",
};

export const paymentReferenceMaxLength = 120;
export const paymentNotesMaxLength = 2000;
export const paymentVoidReasonMaxLength = 2000;

function ensureSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

function parseAmount(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return Number.NaN;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : Number.NaN;
}

function toReadablePaymentError(error: { message?: string }): Error {
  const message = error.message?.toLowerCase() ?? "";

  if (message.includes("row-level security") || message.includes("permission denied") || message.includes("not authorized")) {
    return new Error("You are not authorized to access this payment record.");
  }
  if (message.includes("issued invoice")) {
    return new Error("Payment records require an issued invoice.");
  }
  if (message.includes("remaining balance") || message.includes("exceed")) {
    return new Error("Payment amount cannot exceed the invoice remaining balance.");
  }
  if (message.includes("positive")) {
    return new Error("Payment amount must be greater than zero.");
  }
  if (message.includes("lifecycle") || message.includes("draft") || message.includes("void")) {
    return new Error("Payment record lifecycle transition is no longer available.");
  }
  if (message.includes("method")) {
    return new Error("Choose a supported external payment method.");
  }

  return new Error(error.message ?? "Unable to manage payment record.");
}

export function externalPaymentRecordNotice(): string {
  return "Payment records are manual external records only. No funds are transferred, processed, bank-verified, settled, reconciled, or used to mark the invoice as paid.";
}

export function emptyPaymentDraftValues(payment?: PaymentRecord | null): PaymentDraftValues {
  return {
    amount: payment ? String(payment.amount) : "",
    paymentMethod: payment?.payment_method ?? "bank_transfer",
    paymentDate: payment?.payment_date ?? "",
    referenceNumber: payment?.reference_number ?? "",
    notes: payment?.notes ?? "",
  };
}

export function validatePaymentDraftValues(values: PaymentDraftValues, remainingBalance?: number): string[] {
  const errors: string[] = [];
  const amount = parseAmount(values.amount);

  if (Number.isNaN(amount)) errors.push("Payment amount is required.");
  if (!Number.isNaN(amount) && amount <= 0) errors.push("Payment amount must be greater than zero.");
  if (typeof remainingBalance === "number" && !Number.isNaN(amount) && amount > remainingBalance) {
    errors.push("Payment amount cannot exceed the invoice remaining balance.");
  }
  if (!paymentMethods.includes(values.paymentMethod)) errors.push("Choose a supported external payment method.");
  if (values.paymentDate && Number.isNaN(Date.parse(values.paymentDate))) errors.push("Payment date must be valid.");
  if (values.referenceNumber.trim().length > paymentReferenceMaxLength) {
    errors.push(`Reference number must be ${paymentReferenceMaxLength} characters or fewer.`);
  }
  if (values.notes.trim().length > paymentNotesMaxLength) {
    errors.push(`Notes must be ${paymentNotesMaxLength} characters or fewer.`);
  }

  return errors;
}

export function validatePaymentVoidReason(reason: string): string[] {
  const errors: string[] = [];
  if (!reason.trim()) errors.push("Void reason is required.");
  if (reason.length > paymentVoidReasonMaxLength) {
    errors.push(`Void reason must be ${paymentVoidReasonMaxLength} characters or fewer.`);
  }
  return errors;
}

export function canCreatePaymentRecord(
  invoice: Pick<InvoiceRecord, "status">,
  summary?: Pick<InvoicePaymentSummary, "remaining_balance"> | null
): boolean {
  return invoice.status === "issued" && (!summary || summary.remaining_balance > 0);
}

export function canRecordPayment(payment: Pick<PaymentRecord, "status">): boolean {
  return payment.status === "draft";
}

export function canVoidPayment(payment: Pick<PaymentRecord, "status">): boolean {
  return payment.status === "recorded";
}

export function isPaymentRecordReadOnly(payment: Pick<PaymentRecord, "status">): boolean {
  return payment.status !== "draft";
}

export function paymentAmountLabel(payment: Pick<PaymentRecord, "amount" | "currency">): string {
  return formatMoney(payment.amount, payment.currency);
}

export function paymentSummaryLabels(summary: InvoicePaymentSummary): {
  total: string;
  recorded: string;
  remaining: string;
} {
  return {
    total: formatMoney(summary.invoice_total, summary.currency),
    recorded: formatMoney(summary.recorded_amount, summary.currency),
    remaining: formatMoney(summary.remaining_balance, summary.currency),
  };
}

export function paymentEventLabel(event: PaymentEventRecord): string {
  return paymentEventLabels[event.event_type];
}

export function paymentRecordedAtLabel(payment: Pick<PaymentRecord, "status" | "recorded_at">): string | null {
  if (payment.status !== "recorded" || !payment.recorded_at) return null;
  return `Recorded ${new Date(payment.recorded_at).toLocaleString()}`;
}

export function paymentVoidedAtLabel(payment: Pick<PaymentRecord, "status" | "voided_at">): string | null {
  if (payment.status !== "voided" || !payment.voided_at) return null;
  return `Voided ${new Date(payment.voided_at).toLocaleString()}`;
}

export function paymentRecordConfirmationText(payment: PaymentRecord): string {
  return `Record ${payment.payment_number}? This creates an external payment record only and does not transfer, process, verify, settle, reconcile, or mark the invoice as paid.`;
}

export async function fetchInvoicePaymentSummary(invoiceId: string): Promise<InvoicePaymentSummary> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("get_invoice_payment_summary", { invoice_uuid: invoiceId });
  if (error) throw toReadablePaymentError(error);
  return data as InvoicePaymentSummary;
}

async function fetchPaymentRecords(): Promise<PaymentRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("payment_records")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw toReadablePaymentError(error);
  return (data ?? []) as PaymentRecord[];
}

export async function fetchManufacturerPaymentRecords(): Promise<PaymentRecord[]> {
  return fetchPaymentRecords();
}

export async function fetchBuyerPaymentRecords(): Promise<PaymentRecord[]> {
  return fetchPaymentRecords();
}

export async function fetchAdminPaymentRecords(): Promise<PaymentRecord[]> {
  return fetchPaymentRecords();
}

export async function fetchPaymentEvents(paymentId: string): Promise<PaymentEventRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("payment_events")
    .select("*")
    .eq("payment_record_id", paymentId)
    .order("created_at", { ascending: true });
  if (error) throw toReadablePaymentError(error);
  return (data ?? []) as PaymentEventRecord[];
}

export async function createPaymentRecord(
  invoiceId: string,
  values: Pick<PaymentDraftValues, "amount" | "paymentMethod">
): Promise<PaymentRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("create_payment_record", {
    invoice_uuid: invoiceId,
    amount_value: parseAmount(values.amount),
    payment_method_value: values.paymentMethod,
  });
  if (error) throw toReadablePaymentError(error);
  return data as PaymentRecord;
}

export async function updatePaymentRecordDraft(paymentId: string, values: PaymentDraftValues): Promise<PaymentRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("update_payment_record_draft", {
    payment_uuid: paymentId,
    amount_value: parseAmount(values.amount),
    payment_method_value: values.paymentMethod,
    payment_date_value: values.paymentDate || null,
    reference_number_text: values.referenceNumber.trim() || null,
    notes_text: values.notes.trim() || null,
  });
  if (error) throw toReadablePaymentError(error);
  return data as PaymentRecord;
}

export async function recordPayment(paymentId: string): Promise<PaymentRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("record_payment", { payment_uuid: paymentId });
  if (error) throw toReadablePaymentError(error);
  return data as PaymentRecord;
}

export async function voidPaymentRecord(paymentId: string, reason: string): Promise<PaymentRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("void_payment_record", {
    payment_uuid: paymentId,
    reason_text: reason.trim(),
  });
  if (error) throw toReadablePaymentError(error);
  return data as PaymentRecord;
}
