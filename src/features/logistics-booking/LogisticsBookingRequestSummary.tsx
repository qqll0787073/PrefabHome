import {
  logisticsBookingEventLabels,
  logisticsBookingStatusLabels,
  logisticsContainerPreferenceLabels,
  logisticsPlanningDisclaimer,
} from "../../lib/logisticsBookingRequests";
import type { LogisticsBookingRequestEventRecord, LogisticsBookingRequestRecord, ShippingAddress } from "../../types";

interface LogisticsBookingRequestSummaryProps {
  request: LogisticsBookingRequestRecord;
  events?: LogisticsBookingRequestEventRecord[];
  showSnapshots?: boolean;
}

function locationText(location: ShippingAddress | null): string {
  if (!location) return "Not provided";
  return [location.address_line1, location.address_line2, location.city, location.state_region, location.postal_code, location.country_code].filter(Boolean).join(", ");
}

export function LogisticsBookingRequestSummary({ request, events = [], showSnapshots = false }: LogisticsBookingRequestSummaryProps) {
  return (
    <article className="quote-card">
      <div className="quote-card-header">
        <div>
          <p className="eyebrow">{request.booking_request_number}</p>
          <h5>{request.shipping_number}</h5>
        </div>
        <span className={`status status-${request.status}`}>{logisticsBookingStatusLabels[request.status]}</span>
      </div>
      <p className="form-notice">{logisticsPlanningDisclaimer()}</p>
      <div className="meta-grid">
        <span>Mode {request.requested_transport_mode}</span>
        <span>Incoterm {request.requested_incoterm ?? "Unspecified"}</span>
        <span>Container {request.container_preference ? logisticsContainerPreferenceLabels[request.container_preference] : "Not specified"}</span>
        <span>PO {request.purchase_order_number}</span>
        <span>Contract {request.contract_number}</span>
        <span>Invoice {request.invoice_number}</span>
        {request.preferred_departure_date && <span>Preferred departure {new Date(request.preferred_departure_date).toLocaleDateString()}</span>}
        {request.latest_acceptable_departure_date && <span>Latest acceptable {new Date(request.latest_acceptable_departure_date).toLocaleDateString()}</span>}
        {request.submitted_at && <span>Submitted {new Date(request.submitted_at).toLocaleString()}</span>}
        {request.withdrawn_at && <span>Withdrawn {new Date(request.withdrawn_at).toLocaleString()}</span>}
      </div>
      <div className="quote-line-items">
        <div className="meta-row"><span>Origin</span><span>{locationText(request.origin_location)}</span></div>
        <div className="meta-row"><span>Destination</span><span>{locationText(request.destination_location)}</span></div>
        <div className="meta-row"><span>Cargo</span><span>{request.cargo_description ?? "Not provided"}</span></div>
        <div className="meta-row"><span>Packages</span><span>{request.package_count ?? "Not provided"}</span></div>
        <div className="meta-row"><span>Gross weight kg</span><span>{request.gross_weight_kg ?? "Not provided"}</span></div>
        <div className="meta-row"><span>Volume cbm</span><span>{request.volume_cbm ?? "Not provided"}</span></div>
      </div>
      {request.withdrawal_reason && <p className="form-notice">Withdrawal reason: {request.withdrawal_reason}</p>}
      {events.length > 0 && (
        <div className="timeline-list">
          {events.map((event) => (
            <div className="timeline-item" key={event.id}>
              <span>{new Date(event.created_at).toLocaleString()}</span>
              <strong>{logisticsBookingEventLabels[event.event_type]}</strong>
            </div>
          ))}
        </div>
      )}
      {showSnapshots && (
        <div className="snapshot-list">
          <span>Shipping readiness: {request.shipping_readiness_id}</span>
          <span>Source snapshot fields: {Object.keys(request.source_snapshot).length}</span>
          <span>Party snapshot fields: {Object.keys(request.party_snapshot).length}</span>
          <span>Cargo snapshot fields: {Object.keys(request.cargo_snapshot).length}</span>
          <span>Request snapshot fields: {Object.keys(request.booking_request_snapshot).length}</span>
        </div>
      )}
    </article>
  );
}
