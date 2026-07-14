import { useEffect, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import { fetchAdminRFQs, rfqSnapshotTitle, rfqStatusLabels } from "../../lib/rfq";
import { fetchAdminQuotes } from "../../lib/quotes";
import { fetchQuoteDecisionsForRFQ } from "../../lib/quoteDecisions";
import type { AuthUser } from "../../lib/auth";
import type { RFQQuoteDecisionRecord, RFQQuoteWithItems, RFQWithDetails } from "../../types";
import { QuoteSummaryList } from "../quotes/QuoteSummaryList";
import { RFQConversation } from "./RFQConversation";

interface AdminRFQManagementProps {
  user: AuthUser;
  authMode: "supabase" | "demo";
}

export function AdminRFQManagement({ user, authMode }: AdminRFQManagementProps) {
  const [rfqs, setRFQs] = useState<RFQWithDetails[]>([]);
  const [quotes, setQuotes] = useState<RFQQuoteWithItems[]>([]);
  const [decisions, setDecisions] = useState<RFQQuoteDecisionRecord[]>([]);
  const [selectedRFQ, setSelectedRFQ] = useState<RFQWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(authMode === "supabase");
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setErrors([]);

    if (authMode === "demo") {
      setRFQs([]);
      setQuotes([]);
      setDecisions([]);
      setIsLoading(false);
      return;
    }

    Promise.all([fetchAdminRFQs(), fetchAdminQuotes()])
      .then(([items, quoteItems]) => {
        if (isMounted) {
          setRFQs(items);
          setQuotes(quoteItems);
        }
      })
      .catch((error) => {
        if (isMounted) {
          setErrors([error instanceof Error ? error.message : "Unable to load RFQs."]);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [authMode]);

  async function openRFQ(rfq: RFQWithDetails) {
    setSelectedRFQ(rfq);
    setDecisions([]);
    if (authMode === "demo") return;
    try {
      setDecisions(await fetchQuoteDecisionsForRFQ(rfq.id));
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to load quote decisions."]);
    }
  }

  return (
    <section className="workspace-section">
      <section className="panel">
        <p className="eyebrow">RFQ Management</p>
        <h2>All RFQs</h2>
        <p className="form-notice">Admin RFQ management is read-only in PH-006A.</p>
        {isLoading && <LoadingState message="Loading RFQs..." />}
        <ErrorList errors={errors} />
        {!isLoading && rfqs.length === 0 && <p>No RFQs have been created yet.</p>}
        <div className="review-list">
          {rfqs.map((rfq) => (
            <article className="review-item" key={rfq.id}>
              <div>
                <p className="eyebrow">{rfqStatusLabels[rfq.status]}</p>
                <h3>{rfqSnapshotTitle(rfq.product_snapshot)}</h3>
                <p>
                  {rfq.buyer?.email || "Buyer"} to{" "}
                  {rfq.manufacturer?.company_display_name ||
                    rfq.manufacturer?.company_name ||
                    "Manufacturer"}
                </p>
                {quotes.some((quote) => quote.rfq_id === rfq.id) && (
                  <p className="form-notice">Quote activity</p>
                )}
              </div>
              <div className="meta-row">
                <span>{rfq.requested_quantity} units</span>
                <span>{rfq.destination_country}</span>
                <span>{new Date(rfq.updated_at).toLocaleDateString()}</span>
              </div>
              <div className="actions">
                <button type="button" onClick={() => void openRFQ(rfq)}>
                  View
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <RFQConversation rfq={selectedRFQ} user={user} readOnly />
      {selectedRFQ && (
        <QuoteSummaryList
          quotes={quotes.filter((quote) => quote.rfq_id === selectedRFQ.id)}
          title="Quote Detail"
          readOnlyNote="Admin quote management is read-only."
          decisions={decisions}
        />
      )}
    </section>
  );
}
