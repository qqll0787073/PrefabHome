import { useEffect, useRef, useState } from "react";
import { AppHeader } from "../components/layout/AppHeader";
import { PortalNavigation } from "../components/layout/PortalNavigation";
import { AiAdvisorView } from "../features/advisor/AiAdvisorView";
import { PortalDashboard } from "../features/dashboard/PortalDashboard";
import { ImportCenterView } from "../features/import-center/ImportCenterView";
import { CompareView } from "../features/marketplace/CompareView";
import { MarketplacePage } from "../features/marketplace/MarketplacePage";
import { useAuth } from "../lib/auth";
import {
  buildPortalSearch,
  normalizePortalWorkspace,
  readPortalLocation,
  type PortalWorkspace,
} from "../lib/portalNavigation";
import type { Role, View } from "../types";

function App() {
  const auth = useAuth();
  const initialLocation = readPortalLocation(window.location.search);
  const pendingRestoredWorkspace = useRef(initialLocation.workspace);
  const [role, setRole] = useState<Role>("buyer");
  const [view, setView] = useState<View>(initialLocation.view);
  const [workspace, setWorkspace] = useState<PortalWorkspace>(
    normalizePortalWorkspace("buyer", initialLocation.workspace),
  );
  const [selectedLogisticsRequestId, setSelectedLogisticsRequestId] = useState<string | null>(
    initialLocation.requestId,
  );

  function syncUrl(
    next: { view: View; workspace: PortalWorkspace; requestId: string | null },
    replace = false,
  ) {
    const url = `${window.location.pathname}${buildPortalSearch(next)}${window.location.hash}`;
    window.history[replace ? "replaceState" : "pushState"]({}, "", url);
  }

  function changeView(nextView: View) {
    setView(nextView);
    syncUrl({ view: nextView, workspace, requestId: selectedLogisticsRequestId });
  }

  function changeRole(nextRole: Role) {
    pendingRestoredWorkspace.current = null;
    const nextWorkspace = normalizePortalWorkspace(nextRole, workspace);
    setRole(nextRole);
    setView("dashboard");
    setWorkspace(nextWorkspace);
    setSelectedLogisticsRequestId(null);
    syncUrl({ view: "dashboard", workspace: nextWorkspace, requestId: null });
  }

  function changeWorkspace(nextWorkspace: PortalWorkspace) {
    pendingRestoredWorkspace.current = null;
    setWorkspace(nextWorkspace);
    setSelectedLogisticsRequestId(null);
    syncUrl({ view: "dashboard", workspace: nextWorkspace, requestId: null });
  }

  function changeLogisticsRequest(requestId: string | null) {
    setSelectedLogisticsRequestId(requestId);
    syncUrl({ view: "dashboard", workspace: "logistics", requestId });
  }

  useEffect(() => {
    if (!auth.user) return;
    const nextRole = auth.user.role;
    const nextWorkspace = normalizePortalWorkspace(nextRole, pendingRestoredWorkspace.current ?? workspace);
    pendingRestoredWorkspace.current = null;
    setRole(nextRole);
    setWorkspace(nextWorkspace);
    syncUrl({ view, workspace: nextWorkspace, requestId: selectedLogisticsRequestId }, true);
  }, [auth.user?.id]);

  useEffect(() => {
    function restoreLocation() {
      const location = readPortalLocation(window.location.search);
      setView(location.view);
      setWorkspace(normalizePortalWorkspace(role, location.workspace));
      setSelectedLogisticsRequestId(location.requestId);
    }
    window.addEventListener("popstate", restoreLocation);
    return () => window.removeEventListener("popstate", restoreLocation);
  }, [role]);

  return (
    <div className="app-shell">
      <AppHeader auth={auth} role={role} onRoleChange={changeRole} />
      <PortalNavigation view={view} onViewChange={changeView} />

      <main>
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
            onRoleChange={changeRole}
            onWorkspaceChange={changeWorkspace}
            onLogisticsRequestChange={changeLogisticsRequest}
          />
        )}
      </main>
    </div>
  );
}

export default App;
