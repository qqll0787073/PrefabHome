import {
  externalPaymentRecordNotice,
  paymentAmountLabel,
  paymentEventLabel,
  paymentMethodLabels,
  paymentRecordedAtLabel,
  paymentStatusLabels,
  paymentSummaryLabels,
  paymentVoidedAtLabel,
} from "../../lib/payments";
import type { InvoicePaymentSummary, PaymentEventRecord, PaymentRecord } from "../../types";

interface PaymentRecordSummaryProps {
  payment: PaymentRecord;
  summary?: InvoicePaymentSummary | null;
  events?: PaymentEventRecord[];
  showSnapshots?: boolean;
}

export function PaymentRecordSummary({
  payment,
  summary,
  events = [],
  showSnapshots = false,
}: PaymentRecordSummaryProps) {
  const labels = summary ? paymentSummaryLabels(summary) : null;
  const recordedAtLabel = paymentRecordedAtLabel(payment);
  const voidedAtLabel = paymentVoidedAtLabel(payment);

  return (
    <article className="quote-card">
      <div className="quote-card-header">
        <div>
          <p className="eyebrow">{payment.payment_number}</p>
          <h5>{payment.invoice_number}</h5>
        </div>
        <span className={`status status-${payment.status}`}>{paymentStatusLabels[payment.status]}</span>
      </div>
      <p className="form-notice">{externalPaymentRecordNotice()}</p>
      <div className="meta-grid">
        <span>Method {paymentMethodLabels[payment.payment_method]}</span>
        <span>Amount {paymentAmountLabel(payment)}</span>
        <span>Contract {payment.contract_number}</span>
        <span>PO {payment.purchase_order_number}</span>
        {payment.payment_date && <span>External date {new Date(payment.payment_date).toLocaleDateString()}</span>}
        {recordedAtLabel && <span>{recordedAtLabel}</span>}
        {voidedAtLabel && <span>{voidedAtLabel}</span>}
        {payment.reference_number && <span>Reference {payment.reference_number}</span>}
      </div>
      {labels && (
        <div className="quote-line-items">
          <div className="meta-row">
            <span>Invoice total</span>
            <span>{labels.total}</span>
          </div>
          <div className="meta-row">
            <span>Recorded amount</span>
            <span>{labels.recorded}</span>
          </div>
          <div className="meta-row">
            <span>Remaining balance</span>
            <span>{labels.remaining}</span>
          </div>
          <div className="meta-row">
            <span>Recorded entries</span>
            <span>{summary?.recorded_payment_count ?? 0}</span>
          </div>
        </div>
      )}
      {payment.notes && <p>Notes: {payment.notes}</p>}
      {payment.status === "voided" && payment.void_reason && (
        <p className="form-notice">Void reason: {payment.void_reason}</p>
      )}
      {events.length > 0 && (
        <div className="timeline-list">
          {events.map((event) => (
            <div className="timeline-item" key={event.id}>
              <span>{new Date(event.created_at).toLocaleString()}</span>
              <strong>{paymentEventLabel(event)}</strong>
            </div>
          ))}
        </div>
      )}
      {showSnapshots && (
        <div className="snapshot-list">
          <span>Invoice source: {payment.invoice_id}</span>
          <span>Contract: {payment.contract_id}</span>
          <span>PO: {payment.purchase_order_id}</span>
          <span>Invoice snapshot fields: {Object.keys(payment.invoice_snapshot).length}</span>
          <span>Party snapshot fields: {Object.keys(payment.party_snapshot).length}</span>
          <span>Payment snapshot fields: {Object.keys(payment.payment_snapshot).length}</span>
        </div>
      )}
    </article>
  );
}
