import {
  shippingEventLabel,
  shippingIncotermLabels,
  shippingModeLabels,
  shippingPlanningDisclaimer,
  shippingStatusLabels,
} from "../../lib/shippingReadiness";
import type { ShippingAddress, ShippingReadinessEventRecord, ShippingReadinessRecord } from "../../types";

interface ShippingReadinessSummaryProps {
  record: ShippingReadinessRecord;
  events?: ShippingReadinessEventRecord[];
  showSnapshots?: boolean;
}

function addressText(address: ShippingAddress | null): string {
  if (!address) return "Not provided";
  return [
    address.address_line1,
    address.address_line2,
    address.city,
    address.state_region,
    address.postal_code,
    address.country_code,
  ].filter(Boolean).join(", ");
}

export function ShippingReadinessSummary({
  record,
  events = [],
  showSnapshots = false,
}: ShippingReadinessSummaryProps) {
  return (
    <article className="quote-card">
      <div className="quote-card-header">
        <div>
          <p className="eyebrow">{record.shipping_number}</p>
          <h5>{record.purchase_order_number}</h5>
        </div>
        <span className={`status status-${record.status}`}>{shippingStatusLabels[record.status]}</span>
      </div>
      <p className="form-notice">{shippingPlanningDisclaimer()}</p>
      <div className="meta-grid">
        <span>Mode {shippingModeLabels[record.shipping_mode]}</span>
        <span>Incoterm {shippingIncotermLabels[record.incoterm ?? "UNSPECIFIED"]}</span>
        <span>Contract {record.contract_number}</span>
        <span>Invoice {record.invoice_number}</span>
        {record.estimated_ready_date && <span>Estimated ready {new Date(record.estimated_ready_date).toLocaleDateString()}</span>}
        {record.requested_ship_date && <span>Requested ship {new Date(record.requested_ship_date).toLocaleDateString()}</span>}
        {record.ready_at && <span>Ready {new Date(record.ready_at).toLocaleString()}</span>}
        {record.cancelled_at && <span>Cancelled {new Date(record.cancelled_at).toLocaleString()}</span>}
      </div>
      <div className="quote-line-items">
        <div className="meta-row">
          <span>Origin</span>
          <span>{addressText(record.origin_address)}</span>
        </div>
        <div className="meta-row">
          <span>Destination</span>
          <span>{addressText(record.destination_address)}</span>
        </div>
        <div className="meta-row">
          <span>Cargo</span>
          <span>{record.cargo_description ?? "Not provided"}</span>
        </div>
        <div className="meta-row">
          <span>Packages</span>
          <span>{record.package_count ?? "Not provided"}</span>
        </div>
        <div className="meta-row">
          <span>Gross weight kg</span>
          <span>{record.gross_weight_kg ?? "Not provided"}</span>
        </div>
        <div className="meta-row">
          <span>Volume cbm</span>
          <span>{record.volume_cbm ?? "Not provided"}</span>
        </div>
      </div>
      {record.special_instructions && <p>Special instructions: {record.special_instructions}</p>}
      {record.status === "cancelled" && record.cancellation_reason && (
        <p className="form-notice">Cancellation reason: {record.cancellation_reason}</p>
      )}
      {events.length > 0 && (
        <div className="timeline-list">
          {events.map((event) => (
            <div className="timeline-item" key={event.id}>
              <span>{new Date(event.created_at).toLocaleString()}</span>
              <strong>{shippingEventLabel(event)}</strong>
            </div>
          ))}
        </div>
      )}
      {showSnapshots && (
        <div className="snapshot-list">
          <span>PO source: {record.purchase_order_id}</span>
          <span>Contract: {record.contract_id}</span>
          <span>Invoice: {record.invoice_id}</span>
          <span>PO snapshot fields: {Object.keys(record.purchase_order_snapshot).length}</span>
          <span>Contract snapshot fields: {Object.keys(record.contract_snapshot).length}</span>
          <span>Invoice snapshot fields: {Object.keys(record.invoice_snapshot).length}</span>
          <span>Cargo snapshot fields: {Object.keys(record.cargo_snapshot).length}</span>
          <span>Readiness snapshot fields: {Object.keys(record.readiness_snapshot).length}</span>
        </div>
      )}
    </article>
  );
}
