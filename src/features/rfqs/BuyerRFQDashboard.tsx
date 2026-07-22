import { useEffect, useMemo, useRef, useState } from "react";
import { ConfirmationDialog } from "../../components/common/ConfirmationDialog";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import {
  buyerRFQDashboardStatuses,
  cancelRFQ,
  deleteDraftRFQ,
  fetchRFQ,
  fetchBuyerRFQs,
  rfqSnapshotTitle,
  rfqStatusLabels,
} from "../../lib/rfq";
import { availableRfqActions, isTerminalRFQStatus } from "../../lib/rfqQuoteWorkflow";
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
import { QuoteComparisonView } from "../quotes/QuoteComparisonView";
import { BuyerPurchaseOrders } from "../purchase-orders/BuyerPurchaseOrders";
import { RFQConversation } from "./RFQConversation";
import { BuyerRFQDraftEditor } from "./BuyerRFQDraftEditor";
import { RFQActivityTimeline } from "./RFQActivityTimeline";

interface BuyerRFQDashboardProps {
  user: AuthUser;
  authMode: "supabase" | "demo";
  showPurchaseOrders?: boolean;
  selectedRFQId?: string | null;
  onSelectedRFQChange?: (rfqId: string | null) => void;
}

export function BuyerRFQDashboard({ user, authMode, showPurchaseOrders = true, selectedRFQId = null, onSelectedRFQChange }: BuyerRFQDashboardProps) {
  const [rfqs, setRFQs] = useState<RFQWithDetails[]>([]);
  const [quotes, setQuotes] = useState<RFQQuoteWithItems[]>([]);
  const [decisions, setDecisions] = useState<RFQQuoteDecisionRecord[]>([]);
  const [selectedRFQ, setSelectedRFQ] = useState<RFQWithDetails | null>(null);
  const [statusFilter, setStatusFilter] = useState<RFQStatus | "all">("all");
  const [isLoading, setIsLoading] = useState(authMode === "supabase");
  const [errors, setErrors] = useState<string[]>([]);
  const [pendingAction, setPendingAction] = useState<{ rfq: RFQWithDetails; kind: "cancel" | "delete" } | null>(null);
  const [isActing, setIsActing] = useState(false);
  const actionReturnFocus = useRef<HTMLElement | null>(null);

  async function loadRFQs() {
    setIsLoading(true);
    setErrors([]);
    try {
      if (authMode === "demo") {
        setRFQs([]);
        setQuotes([]);
        setDecisions([]);
      } else {
        const [nextRFQs, nextQuotes] = await Promise.all([fetchBuyerRFQs(), fetchBuyerQuotes()]);
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
    onSelectedRFQChange?.(rfq.id);
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

  useEffect(() => {
    if (!selectedRFQId) {
      if (selectedRFQ) setSelectedRFQ(null);
      return;
    }
    if (isLoading || selectedRFQ?.id === selectedRFQId) return;
    const routedRFQ = rfqs.find((rfq) => rfq.id === selectedRFQId);
    if (routedRFQ) {
      void openRFQ(routedRFQ);
    } else {
      setErrors(["This RFQ is unavailable or is not owned by the signed-in Buyer."]);
      onSelectedRFQChange?.(null);
    }
  }, [isLoading, rfqs, selectedRFQ?.id, selectedRFQId]);

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

  async function confirmPendingAction() {
    if (!pendingAction) return;
    const { rfq, kind } = pendingAction;
    setIsActing(true);
    setErrors([]);
    try {
      if (kind === "delete") await deleteDraftRFQ(rfq.id);
      else await cancelRFQ(rfq.id);
      setSelectedRFQ(null);
      onSelectedRFQChange?.(null);
      setPendingAction(null);
      await loadRFQs();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : `Unable to ${kind} RFQ.`]);
    } finally {
      setIsActing(false);
    }
  }

  function requestAction(rfq: RFQWithDetails, kind: "cancel" | "delete", trigger: HTMLElement) {
    actionReturnFocus.current = trigger;
    setPendingAction({ rfq, kind });
  }

  return (
    <section className="workspace-section">
      <section className="panel">
        <p className="eyebrow">Buyer Portal</p>
        <h1>My RFQs</h1>
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
                {availableRfqActions("buyer", rfq.status).includes("cancel") && (
                  <button type="button" onClick={(event) => requestAction(rfq, "cancel", event.currentTarget)}>
                    Cancel RFQ
                  </button>
                )}
                {availableRfqActions("buyer", rfq.status).includes("delete") && (
                  <button type="button" onClick={(event) => requestAction(rfq, "delete", event.currentTarget)}>
                    Delete Draft
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
      {selectedRFQ?.status === "draft" && (
        <BuyerRFQDraftEditor rfq={selectedRFQ} onSaved={() => void refreshSelectedRFQ()} />
      )}
      <RFQConversation rfq={selectedRFQ} readOnly={Boolean(selectedRFQ && isTerminalRFQStatus(selectedRFQ.status))} onMessagePosted={loadRFQs} />
      <RFQActivityTimeline rfq={selectedRFQ} authMode={authMode} />
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
          <QuoteComparisonView rfq={selectedRFQ} quotes={selectedQuotes} />
        </>
      )}
      {showPurchaseOrders && <BuyerPurchaseOrders authMode={authMode} quotes={quotes} />}
      <ConfirmationDialog
        open={Boolean(pendingAction)}
        title={pendingAction?.kind === "delete" ? "Delete RFQ draft?" : "Cancel RFQ?"}
        description={pendingAction?.kind === "delete" ? "This permanently removes the draft. This action cannot be undone." : "This closes the RFQ and keeps its database-recorded history. Cancellation cannot be undone."}
        confirmLabel={pendingAction?.kind === "delete" ? "Delete Draft" : "Cancel RFQ"}
        isBusy={isActing}
        returnFocusTo={actionReturnFocus.current}
        onConfirm={() => void confirmPendingAction()}
        onClose={() => setPendingAction(null)}
      />
    </section>
  );
}
