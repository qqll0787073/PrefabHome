import { useEffect, useMemo, useRef, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import {
  canCreatePurchaseOrderForQuote,
  createPurchaseOrderFromQuote,
  fetchBuyerPurchaseOrders,
  purchaseOrderManufacturerName,
  purchaseOrderProductName,
  purchaseOrderStatuses,
  purchaseOrderStatusLabels,
  selectBuyerOrders,
  type BuyerOrderFilter,
  type BuyerOrderSort,
} from "../../lib/purchaseOrders";
import { fetchBuyerQuotes } from "../../lib/quotes";
import type { PortalWorkspace } from "../../lib/portalNavigation";
import type { PurchaseOrderWithItems, RFQQuoteWithItems } from "../../types";

interface BuyerPurchaseOrdersProps {
  authMode: "supabase" | "demo";
  selectedPOId?: string | null;
  onSelectedPOChange?: (id: string | null) => void;
  onWorkspaceChange?: (workspace: PortalWorkspace) => void;
}

export function BuyerPurchaseOrders({ authMode, selectedPOId = null, onSelectedPOChange, onWorkspaceChange }: BuyerPurchaseOrdersProps) {
  const [orders, setOrders] = useState<PurchaseOrderWithItems[]>([]);
  const [quotes, setQuotes] = useState<RFQQuoteWithItems[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<BuyerOrderFilter>("all");
  const [sort, setSort] = useState<BuyerOrderSort>("updated");
  const [loading, setLoading] = useState(authMode === "supabase");
  const [creatingQuoteId, setCreatingQuoteId] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const generation = useRef(0);

  async function load() {
    const request = ++generation.current;
    setLoading(true);
    setErrors([]);
    try {
      if (authMode === "demo") {
        if (request === generation.current) { setOrders([]); setQuotes([]); }
        return;
      }
      const [orderRows, quoteRows] = await Promise.all([fetchBuyerPurchaseOrders(), fetchBuyerQuotes()]);
      if (request !== generation.current) return;
      setOrders(orderRows);
      setQuotes(quoteRows);
    } catch {
      if (request === generation.current) {
        setOrders([]); setQuotes([]);
        setErrors(["Unable to load your orders."]);
      }
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    return () => { generation.current += 1; };
  }, [authMode]);

  const visible = useMemo(() => selectBuyerOrders(orders, search, filter, sort), [orders, search, filter, sort]);
  const selected = selectedPOId ? orders.find((order) => order.id === selectedPOId) ?? null : null;
  const eligibleQuotes = quotes.filter((quote) => canCreatePurchaseOrderForQuote(quote, orders));

  async function createOrder(quoteId: string) {
    if (creatingQuoteId) return;
    const request = generation.current;
    setCreatingQuoteId(quoteId);
    setErrors([]);
    try {
      const order = await createPurchaseOrderFromQuote(quoteId);
      if (request !== generation.current) return;
      onSelectedPOChange?.(order.id);
      await load();
    } catch {
      if (request === generation.current) setErrors(["Unable to create or retrieve this order."]);
    } finally {
      if (request === generation.current) setCreatingQuoteId(null);
    }
  }

  if (selectedPOId && !loading && !selected) {
    return <section className="panel" aria-labelledby="order-unavailable"><h3 id="order-unavailable">Order unavailable</h3><p>This order is unavailable to your Buyer account.</p><button type="button" onClick={() => onSelectedPOChange?.(null)}>Back to Orders</button></section>;
  }

  if (selected) {
    return <section className="quote-panel" aria-labelledby="order-detail-heading" style={{ minWidth: 0, overflowWrap: "anywhere" }}>
      <button type="button" className="text-button" onClick={() => onSelectedPOChange?.(null)}>Back to Orders</button>
      <h3 id="order-detail-heading">Order {selected.po_number}</h3>
      <article className="review-item">
        <p className="eyebrow">{purchaseOrderStatusLabels[selected.status]}</p>
        <h4>{purchaseOrderProductName(selected)}</h4>
        <p>{purchaseOrderManufacturerName(selected)}</p>
        <p>{selected.currency} {selected.subtotal.toFixed(2)}</p>
        {selected.incoterm && <p>Incoterm: {selected.incoterm}</p>}
        {selected.destination_port && <p>Destination: {selected.destination_port}</p>}
        <div className="quote-line-items">{selected.items.map((item) => <p key={item.id}>{item.description}: {item.quantity} {item.unit ?? "unit"} at {selected.currency} {item.unit_price.toFixed(2)}</p>)}</div>
      </article>
      <nav className="actions" aria-label="Order context">
        <a href={`/marketplace?view=dashboard&workspace=rfqs&record=${selected.rfq_id}`}>View source RFQ</a>
        <button type="button" onClick={() => onWorkspaceChange?.("logistics")}>View logistics</button>
      </nav>
    </section>;
  }

  return <section className="quote-panel" aria-labelledby="orders-heading" aria-busy={loading}>
    <h3 id="orders-heading">Orders</h3>
    {loading && <LoadingState message="Loading your orders..." />}
    <ErrorList errors={errors} />
    {errors.length > 0 && <button type="button" onClick={() => void load()}>Retry</button>}
    {eligibleQuotes.length > 0 && <section aria-labelledby="accepted-quotes-heading"><h4 id="accepted-quotes-heading">Accepted Quotes</h4>{eligibleQuotes.map((quote) => <button type="button" key={quote.id} disabled={creatingQuoteId !== null} onClick={() => void createOrder(quote.id)}>{creatingQuoteId === quote.id ? "Creating Order..." : "Create Order"}</button>)}</section>}
    {orders.length > 0 && <div>
      <label>Search Orders<input value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <label>Status<select value={filter} onChange={(event) => setFilter(event.target.value as BuyerOrderFilter)}><option value="all">All statuses</option>{purchaseOrderStatuses.map((status) => <option key={status} value={status}>{purchaseOrderStatusLabels[status]}</option>)}</select></label>
      <label>Sort<select value={sort} onChange={(event) => setSort(event.target.value as BuyerOrderSort)}><option value="updated">Latest updated</option><option value="created">Newest created</option><option value="status">Status</option></select></label>
    </div>}
    {!loading && errors.length === 0 && orders.length === 0 && <div className="empty-state"><h4>No Orders yet</h4><p>Orders appear after you accept a Quote.</p><div className="actions"><button type="button" onClick={() => onWorkspaceChange?.("rfqs")}>View RFQs</button><a href="/marketplace">Browse Marketplace</a></div></div>}
    {!loading && orders.length > 0 && visible.length === 0 && <div className="empty-state"><h4>No matching Orders</h4><p>Try another search or status.</p><button type="button" onClick={() => { setSearch(""); setFilter("all"); }}>Clear Filters</button></div>}
    <div className="review-list" aria-label="Buyer Orders">{visible.map((order) => <article className="review-item" style={{ minWidth: 0, overflowWrap: "anywhere" }} key={order.id}><p className="eyebrow">{purchaseOrderStatusLabels[order.status]}</p><h4>{order.po_number}</h4><p>{purchaseOrderProductName(order)}</p><p>{purchaseOrderManufacturerName(order)}</p><p>{order.currency} {order.subtotal.toFixed(2)}</p><a href={`/marketplace?view=dashboard&workspace=orders&record=${order.id}`} onClick={(event) => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onSelectedPOChange?.(order.id); }}>View Order {order.po_number}</a></article>)}</div>
  </section>;
}
