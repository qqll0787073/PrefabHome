import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MarketplaceProduct } from "../../types";
import {
  buyerFavoriteSortLabels,
  favoriteProductHref,
  fetchBuyerFavorites,
  removeBuyerFavorite,
  selectBuyerFavorites,
  type BuyerFavorite,
  type BuyerFavoriteSort,
} from "../../lib/buyerFavorites";

export function BuyerFavoritesLoadingState() {
  return <div className="marketplace-state panel" role="status" aria-busy="true"><p>Loading your favorite products...</p></div>;
}

export function BuyerFavoritesEmptyState() {
  return <div className="marketplace-state panel"><h3>No favorite products yet</h3><p>Browse the Marketplace and save products you want to revisit.</p><a className="button-link" href="/marketplace?view=browse">Browse Marketplace</a></div>;
}

export function BuyerFavoritesErrorState({ onRetry }: { onRetry: () => void }) {
  return <div className="workspace-error" role="alert"><h3>Favorite Products could not load</h3><p>Your favorites are temporarily unavailable. Please try again.</p><button type="button" onClick={onRetry}>Retry</button></div>;
}

export function BuyerFavoriteProductCard({ favorite, removing, onRemove }: { favorite: BuyerFavorite; removing: boolean; onRemove: (product: MarketplaceProduct) => void }) {
  const { product } = favorite;
  const title = product.model_name || product.name;
  const favoriteDate = formatFavoriteDate(favorite.favoritedAt);
  return (
    <article className="product-card marketplace-product-card">
      {product.image_url ? <img src={product.image_url} alt={product.primary_image?.alt_text || title} loading="lazy" decoding="async" /> : <div className="marketplace-image-placeholder" role="img" aria-label={`${title} image unavailable`}>Image pending</div>}
      <div className="product-body">
        <p className="eyebrow">{product.category}</p>
        <h3>{title}</h3>
        <p className="manufacturer-line">{product.manufacturer_display_name}</p>
        <p>{product.manufacturer_country || "Country not listed"}</p>
        <p><strong>Favorited:</strong> <time dateTime={favorite.favoritedAt}>{favoriteDate}</time></p>
        <div className="actions">
          <a className="button-link" href={favoriteProductHref(product)} aria-label={`View ${title} in Marketplace`}>View Product</a>
          <button type="button" className="secondary" disabled={removing} aria-label={`Remove ${title} from favorites`} onClick={() => onRemove(product)}>{removing ? "Removing..." : "Remove Favorite"}</button>
        </div>
      </div>
    </article>
  );
}

export function BuyerFavoritesWorkspace() {
  const [favorites, setFavorites] = useState<BuyerFavorite[]>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<BuyerFavoriteSort>("latest");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const loadSequence = useRef(0);

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setIsLoading(true);
    setLoadError(false);
    try {
      const next = await fetchBuyerFavorites();
      if (sequence === loadSequence.current) setFavorites(next);
    } catch {
      if (sequence === loadSequence.current) setLoadError(true);
    } finally {
      if (sequence === loadSequence.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => { void load(); return () => { loadSequence.current += 1; }; }, [load]);
  const visibleFavorites = useMemo(() => selectBuyerFavorites(favorites, search, sort), [favorites, search, sort]);

  async function handleRemove(product: MarketplaceProduct) {
    setRemovingId(product.id);
    try {
      await removeBuyerFavorite(product.id);
      setFavorites((current) => current.filter((favorite) => favorite.product.id !== product.id));
    } catch {
      setLoadError(true);
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <section className="marketplace-results" aria-labelledby="favorite-products-heading">
      <div className="workspace-toolbar">
        <div><p className="eyebrow">Buyer workspace</p><h3 id="favorite-products-heading">Favorite Products</h3><p>Review products saved from the Marketplace.</p></div>
        <a className="button-link" href="/marketplace?view=browse">Marketplace</a>
      </div>
      {isLoading && <BuyerFavoritesLoadingState />}
      {!isLoading && loadError && <BuyerFavoritesErrorState onRetry={() => void load()} />}
      {!isLoading && !loadError && favorites.length === 0 && <BuyerFavoritesEmptyState />}
      {!isLoading && !loadError && favorites.length > 0 && <>
        <div className="queue-controls" aria-label="Favorite product controls">
          <label>Search favorites<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Product, model, or manufacturer" /></label>
          <label>Sort favorites<select value={sort} onChange={(event) => setSort(event.target.value as BuyerFavoriteSort)}>{Object.entries(buyerFavoriteSortLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        {visibleFavorites.length === 0 ? <div className="marketplace-state panel" role="status"><h3>No favorites match your search</h3><button type="button" onClick={() => setSearch("")}>Clear search</button></div> : <div className="product-grid" aria-live="polite">{visibleFavorites.map((favorite) => <BuyerFavoriteProductCard key={favorite.product.id} favorite={favorite} removing={removingId === favorite.product.id} onRemove={(product) => void handleRemove(product)} />)}</div>}
      </>}
    </section>
  );
}

function formatFavoriteDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}
