import React from "react";
import type { Role } from "../../types";
import {
  buildPortalSearch,
  portalWorkspaces,
  type PortalWorkspace,
} from "../../lib/portalNavigation";

interface PortalWorkspaceNavigationProps {
  role: Role;
  workspace: PortalWorkspace;
  onWorkspaceChange: (workspace: PortalWorkspace) => void;
}

export function PortalWorkspaceNavigation({ role, workspace, onWorkspaceChange }: PortalWorkspaceNavigationProps) {
  return (
    <nav className="portal-workspace-nav" aria-label={`${role} portal workspaces`}>
      {portalWorkspaces[role].map((item) => (
        <a
          key={item.id}
          className={workspace === item.id ? "pw-link active" : "pw-link"}
          aria-current={workspace === item.id ? "page" : undefined}
          href={`/marketplace${buildPortalSearch({
            view: "dashboard",
            workspace: item.id,
            requestId: null,
            recordId: null,
          })}`}
          onClick={(event) => {
            event.preventDefault();
            onWorkspaceChange(item.id);
          }}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
