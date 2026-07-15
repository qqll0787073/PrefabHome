import {
  contractCreatedAtLabel,
  contractEventLabel,
  contractParticipantName,
  contractReadyAtLabel,
  contractStatusLabels,
  contractSubtotalLabel,
} from "../../lib/contracts";
import type { ContractEventRecord, ContractRecord } from "../../types";

interface ContractSummaryProps {
  contract: ContractRecord;
  events?: ContractEventRecord[];
  showSnapshots?: boolean;
}

export function ContractSummary({
  contract,
  events = [],
  showSnapshots = false,
}: ContractSummaryProps) {
  const buyerName = contractParticipantName(contract.buyer_snapshot, "Buyer");
  const manufacturerName = contractParticipantName(contract.manufacturer_snapshot, "Manufacturer");
  const readyAtLabel = contractReadyAtLabel(contract);
  const productName =
    typeof contract.product_snapshot.name === "string"
      ? contract.product_snapshot.name
      : typeof contract.product_snapshot.model_name === "string"
        ? contract.product_snapshot.model_name
        : "Product snapshot";

  return (
    <article className="review-item">
      <div>
        <p className="eyebrow">{contractStatusLabels[contract.status]}</p>
        <h3>{contract.contract_number}</h3>
        <p>
          {buyerName} to {manufacturerName}
        </p>
        <p>
          {contract.po_number} - {productName} - {contractSubtotalLabel(contract)}
        </p>
        {contract.contract_title && <p className="form-notice">{contract.contract_title}</p>}
      </div>
      <div className="meta-row">
        <span>{contractCreatedAtLabel(contract)}</span>
        {readyAtLabel && <span>{readyAtLabel}</span>}
        {contract.governing_law && <span>Law: {contract.governing_law}</span>}
      </div>
      <div className="quote-line-items">
        {contract.line_items_snapshot.map((item, index) => (
          <div className="meta-row" key={`${contract.id}-item-${index}`}>
            <span>{typeof item.description === "string" ? item.description : "Line item"}</span>
            <span>
              {typeof item.quantity === "number" ? item.quantity : 1}{" "}
              {typeof item.unit === "string" ? item.unit : "unit"}
            </span>
            <span>
              {typeof item.amount === "number"
                ? contractSubtotalLabel({ subtotal: item.amount, currency: contract.currency })
                : contract.currency}
            </span>
          </div>
        ))}
      </div>
      {contract.contract_terms && <p>{contract.contract_terms}</p>}
      {showSnapshots && (
        <div className="quote-line-items">
          <p>RFQ: {contract.rfq_id}</p>
          <p>Quote: {contract.quote_id}</p>
          <p>Purchase Order: {contract.purchase_order_id}</p>
          <p>Decision: {contract.quote_decision_id}</p>
        </div>
      )}
      {events.length > 0 && (
        <div className="quote-line-items">
          {events.map((event) => (
            <div className="meta-row" key={event.id}>
              <span>{contractEventLabel(event)}</span>
              <span>{new Date(event.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
