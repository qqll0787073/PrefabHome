import { useState } from "react";
import { AppHeader } from "../components/layout/AppHeader";
import { PortalNavigation } from "../components/layout/PortalNavigation";
import { AiAdvisorView } from "../features/advisor/AiAdvisorView";
import { PortalDashboard } from "../features/dashboard/PortalDashboard";
import { ImportCenterView } from "../features/import-center/ImportCenterView";
import { CompareView } from "../features/marketplace/CompareView";
import { MarketplacePage } from "../features/marketplace/MarketplacePage";
import { useAuth } from "../lib/auth";
import type { Role, View } from "../types";

function App() {
  const auth = useAuth();
  const [role, setRole] = useState<Role>("buyer");
  const [view, setView] = useState<View>("browse");

  return (
    <div className="app-shell">
      <AppHeader auth={auth} role={role} onRoleChange={setRole} onViewChange={setView} />
      <PortalNavigation view={view} onViewChange={setView} />

      <main>
        {view === "browse" && <MarketplacePage user={auth.user} onViewChange={setView} />}

        {view === "compare" && <CompareView />}

        {view === "advisor" && <AiAdvisorView />}

        {view === "import-center" && <ImportCenterView />}

        {view === "dashboard" && (
          <PortalDashboard
            auth={auth}
            role={role}
            onRoleChange={setRole}
          />
        )}
      </main>
    </div>
  );
}

export default App;
