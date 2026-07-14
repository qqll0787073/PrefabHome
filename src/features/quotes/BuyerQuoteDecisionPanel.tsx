import { useMemo, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import {
  acceptQuote,
  getBuyerDecisionActions,
  getCurrentSubmittedQuote,
  getLatestQuoteDecision,
  quoteDecisionLabels,
  rejectQuote,
  requestQuoteRevision,
  validateDecisionReason,
} from "../../lib/quoteDecisions";
import { formatMoney } from "../../lib/quotes";
import type {
  RFQQuoteDecisionRecord,
  RFQQuoteDecisionValue,
  RFQQuoteWithItems,
} from "../../types";

interface BuyerQuoteDecisionPanelProps {
  quotes: RFQQuoteWithItems[];
  decisions: RFQQuoteDecisionRecord[];
  onDecisionSaved: () => void;
}

export function BuyerQuoteDecisionPanel({
  quotes,
  decisions,
  onDecisionSaved,
}: BuyerQuoteDecisionPanelProps) {
  const [activeDecision, setActiveDecision] = useState<RFQQuoteDecisionValue | null>(null);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const currentQuote = useMemo(() => getCurrentSubmittedQuote(quotes), [quotes]);
  const latestDecision = useMemo(
    () => (currentQuote ? null : getLatestQuoteDecision(quotes, decisions)),
    [currentQuote, quotes, decisions]
  );
  const actions = useMemo(
    () => (currentQuote ? getBuyerDecisionActions(currentQuote, quotes, decisions) : []),
    [currentQuote, quotes, decisions]
  );

  async function saveDecision(decision: RFQQuoteDecisionValue) {
    if (!currentQuote) return;

    const validationErrors = validateDecisionReason(decision, reason);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    const confirmed = window.confirm(
      `${quoteDecisionLabels[decision]} quote version ${currentQuote.version} for ${formatMoney(
        currentQuote.subtotal,
        currentQuote.currency
      )}?`
    );
    if (!confirmed) return;

    setIsSaving(true);
    setErrors([]);
    try {
      if (decision === "accepted") {
        await acceptQuote(currentQuote.id, reason);
      } else if (decision === "rejected") {
        await rejectQuote(currentQuote.id, reason);
      } else {
        await requestQuoteRevision(currentQuote.id, reason);
      }
      setReason("");
      setActiveDecision(null);
      onDecisionSaved();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to save quote decision."]);
    } finally {
      setIsSaving(false);
    }
  }

  if (!currentQuote && decisions.length === 0) {
    return null;
  }

  return (
    <section className="quote-panel">
      <h4>Buyer Decision</h4>
      <ErrorList errors={errors} />
      {latestDecision ? (
        <article className="review-item">
          <p className="eyebrow">{quoteDecisionLabels[latestDecision.decision.decision]}</p>
          <h3>Quote version {latestDecision.quote.version}</h3>
          {latestDecision.decision.reason && <p>{latestDecision.decision.reason}</p>}
          <span>{new Date(latestDecision.decision.created_at).toLocaleString()}</span>
        </article>
      ) : actions.length > 0 && currentQuote ? (
        <>
          <p>
            Current quote: version {currentQuote.version} -{" "}
            {formatMoney(currentQuote.subtotal, currentQuote.currency)}
          </p>
          <div className="actions">
            {actions.map((decision) => (
              <button
                type="button"
                key={decision}
                disabled={isSaving}
                onClick={() => setActiveDecision(decision)}
              >
                {decision === "accepted"
                  ? "Accept Quote"
                  : decision === "rejected"
                    ? "Reject Quote"
                    : "Request Revision"}
              </button>
            ))}
          </div>
          {activeDecision && (
            <section className="quote-line-editor">
              <label>
                {activeDecision === "revision_requested" ? "Revision reason" : "Reason or note"}
                <textarea
                  value={reason}
                  maxLength={4000}
                  required={activeDecision === "revision_requested"}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
              <div className="actions">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void saveDecision(activeDecision)}
                >
                  {isSaving ? "Saving..." : quoteDecisionLabels[activeDecision]}
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    setActiveDecision(null);
                    setReason("");
                    setErrors([]);
                  }}
                >
                  Cancel
                </button>
              </div>
            </section>
          )}
        </>
      ) : (
        <p>No buyer decision actions are available for this quote version.</p>
      )}
    </section>
  );
}
