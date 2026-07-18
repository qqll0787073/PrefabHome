import type { Role } from "../../types";
import { portalWorkspaces, type PortalWorkspace } from "../../lib/portalNavigation";

interface PortalOverviewProps {
  role: Role;
  onWorkspaceChange: (workspace: PortalWorkspace) => void;
}

const roleCopy: Record<Role, { title: string; body: string }> = {
  buyer: {
    title: "Buyer dashboard",
    body: "Follow each transaction from RFQ through logistics planning. Open a workspace to review its current status and next step.",
  },
  manufacturer: {
    title: "Manufacturer dashboard",
    body: "Manage products and move confirmed transactions through production-facing commercial and logistics preparation.",
  },
  admin: {
    title: "Admin operations",
    body: "Review operational queues and use the dedicated workspaces for authority-checked lifecycle actions.",
  },
};

export function PortalOverview({ role, onWorkspaceChange }: PortalOverviewProps) {
  const workspaces = portalWorkspaces[role].filter((item) => item.id !== "overview");
  return (
    <section className="portal-overview" aria-labelledby="portal-overview-title">
      <div className="portal-overview-heading">
        <p className="eyebrow">Beta workspace</p>
        <h3 id="portal-overview-title">{roleCopy[role].title}</h3>
        <p>{roleCopy[role].body}</p>
      </div>
      <div className="workspace-card-grid">
        {workspaces.map((workspace) => (
          <button
            type="button"
            className="workspace-card"
            key={workspace.id}
            onClick={() => onWorkspaceChange(workspace.id)}
          >
            <strong>{workspace.label}</strong>
            <span>{workspace.description}</span>
          </button>
        ))}
      </div>
      <aside className="beta-activity-note" aria-label="Activity summary">
        <strong>Activity summary</strong>
        <p>Centralized notifications are not available in this Beta. Current activity and next actions are shown inside each workspace.</p>
      </aside>
    </section>
  );
}
