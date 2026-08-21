import { useEffect, useMemo, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import {
  fetchManufacturerRFQs,
  markManufacturerRFQOpened,
  rfqSnapshotTitle,
  rfqStatusLabels,
} from "../../lib/rfq";
import type { AuthUser } from "../../lib/auth";
import type { RFQWithDetails } from "../../types";
import type { ManufacturerRFQDashboardGroup } from "../../lib/rfq";
import { QuoteBuilder } from "../quotes/QuoteBuilder";
import { ManufacturerPurchaseOrders } from "../purchase-orders/ManufacturerPurchaseOrders";
import { RFQConversation } from "./RFQConversation";
import { RFQActivityTimeline } from "./RFQActivityTimeline";
import { manufacturerRFQActionLabel, refreshOpenedManufacturerRFQ, selectManufacturerRFQs, type ManufacturerRFQSort } from "./manufacturerRFQInboxModel";

interface ManufacturerRFQInboxProps {
  user: AuthUser;
  authMode: "supabase" | "demo";
  selectedRFQId?: string | null;
  onSelectedRFQChange?: (rfqId: string | null) => void;
}

const manufacturerGroups: Array<ManufacturerRFQDashboardGroup | "all"> = ["all", "new", "waiting_reply", "quoted", "closed"];
const manufacturerGroupLabels: Record<ManufacturerRFQDashboardGroup | "all", string> = {
  all: "All",
  new: "New",
  waiting_reply: "In review",
  quoted: "Quote history",
  closed: "Closed",
};

export function ManufacturerRFQInbox({ user, authMode, selectedRFQId = null, onSelectedRFQChange }: ManufacturerRFQInboxProps) {
  const [rfqs, setRFQs] = useState<RFQWithDetails[]>([]);
  const [selectedRFQ, setSelectedRFQ] = useState<RFQWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(authMode === "supabase");
  const [errors, setErrors] = useState<string[]>([]);
  const [groupFilter, setGroupFilter] = useState<ManufacturerRFQDashboardGroup | "all">("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<ManufacturerRFQSort>("updated");

  async function loadRFQs() {
    setIsLoading(true);
    setErrors([]);
    try {
      const nextRFQs = authMode === "demo" ? [] : await fetchManufacturerRFQs();
      setRFQs(nextRFQs);
      setSelectedRFQ((current) => current
        ? nextRFQs.find((rfq) => rfq.id === current.id) ?? null
        : current);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to load manufacturer RFQs."]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadRFQs();
  }, [authMode, user.id]);

  const visibleRFQs = useMemo(
    () => selectManufacturerRFQs(rfqs, groupFilter, search, sort),
    [groupFilter, rfqs, search, sort]
  );

  async function openRFQ(rfq: RFQWithDetails) {
    setErrors([]);
    try {
      let current = rfq;
      if (authMode !== "demo") {
        const refreshed = await refreshOpenedManufacturerRFQ(rfq.id, markManufacturerRFQOpened, fetchManufacturerRFQs);
        setRFQs(refreshed.rfqs);
        if (!refreshed.current) throw new Error("This RFQ is no longer available to your Manufacturer account.");
        current = refreshed.current;
      }
      setSelectedRFQ(current);
      onSelectedRFQChange?.(rfq.id);
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
    if (routedRFQ) void openRFQ(routedRFQ);
    else {
      setErrors(["This RFQ is unavailable or is not assigned to your Manufacturer account."]);
      onSelectedRFQChange?.(null);
    }
  }, [isLoading, rfqs, selectedRFQ?.id, selectedRFQId]);

  return (
    <section className="workspace-section">
      <section className="panel">
        <p className="eyebrow">RFQ Inbox</p>
        <h1>RFQ Inbox</h1>
        <p>Search and review only the RFQs assigned to your signed-in Manufacturer account.</p>
        <div className="queue-controls">
          <label><span>Search RFQs</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Product, destination, status, or reference" /></label>
          <label><span>Sort RFQs</span><select value={sort} onChange={(event) => setSort(event.target.value as ManufacturerRFQSort)}><option value="updated">Latest updated</option><option value="created">Newest created</option><option value="quantity">Largest quantity</option></select></label>
        </div>
        <div className="segmented-control rfq-status-filter" aria-label="Filter RFQ inbox">
          {manufacturerGroups.map((group) => (
            <button type="button" className={groupFilter === group ? "active" : ""} key={group} onClick={() => setGroupFilter(group)}>{manufacturerGroupLabels[group]}</button>
          ))}
        </div>
        {isLoading && <LoadingState message="Loading RFQ inbox..." />}
        <ErrorList errors={errors} />
        {!isLoading && visibleRFQs.length === 0 && <div className="buyer-rfq-empty"><p>No assigned RFQs match this view.</p>{rfqs.length > 0 && <button type="button" onClick={() => { setSearch(""); setGroupFilter("all"); }}>Clear filters</button>}</div>}
        <div className="review-list">
          {visibleRFQs.map((rfq) => (
            <article className="review-item" key={rfq.id}>
              <div>
                <p className="eyebrow">{rfqStatusLabels[rfq.status]}</p>
                <h3>{rfqSnapshotTitle(rfq.product_snapshot)}</h3>
                <p>Participant-safe Buyer request</p>
              </div>
              <div className="meta-row">
                <span>{rfq.requested_quantity} units</span>
                <span>{rfq.destination_country}</span>
                <span>{new Date(rfq.created_at).toLocaleDateString()}</span>
              </div>
              <div className="actions">
                <button type="button" onClick={() => void openRFQ(rfq)}>
                  {manufacturerRFQActionLabel(rfq.status)}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <RFQConversation rfq={selectedRFQ} readOnly={Boolean(selectedRFQ && ["accepted", "declined", "expired", "cancelled"].includes(selectedRFQ.status))} onMessagePosted={loadRFQs} />
      <RFQActivityTimeline rfq={selectedRFQ} authMode={authMode} />
      <QuoteBuilder rfq={selectedRFQ} onQuoteSubmitted={loadRFQs} />
      <ManufacturerPurchaseOrders authMode={authMode} />
    </section>
  );
}
