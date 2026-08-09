import type { MarketplaceProduct } from "../../types";
import { MarketplaceProductCard } from "./MarketplaceProductCard";

interface MarketplaceProductGridProps {
  products: MarketplaceProduct[];
  onSelectProduct: (product: MarketplaceProduct) => void;
  favoriteEligible: boolean;
  favoriteIds: ReadonlySet<string>;
  pendingFavoriteId: string | null;
  onAddFavorite: (product: MarketplaceProduct) => void;
}

export function MarketplaceProductGrid({
  products,
  onSelectProduct,
  favoriteEligible,
  favoriteIds,
  pendingFavoriteId,
  onAddFavorite,
}: MarketplaceProductGridProps) {
  return (
    <div className="product-grid">
      {products.map((product, index) => (
        <MarketplaceProductCard
          key={product.id}
          product={product}
          priority={index === 0}
          onSelect={onSelectProduct}
          favoriteEligible={favoriteEligible}
          favoriteSaved={favoriteIds.has(product.id)}
          favoritePending={pendingFavoriteId === product.id}
          onAddFavorite={onAddFavorite}
        />
      ))}
    </div>
  );
}
