import { formatMoney, quoteStatusLabels } from "../../lib/quotes";
import type { RFQQuoteWithItems } from "../../types";

interface QuoteSummaryListProps {
  quotes: RFQQuoteWithItems[];
  title?: string;
  readOnlyNote?: string;
}

export function QuoteSummaryList({
  quotes,
  title = "Quotes",
  readOnlyNote,
}: QuoteSummaryListProps) {
  if (quotes.length === 0) {
    return (
      <section className="quote-panel">
        <h4>{title}</h4>
        <p>No quotes visible yet.</p>
      </section>
    );
  }

  return (
    <section className="quote-panel">
      <h4>{title}</h4>
      {readOnlyNote && <p className="form-notice">{readOnlyNote}</p>}
      <div className="review-list">
        {quotes.map((quote) => (
          <article className="review-item" key={quote.id}>
            <div>
              <p className="eyebrow">
                Version {quote.version} - {quoteStatusLabels[quote.status]}
              </p>
              <h3>{formatMoney(quote.subtotal, quote.currency)}</h3>
              <p>
                {quote.incoterm ? `${quote.incoterm} - ` : ""}
                {quote.production_lead_days ?? "TBD"} production days
                {quote.shipping_lead_days !== null ? ` - ${quote.shipping_lead_days} shipping days` : ""}
              </p>
              {quote.valid_until && <p>Valid until {new Date(quote.valid_until).toLocaleDateString()}</p>}
              {quote.manufacturer_note && <p>{quote.manufacturer_note}</p>}
            </div>
            <div className="quote-line-items">
              {quote.items.map((item) => (
                <div className="meta-row" key={item.id}>
                  <span>{item.description}</span>
                  <span>
                    {item.quantity} {item.unit || "unit"}
                  </span>
                  <span>{formatMoney(item.amount, quote.currency)}</span>
                </div>
              ))}
            </div>
            {quote.submitted_at && (
              <span>Submitted {new Date(quote.submitted_at).toLocaleString()}</span>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
