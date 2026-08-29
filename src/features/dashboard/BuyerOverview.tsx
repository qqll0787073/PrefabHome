import React, { useCallback, useEffect, useState } from "react";
import type { AuthUser } from "../../lib/auth";
import { fetchBuyerRFQs, fetchManufacturerRFQs, rfqSnapshotTitle, rfqStatusLabels } from "../../lib/rfq";
import { fetchBuyerQuotes } from "../../lib/quotes";
import { fetchBuyerPurchaseOrders } from "../../lib/purchaseOrders";
import { fetchBuyerContracts } from "../../lib/contracts";
import { fetchBuyerInvoices } from "../../lib/invoices";
import { fetchBuyerShippingReadiness } from "../../lib/shippingReadiness";
import type { ContractRecord, InvoiceRecord, PurchaseOrderWithItems, RFQQuoteWithItems, RFQWithDetails, ShippingReadinessRecord } from "../../types";
import { buyerJourneyMetrics, buyerOverviewMetrics, buyerRFQContext, buyerRFQTitle, recentBuyerRFQs } from "./buyerOverviewModel";
import { manufacturerOverviewMetrics, recentManufacturerRFQs } from "./manufacturerOverviewModel";

interface BuyerOverviewProps {
  user: AuthUser;
  loadRFQs?: () => Promise<RFQWithDetails[]>;
  loadBuyerJourney?: () => Promise<BuyerJourneyData>;
  variant?: "buyer" | "manufacturer";
}

export interface BuyerJourneyData {
  quotes: RFQQuoteWithItems[];
  orders: PurchaseOrderWithItems[];
  contracts: ContractRecord[];
  invoices: InvoiceRecord[];
  shipping: ShippingReadinessRecord[];
  unavailable: Array<"quotes" | "orders" | "contracts" | "invoices" | "shipping">;
}

const emptyJourney: BuyerJourneyData = { quotes: [], orders: [], contracts: [], invoices: [], shipping: [], unavailable: [] };

