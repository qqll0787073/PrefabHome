import {
  invoiceAmountLabel,
  invoiceCancelledAtLabel,
  invoiceEventLabel,
  invoiceIssuedAtLabel,
  invoiceNoPaymentNotice,
  invoiceStatusLabels,
  invoiceSubtotalLabel,
  invoiceTaxDisclaimer,
} from "../../lib/invoices";
import type { InvoiceEventRecord, InvoiceLineItemRecord, InvoiceRecord } from "../../types";

interface InvoiceSummaryProps {
  invoice: InvoiceRecord;
  lineItems?: InvoiceLineItemRecord[];
  events?: InvoiceEventRecord[];
  showSnapshots?: boolean;
}

export function InvoiceSummary({
  invoice,
  lineItems = [],
  events = [],
  showSnapshots = false,
}: InvoiceSummaryProps) {
  const buyerName =
    typeof invoice.buyer_snapshot.full_name === "string"
      ? invoice.buyer_snapshot.full_name
      : typeof invoice.buyer_snapshot.email === "string"
        ? invoice.buyer_snapshot.email
        : "Buyer";
  const manufacturerName =
    typeof invoice.manufacturer_snapshot.company_display_name === "string"
      ? invoice.manufacturer_snapshot.company_display_name
      : typeof invoice.manufacturer_snapshot.company_name === "string"
        ? invoice.manufacturer_snapshot.company_name
        : "Manufacturer";
  const issuedAtLabel = invoiceIssuedAtLabel(invoice);
  const cancelledAtLabel = invoiceCancelledAtLabel(invoice);

  return (
    <article className="quote-card">
      <div className="quote-card-header">
        <div>
          <p className="eyebrow">{invoice.invoice_number}</p>
          <h5>{invoice.purchase_order_number}</h5>
        </div>
        <span className={`status status-${invoice.status}`}>{invoiceStatusLabels[invoice.status]}</span>
      </div>
      <p>
        {buyerName} to {manufacturerName}
      </p>
      <p className="form-notice">{invoiceNoPaymentNotice()}</p>
      <p className="form-notice">{invoiceTaxDisclaimer()}</p>
      <div className="meta-grid">
        <span>Contract {invoice.contract_number}</span>
        <span>Subtotal {invoiceSubtotalLabel(invoice)}</span>
        <span>Total {invoiceAmountLabel(invoice)}</span>
        {invoice.issue_date && <span>Issue date {new Date(invoice.issue_date).toLocaleDateString()}</span>}
        {invoice.due_date && <span>Due date {new Date(invoice.due_date).toLocaleDateString()}</span>}
        {issuedAtLabel && <span>{issuedAtLabel}</span>}
        {cancelledAtLabel && <span>{cancelledAtLabel}</span>}
      </div>
      {invoice.status === "cancelled" && invoice.cancellation_reason && (
        <p className="form-notice">Cancellation reason: {invoice.cancellation_reason}</p>
      )}
      <div className="quote-line-items">
        <div className="meta-row">
          <span>Tax</span>
          <span>{invoiceAmountLabel({ total_amount: invoice.tax_amount, currency: invoice.currency })}</span>
        </div>
        <div className="meta-row">
          <span>Shipping</span>
          <span>{invoiceAmountLabel({ total_amount: invoice.shipping_amount, currency: invoice.currency })}</span>
        </div>
        <div className="meta-row">
          <span>Discount</span>
          <span>{invoiceAmountLabel({ total_amount: invoice.discount_amount, currency: invoice.currency })}</span>
        </div>
      </div>
      {lineItems.length > 0 && (
        <div className="quote-line-items">
          {lineItems.map((item) => (
            <div className="meta-row" key={item.id}>
              <span>{item.line_number}. {item.description}</span>
              <span>{item.quantity}</span>
              <span>{invoiceAmountLabel({ total_amount: item.unit_price, currency: invoice.currency })}</span>
              <span>{invoiceAmountLabel({ total_amount: item.line_subtotal, currency: invoice.currency })}</span>
            </div>
          ))}
        </div>
      )}
      {invoice.billing_name && <p>Billing: {invoice.billing_name}</p>}
      {invoice.billing_email && <p>{invoice.billing_email}</p>}
      {events.length > 0 && (
        <div className="timeline-list">
          {events.map((event) => (
            <div className="timeline-item" key={event.id}>
              <span>{new Date(event.created_at).toLocaleString()}</span>
              <strong>{invoiceEventLabel(event)}</strong>
            </div>
          ))}
        </div>
      )}
      {showSnapshots && (
        <div className="snapshot-list">
          <span>Invoice source PO: {invoice.purchase_order_id}</span>
          <span>Contract: {invoice.contract_id}</span>
          <span>Contract snapshot fields: {Object.keys(invoice.contract_snapshot).length}</span>
          <span>PO snapshot fields: {Object.keys(invoice.purchase_order_snapshot).length}</span>
          <span>Line-item snapshot rows: {invoice.line_items_snapshot.length}</span>
          <span>Amount snapshot fields: {Object.keys(invoice.amount_snapshot).length}</span>
        </div>
      )}
    </article>
  );
}
