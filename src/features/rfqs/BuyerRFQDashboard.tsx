import React, { useEffect, useMemo, useRef, useState } from "react";
import { ConfirmationDialog } from "../../components/common/ConfirmationDialog";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import {
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
import { fetchMarketplaceProductById } from "../../lib/marketplace";
import type { AuthUser } from "../../lib/auth";
import type {
  RFQQuoteDecisionRecord,
  RFQQuoteWithItems,
  RFQWithDetails,
  MarketplaceProduct,
} from "../../types";
import {
  buyerRFQFilterLabels,
  buyerRFQFilters,
  buyerRFQHref,
  buyerRFQManufacturer,
  selectBuyerRFQs,
  shortRFQReference,
  type BuyerRFQFilter,
  type BuyerRFQSort,
} from "../../lib/buyerRfqList";
import { BuyerQuoteDecisionPanel } from "../quotes/BuyerQuoteDecisionPanel";
import { QuoteSummaryList } from "../quotes/QuoteSummaryList";
import { QuoteComparisonView } from "../quotes/QuoteComparisonView";
import { RFQConversation } from "./RFQConversation";
import { BuyerRFQDraftEditor } from "./BuyerRFQDraftEditor";
import { RFQActivityTimeline } from "./RFQActivityTimeline";
import { RFQRequestDialog } from "./RFQRequestDialog";
import { buyerQuoteNextAction, buyerRFQNextAction } from "../../lib/buyerNextActions";
import { BuyerNextActionNotice } from "../dashboard/BuyerNextActionNotice";

interface BuyerRFQDashboardProps {
  user: AuthUser;
  authMode: "supabase" | "demo";
  selectedRFQId?: string | null;
  onSelectedRFQChange?: (rfqId: string | null) => void;
  productContextId?: string | null;
  onProductContextConsumed?: () => void;
}

export function shouldHandleBuyerRFQNavigation(event: React.MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey
    && event.currentTarget.target !== "_blank" && !event.currentTarget.hasAttribute("download");
}

function safeDate(value: string): string {
  const date = new Date(value); return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleDateString();
}

export function BuyerRFQLoadError({ onRetry }: { onRetry: () => void }) {
  return <div className="workspace-error" role="alert"><p>Unable to load your RFQs.</p><button type="button" onClick={onRetry}>Retry</button></div>;
}

export function BuyerRFQEmptyState() {
  return <div className="buyer-rfq-empty"><h2>You have not submitted any RFQs yet.</h2><p>Browse the Marketplace to find a home and start a request.</p><a href="/marketplace?view=browse">Browse Marketplace</a></div>;
}

export function BuyerRFQLoadingState() {
  return <div aria-busy="true"><p className="loading-state" role="status" aria-live="polite">Loading your RFQs...</p></div>;
}

export function BuyerRFQDashboard({ user, authMode, selectedRFQId = null, onSelectedRFQChange, productContextId = null, onProductContextConsumed }: BuyerRFQDashboardProps) {
  const [rfqs, setRFQs] = useState<RFQWithDetails[]>([]);
  const [quotes, setQuotes] = useState<RFQQuoteWithItems[]>([]);
  const [decisions, setDecisions] = useState<RFQQuoteDecisionRecord[]>([]);
  const [selectedRFQ, setSelectedRFQ] = useState<RFQWithDetails | null>(null);
  const [statusFilter, setStatusFilter] = useState<BuyerRFQFilter>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<BuyerRFQSort>("updated");
  const [isLoading, setIsLoading] = useState(authMode === "supabase");
  const [loadError, setLoadError] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [pendingAction, setPendingAction] = useState<{ rfq: RFQWithDetails; kind: "cancel" | "delete" } | null>(null);
  const [isActing, setIsActing] = useState(false);
  const [contextProduct, setContextProduct] = useState<MarketplaceProduct | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const actionReturnFocus = useRef<HTMLElement | null>(null);
  const loadSequence = useRef(0);

  async function loadProductContext() {
    if (!productContextId) return;
    setIsLoadingContext(true);
    setContextError(null);
    try {
      const product = await fetchMarketplaceProductById(productContextId);
      if (!product) {
        setContextError("That Product is no longer available for a new RFQ.");
        onProductContextConsumed?.();
        return;
      }
      setContextProduct(product);
      onProductContextConsumed?.();
    } catch {
      setContextError("Product context could not be loaded. Try again without creating an RFQ.");
    } finally {
      setIsLoadingContext(false);
    }
  }

  useEffect(() => { void loadProductContext(); }, [productContextId]);

  async function loadRFQs() {
    const sequence = ++loadSequence.current;
    setIsLoading(true);
    setLoadError(false);
    setErrors([]);
    try {
      if (authMode === "demo") {
        setRFQs([]);
        setQuotes([]);
        setDecisions([]);
      } else {
        const [nextRFQs, nextQuotes] = await Promise.all([fetchBuyerRFQs(), fetchBuyerQuotes()]);
        if (sequence === loadSequence.current) { setRFQs(nextRFQs); setQuotes(nextQuotes); }
      }
    } catch {
      if (sequence === loadSequence.current) setLoadError(true);
    } finally {
      if (sequence === loadSequence.current) setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadRFQs();
  }, [authMode, user.id]);

  const filteredRFQs = useMemo(() => selectBuyerRFQs(rfqs, statusFilter, search, sort), [rfqs, search, sort, statusFilter]);

  const selectedQuotes = useMemo(
    () => (selectedRFQ ? quotes.filter((quote) => quote.rfq_id === selectedRFQ.id) : []),
    [quotes, selectedRFQ]
  );
  const selectedNextAction = useMemo(() => {
    if (!selectedRFQ) return null;
    const currentQuote = selectedQuotes.find((quote) => quote.status === "submitted")
      ?? selectedQuotes.find((quote) => quote.status === "accepted");
    return currentQuote
      ? buyerQuoteNextAction(currentQuote.status, selectedRFQ.id)
      : buyerRFQNextAction(selectedRFQ.status, selectedRFQ.id);
  }, [selectedRFQ, selectedQuotes]);

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
      {isLoadingContext && <LoadingState message="Loading the selected Product..." />}
      {contextError && <div className="workspace-error" role="alert"><p>{contextError}</p>{productContextId && <button type="button" onClick={() => void loadProductContext()}>Retry</button>}<a href="/marketplace?view=browse">Back to Marketplace</a></div>}
      {contextProduct && <RFQRequestDialog product={contextProduct} user={user} onClose={() => setContextProduct(null)} />}
      <section className="panel">
        <p className="eyebrow">Buyer Portal</p>
        <h1>My RFQs</h1>
        <p>Search and review requests already authorized for your signed-in Buyer account.</p>
        <div className="queue-controls">
          <label>
            <span>Search RFQs</span>
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Reference, product, or manufacturer" />
          </label>
          <label>
            <span>Sort RFQs</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as BuyerRFQSort)}>
              <option value="updated">Latest updated</option>
              <option value="created">Newest created</option>
              <option value="status">Status</option>
            </select>
          </label>
        </div>
        <div className="status-filter-bar" aria-label="Buyer RFQ status filters">
          {buyerRFQFilters.map((filter) => (
            <button
              type="button"
              className={statusFilter === filter ? "active" : ""}
              aria-pressed={statusFilter === filter}
              key={filter}
              onClick={() => setStatusFilter(filter)}
            >
              {buyerRFQFilterLabels[filter]}
            </button>
          ))}
        </div>
        <div aria-busy={isLoading}>
        {isLoading && <LoadingState message="Loading your RFQs..." />}
        {loadError && <BuyerRFQLoadError onRetry={() => void loadRFQs()} />}
        <ErrorList errors={errors} />
        {!isLoading && !loadError && rfqs.length === 0 && <BuyerRFQEmptyState />}
        {!isLoading && !loadError && rfqs.length > 0 && filteredRFQs.length === 0 && <div className="buyer-rfq-empty"><h2>No RFQs match these filters.</h2><button type="button" onClick={() => { setSearch(""); setStatusFilter("all"); }}>Clear filters</button></div>}
        <div className="review-list">
          {filteredRFQs.map((rfq) => (
            <article className="review-item" key={rfq.id}>
              <div>
                <p className="eyebrow">{rfqStatusLabels[rfq.status]}</p>
                <h2><a href={buyerRFQHref(rfq.id)} onClick={(event) => { if (!shouldHandleBuyerRFQNavigation(event)) return; event.preventDefault(); void openRFQ(rfq); }}>{rfqSnapshotTitle(rfq.product_snapshot)} — {shortRFQReference(rfq.id)}</a></h2>
                <p>{buyerRFQManufacturer(rfq)}</p>
                <p>{rfq.requested_quantity} units to {rfq.destination_country}</p>
                {quotes.some((quote) => quote.rfq_id === rfq.id) && (
                  <p className="form-notice">Quote received</p>
                )}
              </div>
              <div className="meta-row">
                <span>Created <time dateTime={rfq.created_at}>{safeDate(rfq.created_at)}</time></span>
                <span>Updated <time dateTime={rfq.updated_at}>{safeDate(rfq.updated_at)}</time></span>
              </div>
              <div className="actions">
                <a className="button-link" href={buyerRFQHref(rfq.id)} onClick={(event) => { if (!shouldHandleBuyerRFQNavigation(event)) return; event.preventDefault(); void openRFQ(rfq); }}>Open {shortRFQReference(rfq.id)}</a>
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
        </div>
      </section>
      {selectedRFQ && <nav className="detail-return" aria-label="RFQ detail navigation"><a href="/marketplace?view=dashboard&workspace=rfqs" onClick={(event) => { if (!shouldHandleBuyerRFQNavigation(event)) return; event.preventDefault(); setSelectedRFQ(null); onSelectedRFQChange?.(null); }}>Back to My RFQs</a></nav>}
      {selectedRFQ && <BuyerNextActionNotice action={selectedNextAction} />}
      {selectedRFQ?.status === "draft" && (
        <BuyerRFQDraftEditor rfq={selectedRFQ} onSaved={() => void refreshSelectedRFQ()} />
      )}
      <RFQConversation rfq={selectedRFQ} readOnly={Boolean(selectedRFQ && isTerminalRFQStatus(selectedRFQ.status))} onMessagePosted={loadRFQs} />
      <RFQActivityTimeline rfq={selectedRFQ} authMode={authMode} />
      {selectedRFQ && (
        <>
          {selectedQuotes.some((quote) => quote.status === "accepted") && (
            <nav className="actions" aria-label="Accepted Quote order navigation">
              <a className="button-link" href="/marketplace?view=dashboard&workspace=orders">
                View or create Order
              </a>
            </nav>
          )}
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
