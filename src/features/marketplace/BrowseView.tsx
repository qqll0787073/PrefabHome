import type { Product, View } from "../../types";
import { formatCurrency } from "../../lib/format";

interface BrowseViewProps {
  filteredProducts: Product[];
  query: string;
  saved: string[];
  compare: string[];
  onQueryChange: (query: string) => void;
  onViewChange: (view: View) => void;
  onSelectProduct: (product: Product) => void;
  onToggleSaved: (productId: string) => void;
  onToggleCompare: (productId: string) => void;
}

export function BrowseView({
  filteredProducts,
  query,
  saved,
  compare,
  onQueryChange,
  onViewChange,
  onSelectProduct,
  onToggleSaved,
  onToggleCompare,
}: BrowseViewProps) {
  return (
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
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search models, materials, categories..."
          />
          <button onClick={() => onViewChange("advisor")}>Ask AI Advisor</button>
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
                  <button onClick={() => onSelectProduct(product)}>Details</button>
                  <button onClick={() => onToggleSaved(product.id)}>
                    {saved.includes(product.id) ? "Saved" : "Save"}
                  </button>
                  <button onClick={() => onToggleCompare(product.id)}>
                    {compare.includes(product.id) ? "Comparing" : "Compare"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
