import React, { useCallback, useEffect, useState } from "react";
import type { AuthUser } from "../../lib/auth";
import { formatDate } from "../../lib/format";
import { fetchBuyerRFQs, rfqStatusLabels } from "../../lib/rfq";
import type { RFQWithDetails } from "../../types";
import { buyerOverviewMetrics, buyerRFQContext, buyerRFQTitle, recentBuyerRFQs } from "./buyerOverviewModel";

interface BuyerOverviewProps {
  user: AuthUser;
  loadRFQs?: () => Promise<RFQWithDetails[]>;
}

export function BuyerOverview({ user, loadRFQs = fetchBuyerRFQs }: BuyerOverviewProps) {
  const [rfqs, setRFQs] = useState<RFQWithDetails[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    setState("loading");
    try {
      setRFQs(await loadRFQs());
      setState("ready");
    } catch {
      setState("error");
    }
  }, [loadRFQs]);

  useEffect(() => { void load(); }, [load]);

  if (state === "loading") {
    return (
      <section className="portal-overview" aria-labelledby="buyer-overview-title" aria-busy="true">
        <div className="buyer-overview-heading">
          <p className="eyebrow">Buyer overview</p>
          <h3 id="buyer-overview-title">Welcome, {user.fullName}</h3>
          <p>Loading your RFQ activity…</p>
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
        <p className="eyebrow">Buyer overview</p>
        <h3 id="buyer-overview-title">We couldn’t load your dashboard</h3>
        <p role="alert">Your account is still protected. Try loading your RFQ activity again.</p>
        <button type="button" onClick={() => void load()}>Retry</button>
      </section>
    );
  }

  const metrics = buyerOverviewMetrics(rfqs);
  const recent = recentBuyerRFQs(rfqs);
  const cards = [
    ["Active RFQs", metrics.active], ["Draft RFQs", metrics.drafts],
    ["Submitted / open", metrics.open], ["Total RFQs", metrics.total],
  ] as const;

  return (
    <section className="portal-overview" aria-labelledby="buyer-overview-title">
      <div className="buyer-overview-heading">
        <p className="eyebrow">Buyer overview</p>
        <h3 id="buyer-overview-title">Welcome, {user.fullName}</h3>
        <p>Buyer account · Review your latest requests and continue where you left off.</p>
      </div>

      <section aria-labelledby="buyer-summary-title">
        <h4 id="buyer-summary-title">RFQ summary</h4>
        <div className="workspace-card-grid">
          {cards.map(([label, value]) => (
            <article className="workspace-card" key={label}>
              <span>{label}</span><strong>{value}</strong>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="recent-rfqs-title">
        <div className="section-heading">
          <div><h4 id="recent-rfqs-title">Recent RFQs</h4><p>Your five most recently updated requests.</p></div>
          <a href="/marketplace?view=dashboard&workspace=rfqs">View all RFQs</a>
        </div>
        {recent.length === 0 ? (
          <div className="beta-activity-note">
            <h5>No RFQs yet</h5>
            <p>Browse the marketplace to find a prefab home and start an RFQ from its product page.</p>
            <a href="/marketplace">Browse Marketplace</a>
          </div>
        ) : (
          <ul className="request-list">
            {recent.map((rfq) => {
              const context = buyerRFQContext(rfq);
              return (
                <li className="workspace-card" key={rfq.id}>
                  <div>
                    <a aria-label={`Open RFQ for ${buyerRFQTitle(rfq)}`} href={`/marketplace?view=dashboard&workspace=rfqs&record=${encodeURIComponent(rfq.id)}`}><strong>{buyerRFQTitle(rfq)}</strong></a>
                    <span>{context ? `${context} — ` : ""}Reference {rfq.id.slice(0, 8)}</span>
                  </div>
                  <span className="buyer-rfq-status">Status: {rfqStatusLabels[rfq.status]}</span>
                  <time dateTime={rfq.updated_at}>Updated {formatDate(rfq.updated_at)}</time>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <nav className="beta-activity-note" aria-label="Buyer quick actions">
        <h4>Quick actions</h4>
        <div><a href="/marketplace?view=dashboard&workspace=rfqs">View all RFQs</a><a href="/marketplace">Browse Marketplace</a></div>
      </nav>
    </section>
  );
}
