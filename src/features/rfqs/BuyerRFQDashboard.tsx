import { useEffect, useMemo, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import {
  buyerRFQDashboardStatuses,
  deleteDraftRFQ,
  fetchRFQ,
  fetchBuyerRFQs,
  rfqSnapshotTitle,
  rfqStatusLabels,
} from "../../lib/rfq";
import { fetchBuyerQuotes } from "../../lib/quotes";
import { fetchQuoteDecisionsForRFQ, markQuoteOpened } from "../../lib/quoteDecisions";
import type { AuthUser } from "../../lib/auth";
import type {
  RFQQuoteDecisionRecord,
  RFQQuoteWithItems,
  RFQStatus,
  RFQWithDetails,
} from "../../types";
import { BuyerQuoteDecisionPanel } from "../quotes/BuyerQuoteDecisionPanel";
import { QuoteSummaryList } from "../quotes/QuoteSummaryList";
import { RFQConversation } from "./RFQConversation";

interface BuyerRFQDashboardProps {
  user: AuthUser;
  authMode: "supabase" | "demo";
}

export function BuyerRFQDashboard({ user, authMode }: BuyerRFQDashboardProps) {
  const [rfqs, setRFQs] = useState<RFQWithDetails[]>([]);
  const [quotes, setQuotes] = useState<RFQQuoteWithItems[]>([]);
  const [decisions, setDecisions] = useState<RFQQuoteDecisionRecord[]>([]);
  const [selectedRFQ, setSelectedRFQ] = useState<RFQWithDetails | null>(null);
  const [statusFilter, setStatusFilter] = useState<RFQStatus | "all">("all");
  const [isLoading, setIsLoading] = useState(authMode === "supabase");
  const [errors, setErrors] = useState<string[]>([]);

  async function loadRFQs() {
    setIsLoading(true);
    setErrors([]);
    try {
      if (authMode === "demo") {
        setRFQs([]);
        setQuotes([]);
        setDecisions([]);
      } else {
        const [nextRFQs, nextQuotes] = await Promise.all([fetchBuyerRFQs(user.id), fetchBuyerQuotes()]);
        setRFQs(nextRFQs);
        setQuotes(nextQuotes);
      }
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to load RFQs."]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadRFQs();
  }, [authMode, user.id]);

  const filteredRFQs = useMemo(
    () => (statusFilter === "all" ? rfqs : rfqs.filter((rfq) => rfq.status === statusFilter)),
    [rfqs, statusFilter]
  );

  const selectedQuotes = useMemo(
    () => (selectedRFQ ? quotes.filter((quote) => quote.rfq_id === selectedRFQ.id) : []),
    [quotes, selectedRFQ]
  );

  async function openRFQ(rfq: RFQWithDetails) {
    setErrors([]);
    setSelectedRFQ(rfq);
    setDecisions([]);
    try {
      const rfqQuotes = quotes.filter((quote) => quote.rfq_id === rfq.id);
      const currentSubmittedQuote = rfqQuotes.find((quote) => quote.status === "submitted");
      if (authMode !== "demo" && rfq.status === "quoted" && currentSubmittedQuote) {
        await markQuoteOpened(currentSubmittedQuote.id);
        const refreshed = await fetchRFQ(rfq.id);
        if (refreshed) {
          setSelectedRFQ(refreshed);
          setRFQs((items) => items.map((item) => (item.id === refreshed.id ? refreshed : item)));
        }
      }
      if (authMode !== "demo") {
        setDecisions(await fetchQuoteDecisionsForRFQ(rfq.id));
      }
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to open RFQ."]);
    }
  }

  async function refreshSelectedRFQ() {
    if (!selectedRFQ) return;
    const [nextRFQ, nextQuotes, nextDecisions] = await Promise.all([
      fetchRFQ(selectedRFQ.id),
      fetchBuyerQuotes(),
      fetchQuoteDecisionsForRFQ(selectedRFQ.id),
    ]);
    if (nextRFQ) {
      setSelectedRFQ(nextRFQ);
      setRFQs((items) => items.map((item) => (item.id === nextRFQ.id ? nextRFQ : item)));
    }
    setQuotes(nextQuotes);
    setDecisions(nextDecisions);
  }

  async function deleteDraft(rfq: RFQWithDetails) {
    setErrors([]);
    try {
      await deleteDraftRFQ(rfq.id);
      setSelectedRFQ(null);
      await loadRFQs();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to delete RFQ draft."]);
    }
  }

  return (
    <section className="workspace-section">
      <section className="panel">
        <p className="eyebrow">Buyer Portal</p>
        <h2>My RFQs</h2>
        <div className="segmented-control rfq-status-filter">
          <button
            type="button"
            className={statusFilter === "all" ? "active" : ""}
            onClick={() => setStatusFilter("all")}
          >
            All
          </button>
          {buyerRFQDashboardStatuses.map((status) => (
            <button
              type="button"
              className={statusFilter === status ? "active" : ""}
              key={status}
              onClick={() => setStatusFilter(status)}
            >
              {rfqStatusLabels[status]}
            </button>
          ))}
        </div>
        {isLoading && <LoadingState message="Loading RFQs..." />}
        <ErrorList errors={errors} />
        {!isLoading && filteredRFQs.length === 0 && <p>No RFQs in this status yet.</p>}
        <div className="review-list">
          {filteredRFQs.map((rfq) => (
            <article className="review-item" key={rfq.id}>
              <div>
                <p className="eyebrow">{rfqStatusLabels[rfq.status]}</p>
                <h3>{rfqSnapshotTitle(rfq.product_snapshot)}</h3>
                <p>
                  {rfq.requested_quantity} units to {rfq.destination_country}
                </p>
                {quotes.some((quote) => quote.rfq_id === rfq.id) && (
                  <p className="form-notice">Quote received</p>
                )}
              </div>
              <div className="meta-row">
                <span>{rfq.requested_currency}</span>
                <span>{new Date(rfq.created_at).toLocaleDateString()}</span>
              </div>
              <div className="actions">
                <button type="button" onClick={() => void openRFQ(rfq)}>
                  Open RFQ
                </button>
                {rfq.status === "draft" && (
                  <button type="button" onClick={() => void deleteDraft(rfq)}>
                    Delete Draft
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
      <RFQConversation rfq={selectedRFQ} user={user} onMessagePosted={loadRFQs} />
      {selectedRFQ && (
        <>
          <BuyerQuoteDecisionPanel
            quotes={selectedQuotes}
            decisions={decisions}
            onDecisionSaved={() => void refreshSelectedRFQ()}
          />
          <QuoteSummaryList
            quotes={selectedQuotes}
            title="Quote Versions"
            readOnlyNote="Draft quote versions are hidden from buyers."
            decisions={decisions}
          />
        </>
      )}
    </section>
  );
}
