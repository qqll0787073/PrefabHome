import { useEffect, useMemo, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import { fetchManufacturerInvoices, invoiceAmountLabel } from "../../lib/invoices";
import {
  canCreatePaymentRecord,
  canRecordPayment,
  canVoidPayment,
  createPaymentRecord,
  emptyPaymentDraftValues,
  externalPaymentRecordNotice,
  fetchInvoicePaymentSummary,
  fetchManufacturerPaymentRecords,
  fetchPaymentEvents,
  isPaymentRecordReadOnly,
  isPaymentRecordReady,
  paymentMethods,
  paymentRecordConfirmationText,
  paymentSummaryLabels,
  recordPayment,
  updatePaymentRecordDraft,
  validatePaymentDraftValues,
  validatePaymentVoidReason,
  voidPaymentRecord,
} from "../../lib/payments";
import type {
  InvoicePaymentSummary,
  InvoiceRecord,
  PaymentDraftValues,
  PaymentEventRecord,
  PaymentRecord,
} from "../../types";
import { PaymentRecordSummary } from "./PaymentRecordSummary";

interface ManufacturerPaymentsProps {
  authMode: "supabase" | "demo";
}

export function ManufacturerPayments({ authMode }: ManufacturerPaymentsProps) {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [summaries, setSummaries] = useState<Record<string, InvoicePaymentSummary>>({});
  const [eventsByPayment, setEventsByPayment] = useState<Record<string, PaymentEventRecord[]>>({});
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);
  const [draftValues, setDraftValues] = useState<PaymentDraftValues>(emptyPaymentDraftValues());
  const [voidReason, setVoidReason] = useState("");
  const [isLoading, setIsLoading] = useState(authMode === "supabase");
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function loadPayments() {
    setErrors([]);
    setIsLoading(true);
    try {
      if (authMode === "demo") {
        setInvoices([]);
        setPayments([]);
        setSummaries({});
        setEventsByPayment({});
      } else {
        const [invoiceRows, paymentRows] = await Promise.all([
          fetchManufacturerInvoices(),
          fetchManufacturerPaymentRecords(),
        ]);
        const issuedInvoices = invoiceRows.filter((invoice) => invoice.status === "issued");
        const summaryEntries = await Promise.all(
          issuedInvoices.map(async (invoice) => [invoice.id, await fetchInvoicePaymentSummary(invoice.id)] as const)
        );
        const eventEntries = await Promise.all(
          paymentRows.map(async (payment) => [payment.id, await fetchPaymentEvents(payment.id)] as const)
        );
        setInvoices(invoiceRows);
        setPayments(paymentRows);
        setSummaries(Object.fromEntries(summaryEntries));
        setEventsByPayment(Object.fromEntries(eventEntries));
        if (selectedPayment) {
          const refreshed = paymentRows.find((payment) => payment.id === selectedPayment.id) ?? null;
          setSelectedPayment(refreshed);
          setDraftValues(emptyPaymentDraftValues(refreshed));
        }
      }
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to load payment records."]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadPayments();
  }, [authMode]);

  const eligibleInvoices = useMemo(
    () => invoices.filter((invoice) => canCreatePaymentRecord(invoice, summaries[invoice.id])),
    [invoices, summaries]
  );

  function selectPayment(payment: PaymentRecord) {
    setSelectedPayment(payment);
    setDraftValues(emptyPaymentDraftValues(payment));
    setVoidReason("");
    setErrors([]);
  }

  async function createPayment(invoiceId: string) {
    const summary = summaries[invoiceId];
    const initialAmount = summary ? String(summary.remaining_balance) : "";
    const values = { ...emptyPaymentDraftValues(), amount: initialAmount };
    const validationErrors = validatePaymentDraftValues(values, summary?.remaining_balance);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    setIsSaving(true);
    setErrors([]);
    try {
      const created = await createPaymentRecord(invoiceId, values);
      setSelectedPayment(created);
      setDraftValues(emptyPaymentDraftValues(created));
      await loadPayments();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to create payment record."]);
    } finally {
      setIsSaving(false);
    }
  }

  async function saveDraft() {
    if (!selectedPayment) return;
    const summary = summaries[selectedPayment.invoice_id];
    const validationErrors = validatePaymentDraftValues(draftValues, summary?.remaining_balance);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    setIsSaving(true);
    setErrors([]);
    try {
      const updated = await updatePaymentRecordDraft(selectedPayment.id, draftValues);
      setSelectedPayment(updated);
      setDraftValues(emptyPaymentDraftValues(updated));
      await loadPayments();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to update payment draft."]);
    } finally {
      setIsSaving(false);
    }
  }

  async function recordSelectedPayment() {
    if (!selectedPayment) return;
    const summary = summaries[selectedPayment.invoice_id];
    const validationErrors = validatePaymentDraftValues(draftValues, summary?.remaining_balance);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    if (!window.confirm(paymentRecordConfirmationText(selectedPayment))) return;
    setIsSaving(true);
    setErrors([]);
    try {
      await updatePaymentRecordDraft(selectedPayment.id, draftValues);
      const recorded = await recordPayment(selectedPayment.id);
      setSelectedPayment(recorded);
      await loadPayments();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to record payment."]);
    } finally {
      setIsSaving(false);
    }
  }

  async function voidSelectedPayment() {
    if (!selectedPayment) return;
    const validationErrors = validatePaymentVoidReason(voidReason);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    setIsSaving(true);
    setErrors([]);
    try {
      const voided = await voidPaymentRecord(selectedPayment.id, voidReason);
      setSelectedPayment(voided);
      setVoidReason("");
      await loadPayments();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to void payment record."]);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="quote-panel">
      <h4>Payment Recording</h4>
      {isLoading && <LoadingState message="Loading payment records..." />}
      <ErrorList errors={errors} />
      <p className="form-notice">{externalPaymentRecordNotice()}</p>

      {eligibleInvoices.length > 0 && (
        <div className="review-list">
          {eligibleInvoices.map((invoice) => {
            const summary = summaries[invoice.id];
            const labels = summary ? paymentSummaryLabels(summary) : null;
            return (
              <article className="quote-card" key={invoice.id}>
                <div className="quote-card-header">
                  <div>
                    <p className="eyebrow">Issued invoice</p>
                    <h5>{invoice.invoice_number}</h5>
                  </div>
                  <span>{invoiceAmountLabel(invoice)}</span>
                </div>
                {labels && <p>Remaining balance: {labels.remaining}</p>}
                <button disabled={isSaving} onClick={() => void createPayment(invoice.id)}>
                  Create Payment Record
                </button>
              </article>
            );
          })}
        </div>
      )}

      {payments.length === 0 && eligibleInvoices.length === 0 && !isLoading && <p>No issued invoices with remaining balance yet.</p>}

      <div className="review-list">
        {payments.map((payment) => (
          <div key={payment.id}>
            <button className="secondary-button" onClick={() => selectPayment(payment)}>
              Open {payment.payment_number}
            </button>
            <PaymentRecordSummary
              payment={payment}
              summary={summaries[payment.invoice_id]}
              events={eventsByPayment[payment.id] ?? []}
            />
          </div>
        ))}
      </div>

      {selectedPayment && (
        <section className="panel">
          <p className="eyebrow">Selected Payment Record</p>
          <h4>{selectedPayment.payment_number}</h4>
          <div className="form-grid">
            <label>
              Amount
              <input
                disabled={isPaymentRecordReadOnly(selectedPayment)}
                inputMode="decimal"
                value={draftValues.amount}
                onChange={(event) => setDraftValues({ ...draftValues, amount: event.target.value })}
              />
            </label>
            <label>
              Method
              <select
                disabled={isPaymentRecordReadOnly(selectedPayment)}
                value={draftValues.paymentMethod}
                onChange={(event) => setDraftValues({ ...draftValues, paymentMethod: event.target.value as PaymentDraftValues["paymentMethod"] })}
              >
                {paymentMethods.map((method) => (
                  <option value={method} key={method}>{method}</option>
                ))}
              </select>
            </label>
            <label>
              External payment date
              <input
                disabled={isPaymentRecordReadOnly(selectedPayment)}
                type="date"
                value={draftValues.paymentDate}
                onChange={(event) => setDraftValues({ ...draftValues, paymentDate: event.target.value })}
              />
            </label>
            <label>
              External reference
              <input
                disabled={isPaymentRecordReadOnly(selectedPayment)}
                value={draftValues.referenceNumber}
                onChange={(event) => setDraftValues({ ...draftValues, referenceNumber: event.target.value })}
              />
            </label>
          </div>
          <textarea
            disabled={isPaymentRecordReadOnly(selectedPayment)}
            placeholder="Notes"
            value={draftValues.notes}
            onChange={(event) => setDraftValues({ ...draftValues, notes: event.target.value })}
          />
          {canRecordPayment(selectedPayment) && (
            <div className="portal-actions">
              <button disabled={isSaving} onClick={() => void saveDraft()}>
                Save Draft
              </button>
              <button
                disabled={isSaving || !isPaymentRecordReady(draftValues, summaries[selectedPayment.invoice_id]?.remaining_balance)}
                onClick={() => void recordSelectedPayment()}
              >
                Record Payment
              </button>
            </div>
          )}
          {canVoidPayment(selectedPayment) && (
            <div className="portal-actions">
              <textarea
                placeholder="Void reason"
                value={voidReason}
                onChange={(event) => setVoidReason(event.target.value)}
              />
              <button disabled={isSaving} onClick={() => void voidSelectedPayment()}>
                Void Payment Record
              </button>
            </div>
          )}
        </section>
      )}
    </section>
  );
}
