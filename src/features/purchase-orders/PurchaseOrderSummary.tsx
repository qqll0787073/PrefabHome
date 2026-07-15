import {
  purchaseOrderCancelledAtLabel,
  purchaseOrderConfirmedAtLabel,
  purchaseOrderDecisionLabels,
  purchaseOrderEventLabel,
  purchaseOrderLastSubmittedAtLabel,
  purchaseOrderRejectedAtLabel,
  purchaseOrderReviewRoundLabel,
  purchaseOrderSubmittedAtLabel,
  purchaseOrderStatusLabels,
  purchaseOrderSubtotalLabel,
} from "../../lib/purchaseOrders";
import type {
  PurchaseOrderDecisionRecord,
  PurchaseOrderEventRecord,
  PurchaseOrderWithItems,
} from "../../types";

interface PurchaseOrderSummaryProps {
  purchaseOrder: PurchaseOrderWithItems;
  decisions?: PurchaseOrderDecisionRecord[];
  events?: PurchaseOrderEventRecord[];
  showSnapshots?: boolean;
}

export function PurchaseOrderSummary({
  purchaseOrder,
  decisions = [],
  events = [],
  showSnapshots = false,
}: PurchaseOrderSummaryProps) {
  const quoteVersion = purchaseOrder.quote_snapshot.version;
  const manufacturerName =
    typeof purchaseOrder.manufacturer_snapshot.company_display_name === "string"
      ? purchaseOrder.manufacturer_snapshot.company_display_name
      : typeof purchaseOrder.manufacturer_snapshot.company_name === "string"
        ? purchaseOrder.manufacturer_snapshot.company_name
        : "Manufacturer";
  const buyerName =
    typeof purchaseOrder.buyer_snapshot.full_name === "string"
      ? purchaseOrder.buyer_snapshot.full_name
      : typeof purchaseOrder.buyer_snapshot.email === "string"
        ? purchaseOrder.buyer_snapshot.email
        : "Buyer";
  const submittedAtLabel = purchaseOrderSubmittedAtLabel(purchaseOrder);
  const cancelledAtLabel = purchaseOrderCancelledAtLabel(purchaseOrder);
  const lastSubmittedAtLabel = purchaseOrderLastSubmittedAtLabel(purchaseOrder);
  const confirmedAtLabel = purchaseOrderConfirmedAtLabel(purchaseOrder);
  const rejectedAtLabel = purchaseOrderRejectedAtLabel(purchaseOrder);

  return (
    <article className="review-item">
      <div>
        <p className="eyebrow">{purchaseOrderStatusLabels[purchaseOrder.status]}</p>
        <h3>{purchaseOrder.po_number}</h3>
        <p>
          {buyerName} to {manufacturerName}
        </p>
        <p>
          Quote version {String(quoteVersion ?? "accepted")} -{" "}
          {purchaseOrderSubtotalLabel(purchaseOrder)}
        </p>
        <p className="form-notice">{purchaseOrderReviewRoundLabel(purchaseOrder)}</p>
      </div>
      <div className="meta-row">
        {purchaseOrder.incoterm && <span>{purchaseOrder.incoterm}</span>}
        {purchaseOrder.requested_delivery_date && (
          <span>Requested {new Date(purchaseOrder.requested_delivery_date).toLocaleDateString()}</span>
        )}
        {submittedAtLabel && <span>{submittedAtLabel}</span>}
        {lastSubmittedAtLabel && <span>{lastSubmittedAtLabel}</span>}
        {confirmedAtLabel && <span>{confirmedAtLabel}</span>}
        {rejectedAtLabel && <span>{rejectedAtLabel}</span>}
        {cancelledAtLabel && <span>{cancelledAtLabel}</span>}
      </div>
      <div className="quote-line-items">
        {purchaseOrder.items.map((item) => (
          <div className="meta-row" key={item.id}>
            <span>{item.description}</span>
            <span>
              {item.quantity} {item.unit || "unit"}
            </span>
            <span>{purchaseOrderSubtotalLabel({ subtotal: item.amount, currency: purchaseOrder.currency })}</span>
          </div>
        ))}
      </div>
      {purchaseOrder.buyer_reference && <p>Buyer reference: {purchaseOrder.buyer_reference}</p>}
      {purchaseOrder.buyer_note && <p>{purchaseOrder.buyer_note}</p>}
      {decisions.length > 0 && (
        <div className="quote-line-items">
          {decisions.map((decision) => (
            <div className="meta-row" key={decision.id}>
              <span>
                Round {decision.review_round}: {purchaseOrderDecisionLabels[decision.decision]}
              </span>
              {decision.reason && <span>{decision.reason}</span>}
              <span>{new Date(decision.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
      {showSnapshots && (
        <div className="quote-line-items">
          <p>RFQ: {purchaseOrder.rfq_id}</p>
          <p>Accepted Quote: {purchaseOrder.quote_id}</p>
          <p>Decision: {purchaseOrder.quote_decision_id}</p>
          <p>Product: {purchaseOrder.product_snapshot.name ?? purchaseOrder.product_snapshot.model_name ?? "Snapshot"}</p>
        </div>
      )}
      {events.length > 0 && (
        <div className="quote-line-items">
          {events.map((event) => (
            <div className="meta-row" key={event.id}>
              <span>{purchaseOrderEventLabel(event)}</span>
              <span>{new Date(event.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
