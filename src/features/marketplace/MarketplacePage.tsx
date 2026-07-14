import { useEffect, useMemo, useState } from "react";
import {
  defaultMarketplaceFilters,
  fetchMarketplaceFilterOptions,
  fetchMarketplaceProductBySlug,
  fetchMarketplaceProducts,
  isMarketplaceDemoActive,
  marketplaceFiltersKey,
  marketplacePageSize,
  marketplaceProductSlug,
} from "../../lib/marketplace";
import type { AuthUser } from "../../lib/auth";
import type {
  MarketplaceFilterOptions,
  MarketplaceFilters,
  MarketplacePageResult,
  MarketplaceProduct,
  MarketplaceSort,
  View,
} from "../../types";
import { MarketplaceEmptyState } from "./MarketplaceEmptyState";
import { MarketplaceErrorState } from "./MarketplaceErrorState";
import { MarketplaceFilters as MarketplaceFiltersPanel } from "./MarketplaceFilters";
import { MarketplacePagination } from "./MarketplacePagination";
import { MarketplaceProductDetail } from "./MarketplaceProductDetail";
import { MarketplaceProductGrid } from "./MarketplaceProductGrid";
import { MarketplaceSearch } from "./MarketplaceSearch";
import { MarketplaceSort as MarketplaceSortControl } from "./MarketplaceSort";

interface MarketplacePageProps {
  user: AuthUser | null;
  onViewChange: (view: View) => void;
}

const emptyOptions: MarketplaceFilterOptions = {
  categories: [],
  targetMarkets: [],
  certifications: [],
};

export function MarketplacePage({ user, onViewChange }: MarketplacePageProps) {
  const isDemo = isMarketplaceDemoActive();
  const [filters, setFilters] = useState<MarketplaceFilters>(defaultMarketplaceFilters);
  const [sort, setSort] = useState<MarketplaceSort>("newest");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<MarketplacePageResult | null>(null);
  const [options, setOptions] = useState<MarketplaceFilterOptions>(emptyOptions);
  const [selectedProduct, setSelectedProduct] = useState<MarketplaceProduct | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const filterKey = useMemo(() => marketplaceFiltersKey(filters), [filters]);

  useEffect(() => {
    setPage(1);
  }, [filterKey, sort]);

  useEffect(() => {
    let isMounted = true;
    fetchMarketplaceFilterOptions()
      .then((loadedOptions) => {
        if (isMounted) setOptions(loadedOptions);
      })
      .catch(() => {
        if (isMounted) setOptions(emptyOptions);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError("");
    fetchMarketplaceProducts(filters, { page, pageSize: marketplacePageSize }, sort)
      .then((nextResult) => {
        if (!isMounted) return;
        setResult(nextResult);
      })
      .catch((loadError) => {
        if (!isMounted) return;
        setError(loadError instanceof Error ? loadError.message : "Marketplace data could not be loaded.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [filters, page, sort]);

  useEffect(() => {
    function selectFromPath() {
      const match = window.location.pathname.match(/^\/products\/([^/]+)$/);
      const slug = match?.[1] ? decodeURIComponent(match[1]) : "";
      if (!slug) {
        setSelectedProduct(null);
        return;
      }
      fetchMarketplaceProductBySlug(slug)
        .then((product) => setSelectedProduct(product))
        .catch((loadError) =>
          setError(loadError instanceof Error ? loadError.message : "Product details could not be loaded.")
        );
    }

    selectFromPath();
    window.addEventListener("popstate", selectFromPath);
    return () => window.removeEventListener("popstate", selectFromPath);
  }, []);

  function resetFilters() {
    setFilters(defaultMarketplaceFilters);
  }

  function openProduct(product: MarketplaceProduct) {
    setSelectedProduct(product);
    window.history.pushState({}, "", `/products/${encodeURIComponent(marketplaceProductSlug(product))}`);
  }

  function closeProduct() {
    setSelectedProduct(null);
    window.history.pushState({}, "", "/");
  }

  if (selectedProduct) {
    return <MarketplaceProductDetail product={selectedProduct} user={user} onBack={closeProduct} />;
  }

  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow badge">Direct Cross-Border Marketplace</p>
          <h2>Buy Chinese prefab modular homes directly</h2>
          <p>
            Browse approved manufacturer listings with published specifications and
            authorized short-lived product image access.
          </p>
        </div>
        <MarketplaceSearch
          value={filters.search}
          onChange={(search) => setFilters({ ...filters, search })}
          onAdvisorClick={() => onViewChange("advisor")}
        />
      </section>

      <section className="content-grid">
        <MarketplaceFiltersPanel
          filters={filters}
          options={options}
          onChange={setFilters}
          onReset={resetFilters}
        />
        <div className="marketplace-results">
          {isDemo && (
            <section className="panel marketplace-demo-banner" role="status">
              <p className="eyebrow">Demo data</p>
              <p>Local marketplace demo data is enabled. Production must use Supabase data.</p>
            </section>
          )}

          <div className="marketplace-toolbar">
            <div>
              <p className="eyebrow">Published products</p>
              <h3>{isLoading ? "Loading marketplace" : `${result?.total ?? 0} products`}</h3>
            </div>
            <MarketplaceSortControl value={sort} onChange={setSort} />
          </div>

          {isLoading && (
            <section className="panel marketplace-state" aria-live="polite">
              <p>Loading published products...</p>
            </section>
          )}

          {!isLoading && error && (
            <MarketplaceErrorState
              message={error}
              onRetry={() => setFilters({ ...filters })}
            />
          )}

          {!isLoading && !error && result && result.products.length === 0 && (
            <MarketplaceEmptyState onReset={resetFilters} />
          )}

          {!isLoading && !error && result && result.products.length > 0 && (
            <>
              <MarketplaceProductGrid
                products={result.products}
                onSelectProduct={openProduct}
              />
              <MarketplacePagination
                page={result.page}
                totalPages={result.totalPages}
                total={result.total}
                onPageChange={setPage}
              />
            </>
          )}
        </div>
      </section>
    </>
  );
}