function formatUpdatedAt(value: string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

async function fetchBuyerJourney(): Promise<BuyerJourneyData> {
  const results = await Promise.allSettled([
    fetchBuyerQuotes(), fetchBuyerPurchaseOrders(), fetchBuyerContracts(), fetchBuyerInvoices(), fetchBuyerShippingReadiness(),
  ]);
  return {
    quotes: results[0].status === "fulfilled" ? results[0].value : [],
    orders: results[1].status === "fulfilled" ? results[1].value : [],
    contracts: results[2].status === "fulfilled" ? results[2].value : [],
    invoices: results[3].status === "fulfilled" ? results[3].value : [],
    shipping: results[4].status === "fulfilled" ? results[4].value : [],
    unavailable: (["quotes", "orders", "contracts", "invoices", "shipping"] as const).filter((_, index) => results[index].status === "rejected"),
  };
}

export function BuyerOverview({ user, loadRFQs, loadBuyerJourney, variant = "buyer" }: BuyerOverviewProps) {
  const [rfqs, setRFQs] = useState<RFQWithDetails[]>([]);
  const [journey, setJourney] = useState<BuyerJourneyData>(emptyJourney);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const manufacturer = variant === "manufacturer";
  const fetchRFQs = loadRFQs ?? (manufacturer ? fetchManufacturerRFQs : fetchBuyerRFQs);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const [nextRFQs, nextJourney] = await Promise.all([
        fetchRFQs(),
        manufacturer ? Promise.resolve(emptyJourney) : (loadBuyerJourney ?? fetchBuyerJourney)(),
      ]);
      setRFQs(nextRFQs);
      setJourney(nextJourney);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [fetchRFQs, loadBuyerJourney, manufacturer]);

  useEffect(() => { void load(); }, [load]);

  if (state === "loading") {
    return (
      <section className="portal-overview" aria-labelledby="buyer-overview-title" aria-busy="true">
        <div className="buyer-overview-heading">
          <p className="eyebrow">{manufacturer ? "Manufacturer" : "Buyer"} overview</p>
          <h3 id="buyer-overview-title">Welcome, {user.fullName}</h3>
          <p>Loading your {manufacturer ? "authorized " : ""}RFQ activity…</p>
        </div>
        <div className="workspace-card-grid" aria-hidden="true">
          {[1, 2, 3, 4].map((item) => <div className="workspace-card" key={item}>Loading…</div>)}
        </div>
      </section>
    );
  }

  if (state === "error") {
    return (
      <section className="buyer-overview buyer-overview-error" aria-labelledby="buyer-overview-title">
        <p className="eyebrow">{manufacturer ? "Manufacturer" : "Buyer"} overview</p>
        <h3 id="buyer-overview-title">We couldn’t load your dashboard</h3>
        <p role="alert">Your account is still protected. Try loading your RFQ activity again.</p>
        <button type="button" onClick={() => void load()}>Retry</button>
      </section>
    );
  }

  const buyerMetrics = buyerOverviewMetrics(rfqs);
  const journeyMetrics = buyerJourneyMetrics(journey);
  const manufacturerMetrics = manufacturerOverviewMetrics(rfqs);
  const recent = manufacturer ? recentManufacturerRFQs(rfqs) : recentBuyerRFQs(rfqs);
  const cards: ReadonlyArray<readonly [string, number]> = manufacturer
    ? [["New requests", manufacturerMetrics.newRequests], ["Preparing quotes", manufacturerMetrics.preparingQuotes], ["Buyer review", manufacturerMetrics.buyerReview], ["Revisions requested", manufacturerMetrics.revisionsRequested]]
    : [["Active RFQs", buyerMetrics.active], ["Draft RFQs", buyerMetrics.drafts], ["Submitted / open", buyerMetrics.open], ["Total RFQs", buyerMetrics.total]];

  return (
    <section className="portal-overview" aria-labelledby="buyer-overview-title">
      <div className="buyer-overview-heading">
        <p className="eyebrow">{manufacturer ? "Manufacturer" : "Buyer"} overview</p>
        <h3 id="buyer-overview-title">Welcome, {user.fullName}</h3>
        <p>{manufacturer ? "Review assigned RFQs and continue quote work from the server-authorized workflow." : "Buyer account · Review your latest requests and continue where you left off."}</p>
      </div>

      <section aria-labelledby="buyer-summary-title">
        <h4 id="buyer-summary-title">{manufacturer ? "RFQ and Quote summary" : "RFQ summary"}</h4>
        <div className="workspace-card-grid">
          {cards.map(([label, value]) => (
            <article className="workspace-card" key={label}>
              <span>{label}</span><strong>{value}</strong>
            </article>
          ))}
        </div>
      </section>

      {!manufacturer && (
        <section aria-labelledby="buyer-journey-summary-title">
          <div className="section-heading"><div><h4 id="buyer-journey-summary-title">Needs attention</h4><p>Continue from authoritative transaction records already available to your account.</p></div></div>
          <div className="workspace-card-grid">
            {([
              ["Quotes awaiting decision", journeyMetrics.quotesAwaitingDecision, "quotes"],
              ["Active orders", journeyMetrics.activeOrders, "orders"],
              ["Contracts needing attention", journeyMetrics.contractsNeedingAttention, "contracts"],
              ["Open invoices", journeyMetrics.openInvoices, "invoices"],
              ["Shipping in progress", journeyMetrics.shippingInProgress, "shipping"],
            ] as const).map(([label, count, workspace]) => {
              const unavailable = journey.unavailable.includes(workspace);
              return (
              <a className="workspace-card" href={`/marketplace?view=dashboard&workspace=${workspace}`} key={label}>
                <span>{label}</span><strong>{unavailable ? "Unavailable" : count}</strong><small>{unavailable ? "Open workspace to retry" : count === 0 ? "Nothing needs attention" : "Open workspace"}</small>
              </a>
              );
            })}
          </div>
        </section>
      )}

      <section aria-labelledby="recent-rfqs-title">
        <div className="section-heading">
          <div><h4 id="recent-rfqs-title">Recent RFQs</h4><p>Your five most recently updated {manufacturer ? "assigned " : ""}requests.</p></div>
          <a href="/marketplace?view=dashboard&workspace=rfqs">{manufacturer ? "Open RFQ Inbox" : "View all RFQs"}</a>
        </div>
        {recent.length === 0 ? (
          <div className="beta-activity-note">
            <h5>{manufacturer ? "No assigned RFQs" : "No RFQs yet"}</h5>
            <p>{manufacturer ? "New submitted Buyer requests will appear here after backend authorization." : "Browse the marketplace to find a prefab home and start an RFQ from its product page."}</p>
            {!manufacturer && <a href="/marketplace">Browse Marketplace</a>}
          </div>
        ) : (
          <ul className="request-list">
            {recent.map((rfq) => {
              const context = manufacturer ? null : buyerRFQContext(rfq);
              const title = manufacturer ? rfqSnapshotTitle(rfq.product_snapshot) : buyerRFQTitle(rfq);
              return (
                <li className="workspace-card" key={rfq.id}>
                  <div>
                    <a aria-label={`Open RFQ for ${title}`} href={`/marketplace?view=dashboard&workspace=rfqs&record=${encodeURIComponent(rfq.id)}`}><strong>{title}</strong></a>
                    <span>{manufacturer ? `${rfq.requested_quantity} units to ${rfq.destination_country}` : `${context ? `${context} — ` : ""}Reference ${rfq.id.slice(0, 8)}`}</span>
                  </div>
                  <span className="buyer-rfq-status">Status: {rfqStatusLabels[rfq.status]}</span>
                  <time dateTime={rfq.updated_at}>Updated {formatUpdatedAt(rfq.updated_at)}</time>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <nav className="beta-activity-note" aria-label={`${manufacturer ? "Manufacturer" : "Buyer"} quick actions`}>
        <h4>Quick actions</h4>
        <div><a href="/marketplace?view=dashboard&workspace=rfqs">{manufacturer ? "Open RFQ Inbox" : "View all RFQs"}</a><a href={manufacturer ? "/marketplace?view=dashboard&workspace=quotes" : "/marketplace"}>{manufacturer ? "Review Quote history" : "Browse Marketplace"}</a>{manufacturer && <a href="/marketplace?view=dashboard&workspace=company">Manage Company Profile</a>}</div>
      </nav>
    </section>
  );
}
