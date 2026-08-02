import { useEffect, useRef, useState } from "react";
import { AppHeader } from "../components/layout/AppHeader";
import { PortalNavigation } from "../components/layout/PortalNavigation";
import { AiAdvisorView } from "../features/advisor/AiAdvisorView";
import { PortalDashboard } from "../features/dashboard/PortalDashboard";
import { ImportCenterView } from "../features/import-center/ImportCenterView";
import { CompareView } from "../features/marketplace/CompareView";
import { MarketplacePage } from "../features/marketplace/MarketplacePage";
import { useAuth } from "../lib/auth";
import { applyPortalMetadata } from "../lib/publicSite";
import {
  buildPortalSearch,
  normalizePortalWorkspace,
  readPortalLocation,
  type PortalWorkspace,
} from "../lib/portalNavigation";
import type { Role, View } from "../types";

interface PortalApplicationProps {
  onPublicHome: () => void;
}

export function PortalApplication({ onPublicHome }: PortalApplicationProps) {
  const auth = useAuth();
  const initialLocation = readPortalLocation(window.location.search);
  const pendingRestoredWorkspace = useRef(initialLocation.workspace);
  const previousAuthenticatedUserId = useRef<string | null>(null);
  const [role, setRole] = useState<Role>("buyer");
  const [view, setView] = useState<View>(initialLocation.view);
  const [workspace, setWorkspace] = useState<PortalWorkspace>(
    normalizePortalWorkspace("buyer", initialLocation.workspace),
  );
  const [selectedLogisticsRequestId, setSelectedLogisticsRequestId] = useState<string | null>(
    initialLocation.requestId,
  );
  const [selectedWorkflowRecordId, setSelectedWorkflowRecordId] = useState<string | null>(
    initialLocation.recordId,
  );

  function syncUrl(
    next: { view: View; workspace: PortalWorkspace; requestId: string | null; recordId: string | null },
    replace = false,
  ) {
    const url = `/marketplace${buildPortalSearch(next)}`;
    window.history[replace ? "replaceState" : "pushState"]({}, "", url);
  }

  function changeView(nextView: View) {
    setView(nextView);
    if (nextView !== "dashboard") setSelectedWorkflowRecordId(null);
    syncUrl({ view: nextView, workspace, requestId: selectedLogisticsRequestId, recordId: nextView === "dashboard" ? selectedWorkflowRecordId : null });
  }

  function changeRole(nextRole: Role) {
    pendingRestoredWorkspace.current = null;
    const nextWorkspace = normalizePortalWorkspace(nextRole, workspace);
    setRole(nextRole);
    setView("dashboard");
    setWorkspace(nextWorkspace);
    setSelectedLogisticsRequestId(null);
    setSelectedWorkflowRecordId(null);
    syncUrl({ view: "dashboard", workspace: nextWorkspace, requestId: null, recordId: null });
  }

  function changeWorkspace(nextWorkspace: PortalWorkspace) {
    pendingRestoredWorkspace.current = null;
    setWorkspace(nextWorkspace);
    setSelectedLogisticsRequestId(null);
    setSelectedWorkflowRecordId(null);
    syncUrl({ view: "dashboard", workspace: nextWorkspace, requestId: null, recordId: null });
  }

  function changeLogisticsRequest(requestId: string | null) {
    setSelectedLogisticsRequestId(requestId);
    setSelectedWorkflowRecordId(null);
    syncUrl({ view: "dashboard", workspace: "logistics", requestId, recordId: null });
  }

  function changeWorkflowRecord(recordId: string | null) {
    if (recordId === selectedWorkflowRecordId) return;
    setSelectedWorkflowRecordId(recordId);
    syncUrl({ view: "dashboard", workspace, requestId: null, recordId });
  }

  useEffect(() => {
    applyPortalMetadata();
  }, []);

  useEffect(() => {
    if (!auth.user) return;
    const nextRole = auth.user.role;
    const nextWorkspace = normalizePortalWorkspace(nextRole, pendingRestoredWorkspace.current ?? workspace);
    const hasPreviousUser = previousAuthenticatedUserId.current !== null;
    const userChanged = hasPreviousUser && previousAuthenticatedUserId.current !== auth.user.id;
    const roleChanged = hasPreviousUser && nextRole !== role;
    const clearWorkflowRecord = userChanged || roleChanged;
    previousAuthenticatedUserId.current = auth.user.id;
    pendingRestoredWorkspace.current = null;
    setRole(nextRole);
    setWorkspace(nextWorkspace);
    if (clearWorkflowRecord) setSelectedWorkflowRecordId(null);
    syncUrl({ view, workspace: nextWorkspace, requestId: selectedLogisticsRequestId, recordId: clearWorkflowRecord ? null : selectedWorkflowRecordId }, true);
  }, [auth.user?.id]);

  useEffect(() => {
    function restoreLocation() {
      const location = readPortalLocation(window.location.search);
      setView(location.view);
      setWorkspace(normalizePortalWorkspace(role, location.workspace));
      setSelectedLogisticsRequestId(location.requestId);
      setSelectedWorkflowRecordId(location.recordId);
    }
    window.addEventListener("popstate", restoreLocation);
    return () => window.removeEventListener("popstate", restoreLocation);
  }, [role]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#portal-content">Skip to main content</a>
      <AppHeader auth={auth} role={role} onRoleChange={changeRole} onPublicHome={onPublicHome} />
      <PortalNavigation view={view} onViewChange={changeView} />

      <main id="portal-content" tabIndex={-1}>
        {view === "browse" && <MarketplacePage user={auth.user} onViewChange={changeView} />}

        {view === "compare" && <CompareView />}

        {view === "advisor" && <AiAdvisorView />}

        {view === "import-center" && <ImportCenterView />}

        {view === "dashboard" && (
          <PortalDashboard
            auth={auth}
            role={role}
            workspace={workspace}
            selectedLogisticsRequestId={selectedLogisticsRequestId}
            selectedWorkflowRecordId={selectedWorkflowRecordId}
            onRoleChange={changeRole}
            onWorkspaceChange={changeWorkspace}
            onLogisticsRequestChange={changeLogisticsRequest}
            onWorkflowRecordChange={changeWorkflowRecord}
          />
        )}
      </main>
    </div>
  );
}
