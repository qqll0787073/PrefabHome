import {
  signatureDeliveryCancelledAtLabel,
  signatureDeliveryEventLabel,
  signatureDeliveryProviderLabel,
  signatureDeliveryQueuedAtLabel,
  signatureDeliveryQueuedNotice,
  signatureDeliveryStatusLabels,
} from "../../lib/signatureDelivery";
import type {
  SignatureDeliveryEventRecord,
  SignatureDeliveryRecipientRecord,
  SignatureDeliveryRequestRecord,
} from "../../types";

interface SignatureDeliverySummaryProps {
  delivery: SignatureDeliveryRequestRecord;
  recipients?: SignatureDeliveryRecipientRecord[];
  events?: SignatureDeliveryEventRecord[];
  showSnapshots?: boolean;
}

export function SignatureDeliverySummary({
  delivery,
  recipients = [],
  events = [],
  showSnapshots = false,
}: SignatureDeliverySummaryProps) {
  return (
    <article className="quote-card">
      <div className="quote-card-header">
        <div>
          <p className="eyebrow">{delivery.delivery_number}</p>
          <h5>{delivery.contract_number}</h5>
        </div>
        <span className={`status status-${delivery.status}`}>{signatureDeliveryStatusLabels[delivery.status]}</span>
      </div>
      <p className="form-notice">{delivery.package_number}</p>
      <p className="form-notice">{signatureDeliveryProviderLabel(delivery)}</p>
      {delivery.status === "queued" && <p className="form-notice">{signatureDeliveryQueuedNotice()}</p>}
      {delivery.status === "cancelled" && (
        <p className="form-notice">Cancelled reason: {delivery.cancellation_reason}</p>
      )}
      <div className="meta-grid">
        <span>Created {new Date(delivery.created_at).toLocaleString()}</span>
        {signatureDeliveryQueuedAtLabel(delivery) && <span>{signatureDeliveryQueuedAtLabel(delivery)}</span>}
        {signatureDeliveryCancelledAtLabel(delivery) && <span>{signatureDeliveryCancelledAtLabel(delivery)}</span>}
      </div>
      {recipients.length > 0 && (
        <div className="quote-line-items">
          {recipients.map((recipient) => (
            <div className="meta-row" key={recipient.id}>
              <span>Order {recipient.signing_order}: {recipient.participant_role}</span>
              <span>{recipient.full_name}</span>
              <span>{recipient.email}</span>
              <span>{recipient.delivery_status}</span>
            </div>
          ))}
        </div>
      )}
      {events.length > 0 && (
        <div className="timeline-list">
          {events.map((event) => (
            <div key={event.id} className="timeline-item">
              <span>{new Date(event.created_at).toLocaleString()}</span>
              <strong>{signatureDeliveryEventLabel(event)}</strong>
            </div>
          ))}
        </div>
      )}
      {showSnapshots && (
        <div className="snapshot-list">
          <span>Signature package: {delivery.signature_package_id}</span>
          <span>Contract: {delivery.contract_id}</span>
          <span>Provider key: {delivery.provider_key}</span>
          <span>Package snapshot fields: {Object.keys(delivery.package_snapshot).length}</span>
          <span>Recipient snapshot rows: {delivery.recipient_snapshot.length}</span>
          <span>Request payload fields: {Object.keys(delivery.request_payload_snapshot).length}</span>
        </div>
      )}
    </article>
  );
}
