import { useMemo, useState } from "react";
import { AppHeader } from "../components/layout/AppHeader";
import { PortalNavigation } from "../components/layout/PortalNavigation";
import { AiAdvisorView } from "../features/advisor/AiAdvisorView";
import { PortalDashboard } from "../features/dashboard/PortalDashboard";
import { ImportCenterView } from "../features/import-center/ImportCenterView";
import { BrowseView } from "../features/marketplace/BrowseView";
import { CompareView } from "../features/marketplace/CompareView";
import { ProductDetailsPanel } from "../features/marketplace/ProductDetailsPanel";
import { messages, products, quoteRequests } from "../data";
import { useAuth } from "../lib/auth";
import type { Product, Role, View } from "../types";

function App() {
  const auth = useAuth();
  const [role, setRole] = useState<Role>("buyer");
  const [view, setView] = useState<View>("browse");
  const [query, setQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(products[0]);
  const [saved, setSaved] = useState<string[]>(["house-20-fold"]);
  const [compare, setCompare] = useState<string[]>(["house-20-fold", "house-40-container"]);

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return products;
    return products.filter((product) =>
      [product.name, product.category, product.manufacturer, product.description]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [query]);

  const comparedProducts = products.filter((product) => compare.includes(product.id));

  function toggleSaved(productId: string) {
    setSaved((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId]
    );
  }

  function toggleCompare(productId: string) {
    setCompare((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : current.length >= 4
          ? current
          : [...current, productId]
    );
  }

  return (
    <div className="app-shell">
      <AppHeader auth={auth} role={role} onRoleChange={setRole} onViewChange={setView} />
      <PortalNavigation view={view} onViewChange={setView} />

      <main>
        {view === "browse" && (
          <BrowseView
            filteredProducts={filteredProducts}
            query={query}
            saved={saved}
            compare={compare}
            onQueryChange={setQuery}
            onViewChange={setView}
            onSelectProduct={setSelectedProduct}
            onToggleSaved={toggleSaved}
            onToggleCompare={toggleCompare}
          />
        )}

        {view === "compare" && (
          <CompareView comparedProducts={comparedProducts} onToggleCompare={toggleCompare} />
        )}

        {view === "advisor" && <AiAdvisorView />}

        {view === "import-center" && <ImportCenterView />}

        {view === "dashboard" && (
          <PortalDashboard
            auth={auth}
            role={role}
            quoteRequests={quoteRequests}
            messages={messages}
            onRoleChange={setRole}
          />
        )}

        {selectedProduct && view === "browse" && (
          <ProductDetailsPanel
            product={selectedProduct}
            onClose={() => setSelectedProduct(null)}
          />
        )}
      </main>
    </div>
  );
}

export default App;
