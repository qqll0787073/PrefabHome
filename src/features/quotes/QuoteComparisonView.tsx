import React from "react";
import { formatDateOnly } from "../../lib/format";
import { buildQuoteComparison } from "../../lib/rfqQuoteWorkflow";
import { formatMoney, quoteStatusLabels } from "../../lib/quotes";
import type { RFQQuoteWithItems, RFQWithDetails } from "../../types";

interface QuoteComparisonViewProps {
  rfq: RFQWithDetails;
  quotes: RFQQuoteWithItems[];
}

function freightScope(quote: RFQQuoteWithItems): string {
  return quote.items.some((item) => item.item_type === "freight")
    ? "Freight line item present"
    : "No dedicated shipping scope";
}

export function QuoteComparisonView({ rfq, quotes }: QuoteComparisonViewProps) {
  const comparison = buildQuoteComparison(quotes);
  const manufacturerName =
    rfq.product_snapshot.manufacturer_display_name ||
    "Assigned manufacturer";

  return (
    <section className="quote-panel quote-comparison" aria-labelledby="quote-comparison-heading">
      <div>
        <p className="eyebrow">Buyer comparison</p>
        <h3 id="quote-comparison-heading">Compare Quote Versions</h3>
        <p>
          Versions from {manufacturerName} for this RFQ only. No exchange-rate conversion,
          score, ranking, or recommendation is applied.
        </p>
      </div>
      {comparison.warnings.map((warning) => (
        <p className="form-notice" key={warning}>{warning}</p>
      ))}
      {comparison.quotes.length === 0 ? (
        <p>No comparable submitted quote versions are visible.</p>
      ) : (
        <div className="quote-comparison-scroll" tabIndex={0} aria-label="Scrollable quote comparison">
          <table>
            <caption>Commercial quote versions for the selected RFQ</caption>
            <thead>
              <tr>
                <th scope="col">Version</th>
                <th scope="col">Status</th>
                <th scope="col">Subtotal</th>
                <th scope="col">Incoterm</th>
                <th scope="col">Lead time</th>
                <th scope="col">Valid until</th>
                <th scope="col">Shipping scope</th>
                <th scope="col">Commercial note</th>
              </tr>
            </thead>
            <tbody>
              {comparison.quotes.map((quote) => (
                <tr key={quote.id}>
                  <th scope="row">Version {quote.version}</th>
                  <td>{quoteStatusLabels[quote.status]}</td>
                  <td>{formatMoney(quote.subtotal, quote.currency)}</td>
                  <td>{quote.incoterm || "Unspecified"}</td>
                  <td>
                    {quote.production_lead_days ?? "TBD"} production days
                    {quote.shipping_lead_days !== null ? `; ${quote.shipping_lead_days} shipping days` : ""}
                  </td>
                  <td>{quote.valid_until ? formatDateOnly(quote.valid_until) : "Unspecified"}</td>
                  <td>{freightScope(quote)}</td>
                  <td>{quote.manufacturer_note || "None"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
