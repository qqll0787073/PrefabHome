import {
  signaturePackageEventLabel,
  signaturePackageReadyAtLabel,
  signaturePackageStatusLabels,
  signatureParticipantLabels,
  signatureParticipantOrderLabel,
  sortSignatureParticipants,
} from "../../lib/signaturePreparation";
import type {
  SignaturePackageEventRecord,
  SignaturePackageRecord,
  SignatureParticipantRecord,
} from "../../types";

interface SignaturePackageSummaryProps {
  signaturePackage: SignaturePackageRecord;
  participants?: SignatureParticipantRecord[];
  events?: SignaturePackageEventRecord[];
  showSnapshots?: boolean;
}

export function SignaturePackageSummary({
  signaturePackage,
  participants = [],
  events = [],
  showSnapshots = false,
}: SignaturePackageSummaryProps) {
  const sortedParticipants = sortSignatureParticipants(participants);
  const readyAtLabel = signaturePackageReadyAtLabel(signaturePackage);

  return (
    <article className="review-item">
      <div>
        <p className="eyebrow">{signaturePackageStatusLabels[signaturePackage.status]}</p>
        <h3>{signaturePackage.package_number}</h3>
        <p>{signaturePackage.contract_number}</p>
        <p className="form-notice">Prepared only - not sent or signed.</p>
      </div>
      <div className="meta-row">
        <span>Created {new Date(signaturePackage.created_at).toLocaleString()}</span>
        {readyAtLabel && <span>{readyAtLabel}</span>}
        <span>Version {signaturePackage.version}</span>
      </div>
      <div className="quote-line-items">
        {sortedParticipants.map((participant) => (
          <div className="meta-row" key={participant.id}>
            <span>{signatureParticipantOrderLabel(participant)}</span>
            <span>{participant.full_name ?? `${signatureParticipantLabels[participant.participant_role]} pending`}</span>
            <span>{participant.email ?? "Email pending"}</span>
            {participant.title && <span>{participant.title}</span>}
          </div>
        ))}
      </div>
      {showSnapshots && (
        <div className="quote-line-items">
          <p>Contract: {signaturePackage.contract_id}</p>
          <p>Created by: {signaturePackage.created_by}</p>
          <p>Buyer: {signaturePackage.buyer_id}</p>
          <p>Manufacturer: {signaturePackage.manufacturer_id}</p>
        </div>
      )}
      {events.length > 0 && (
        <div className="quote-line-items">
          {events.map((event) => (
            <div className="meta-row" key={event.id}>
              <span>{signaturePackageEventLabel(event)}</span>
              <span>{new Date(event.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
