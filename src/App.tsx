import { useMemo, useState } from "react";
import { messages, products, quoteRequests } from "./data";
import type { Product, Role, View } from "./types";

const roleLabels: Record<Role, string> = {
  buyer: "Buyer Portal",
  manufacturer: "Manufacturer Portal",
  admin: "Admin Portal",
};

const viewLabels: Record<View, string> = {
  browse: "Browse",
  compare: "Compare",
  advisor: "AI Advisor",
  "import-center": "Import Center",
  dashboard: "Dashboard",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function App() {
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
      <header className="topbar">
        <div>
          <p className="eyebrow">China Factories x U.S. Buyers</p>
          <h1>PrefabHome Marketplace</h1>
        </div>
        <div className="role-switcher" aria-label="Portal role">
          {(Object.keys(roleLabels) as Role[]).map((item) => (
            <button
              key={item}
              className={role === item ? "active" : ""}
              onClick={() => {
                setRole(item);
                setView("dashboard");
              }}
            >
              {roleLabels[item]}
            </button>
          ))}
        </div>
      </header>

      <nav className="nav-tabs" aria-label="Primary">
        {(Object.keys(viewLabels) as View[]).map((item) => (
          <button
            key={item}
            className={view === item ? "active" : ""}
            onClick={() => setView(item)}
          >
            {viewLabels[item]}
          </button>
        ))}
      </nav>

      <main>
        {view === "browse" && (
          <>
            <section className="hero">
              <div>
                <p className="eyebrow badge">Direct Cross-Border Marketplace</p>
                <h2>Buy Chinese prefab modular homes directly</h2>
                <p>
                  Browse verified factory listings, compare models, request quotes, and prepare
                  import, customs, and local permit review in one workflow.
                </p>
              </div>
              <div className="search-panel">
                <label htmlFor="listing-search">Search models</label>
                <input
                  id="listing-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search models, materials, categories..."
                />
                <button onClick={() => setView("advisor")}>Ask AI Advisor</button>
              </div>
            </section>

            <section className="content-grid">
              <aside className="filters">
                <h3>Filters</h3>
                <button>All Products</button>
                <button>ADU</button>
                <button>Tiny House</button>
                <button>Container House</button>
                <label>
                  <input type="checkbox" /> Customizable only
                </label>
                <label>
                  <input type="checkbox" /> Off-grid compatible
                </label>
              </aside>
              <div className="product-grid">
                {filteredProducts.map((product) => (
                  <article className="product-card" key={product.id}>
                    <img src={product.imageUrl} alt={product.name} />
                    <div className="product-body">
                      <p className="eyebrow">{product.category}</p>
                      <h3>{product.name}</h3>
                      <p>{product.description}</p>
                      <div className="meta-row">
                        <span>{formatCurrency(product.price)}</span>
                        <span>{product.sizeSqFt} sq ft</span>
                        <span>{product.leadTimeWeeks} weeks</span>
                      </div>
                      <div className="tag-row">
                        {product.tags.map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                      <div className="actions">
                        <button onClick={() => setSelectedProduct(product)}>Details</button>
                        <button onClick={() => toggleSaved(product.id)}>
                          {saved.includes(product.id) ? "Saved" : "Save"}
                        </button>
                        <button onClick={() => toggleCompare(product.id)}>
                          {compare.includes(product.id) ? "Comparing" : "Compare"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}

        {view === "compare" && (
          <section className="panel">
            <h2>Compare Models</h2>
            <div className="comparison-table">
              {comparedProducts.map((product) => (
                <article key={product.id}>
                  <h3>{product.name}</h3>
                  <p>{formatCurrency(product.price)}</p>
                  <p>{product.sizeSqFt} sq ft</p>
                  <p>{product.leadTimeWeeks} week lead time</p>
                  <button onClick={() => toggleCompare(product.id)}>Remove</button>
                </article>
              ))}
            </div>
          </section>
        )}

        {view === "advisor" && (
          <section className="panel advisor">
            <p className="eyebrow">AI Home Advisor</p>
            <h2>Zoning, model fit, and import planning assistant</h2>
            <p>
              Production will call a server-side AI endpoint. API keys stay on the server; the
              browser sends only buyer questions and selected listing context.
            </p>
            <textarea placeholder="Describe your lot, budget, intended use, and state..." />
            <button>Generate Planning Checklist</button>
          </section>
        )}

        {view === "import-center" && (
          <section className="panel">
            <p className="eyebrow">Import & Customs Document Center</p>
            <h2>Document readiness</h2>
            <div className="document-list">
              {["Commercial invoice", "Packing list", "Bill of lading", "Material certificates"].map(
                (item) => (
                  <label key={item}>
                    <input type="checkbox" /> {item}
                  </label>
                )
              )}
            </div>
          </section>
        )}

        {view === "dashboard" && (
          <section className="dashboard-grid">
            <div className="panel">
              <p className="eyebrow">{roleLabels[role]}</p>
              <h2>{role === "buyer" ? "Buyer workspace" : role === "manufacturer" ? "Factory workspace" : "Admin operations"}</h2>
              <p>
                This preserves the prototype portal surface while the production implementation
                moves permissions and data into Supabase.
              </p>
            </div>
            <div className="panel">
              <h3>Quote Requests</h3>
              {quoteRequests.map((quote) => (
                <div className="list-item" key={quote.id}>
                  <strong>{quote.productName}</strong>
                  <span>{quote.status}</span>
                </div>
              ))}
            </div>
            <div className="panel">
              <h3>Messaging</h3>
              {messages.map((message) => (
                <div className="message" key={message.id}>
                  <strong>{message.from}</strong>
                  <p>{message.body}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {selectedProduct && view === "browse" && (
          <aside className="details-panel">
            <button className="close-button" onClick={() => setSelectedProduct(null)}>
              Close
            </button>
            <h2>{selectedProduct.name}</h2>
            <p>{selectedProduct.manufacturer}</p>
            <p>{selectedProduct.location}</p>
            <ul>
              {selectedProduct.compliance.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <button>Request Quote</button>
          </aside>
        )}
      </main>
    </div>
  );
}

export default App;
