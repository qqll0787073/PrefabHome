import { useEffect, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import {
  externalPaymentRecordNotice,
  fetchAdminPaymentRecords,
  fetchInvoicePaymentSummary,
  fetchPaymentEvents,
} from "../../lib/payments";
import type { InvoicePaymentSummary, PaymentEventRecord, PaymentRecord } from "../../types";
import { PaymentRecordSummary } from "./PaymentRecordSummary";

interface AdminPaymentsProps {
  authMode: "supabase" | "demo";
}

export function AdminPayments({ authMode }: AdminPaymentsProps) {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [summaries, setSummaries] = useState<Record<string, InvoicePaymentSummary>>({});
  const [eventsByPayment, setEventsByPayment] = useState<Record<string, PaymentEventRecord[]>>({});
  const [isLoading, setIsLoading] = useState(authMode === "supabase");
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    async function loadPayments() {
      setErrors([]);
      setIsLoading(true);
      try {
        if (authMode === "demo") {
          setPayments([]);
          setSummaries({});
          setEventsByPayment({});
        } else {
          const paymentRows = await fetchAdminPaymentRecords();
          const invoiceIds = [...new Set(paymentRows.map((payment) => payment.invoice_id))];
          const [summaryEntries, eventEntries] = await Promise.all([
            Promise.all(invoiceIds.map(async (invoiceId) => [invoiceId, await fetchInvoicePaymentSummary(invoiceId)] as const)),
            Promise.all(paymentRows.map(async (payment) => [payment.id, await fetchPaymentEvents(payment.id)] as const)),
          ]);
          setPayments(paymentRows);
          setSummaries(Object.fromEntries(summaryEntries));
          setEventsByPayment(Object.fromEntries(eventEntries));
        }
      } catch (error) {
        setErrors([error instanceof Error ? error.message : "Unable to load payment records."]);
      } finally {
        setIsLoading(false);
      }
    }

    void loadPayments();
  }, [authMode]);

  return (
    <section className="quote-panel">
      <h4>Admin Payment Records</h4>
      {isLoading && <LoadingState message="Loading payment records..." />}
      <ErrorList errors={errors} />
      <p className="form-notice">Admin payment access is read-only in PH-009B. {externalPaymentRecordNotice()}</p>
      {payments.length === 0 && !isLoading && <p>No payment records yet.</p>}
      <div className="review-list">
        {payments.map((payment) => (
          <PaymentRecordSummary
            key={payment.id}
            payment={payment}
            summary={summaries[payment.invoice_id]}
            events={eventsByPayment[payment.id] ?? []}
            showSnapshots
          />
        ))}
      </div>
    </section>
  );
}
