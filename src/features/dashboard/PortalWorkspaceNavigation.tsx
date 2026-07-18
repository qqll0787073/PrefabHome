import React from "react";
import type { Role } from "../../types";
import { portalWorkspaces, type PortalWorkspace } from "../../lib/portalNavigation";

interface PortalWorkspaceNavigationProps {
  role: Role;
  workspace: PortalWorkspace;
  onWorkspaceChange: (workspace: PortalWorkspace) => void;
}

export function PortalWorkspaceNavigation({ role, workspace, onWorkspaceChange }: PortalWorkspaceNavigationProps) {
  return (
    <nav className="portal-workspace-nav" aria-label={`${role} portal workspaces`}>
      {portalWorkspaces[role].map((item) => (
        <button
          type="button"
          key={item.id}
          className={workspace === item.id ? "active" : ""}
          aria-current={workspace === item.id ? "page" : undefined}
          onClick={() => onWorkspaceChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
