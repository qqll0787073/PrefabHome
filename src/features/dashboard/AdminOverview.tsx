import { useEffect, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import { fetchAdminDashboardSummary, type AdminDashboardSummary } from "../../lib/adminUsers";
import type { PortalWorkspace } from "../../lib/portalNavigation";

const cards: Array<{ key: keyof AdminDashboardSummary; label: string; workspace: PortalWorkspace }> = [
  { key: "total_users", label: "All users", workspace: "users" },
  { key: "suspended_users", label: "Suspended users", workspace: "users" },
  { key: "manufacturer_reviews", label: "Manufacturer reviews", workspace: "manufacturers" },
  { key: "product_reviews", label: "Product reviews", workspace: "products" },
  { key: "actionable_rfqs", label: "Active RFQs", workspace: "rfqs" },
  { key: "actionable_purchase_orders", label: "Actionable purchase orders", workspace: "purchase-orders" },
  { key: "contracts_in_review", label: "Contracts in review", workspace: "contracts" },
  { key: "open_invoices", label: "Open invoices", workspace: "invoices" },
  { key: "shipping_handoffs", label: "Shipping handoffs", workspace: "shipping" },
  { key: "logistics_arrangements", label: "Logistics arrangements", workspace: "logistics" },
];

export function AdminOverview({ authMode, onWorkspaceChange }: { authMode: "supabase" | "demo"; onWorkspaceChange: (workspace: PortalWorkspace) => void }) {
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { let current = true; if (authMode === "demo") return () => { current = false; }; fetchAdminDashboardSummary().then((row) => { if (current) setSummary(row); }).catch((cause) => { if (current) setError(cause instanceof Error ? cause.message : "Admin dashboard summary could not be loaded."); }); return () => { current = false; }; }, [authMode]);
  return <section className="portal-overview" aria-labelledby="admin-overview-title"><div className="portal-overview-heading"><p className="eyebrow">Admin operations</p><h3 id="admin-overview-title">Operational queues</h3><p>Authoritative counts from the current database lifecycle. Open a card to continue in its existing workspace.</p></div>
    <ErrorList errors={error ? [error] : []} />{!summary && !error && authMode === "supabase" && <LoadingState message="Loading operational summary..." />}
    {summary && <><div className="workspace-card-grid">{cards.map((card) => <button type="button" className="workspace-card" key={card.key} onClick={() => onWorkspaceChange(card.workspace)}><strong>{summary[card.key]}</strong><span>{card.label}</span></button>)}</div><aside className="beta-activity-note"><strong>Active access</strong><p>{summary.active_buyers} Buyers · {summary.active_manufacturers} Manufacturers · {summary.active_admins} Administrators · {summary.pending_users} pending</p></aside></>}
  </section>;
}
