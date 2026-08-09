import type { MarketplaceProduct } from "../../types";
import { MarketplaceProductCard } from "./MarketplaceProductCard";

interface MarketplaceProductGridProps {
  products: MarketplaceProduct[];
  onSelectProduct: (product: MarketplaceProduct) => void;
  favoriteEligible: boolean;
  favoriteIds: ReadonlySet<string>;
  pendingFavoriteIds: ReadonlySet<string>;
  onAddFavorite: (product: MarketplaceProduct) => void;
}

export function MarketplaceProductGrid({
  products,
  onSelectProduct,
  favoriteEligible,
  favoriteIds,
  pendingFavoriteIds,
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
          favoritePending={pendingFavoriteIds.has(product.id)}
          onAddFavorite={onAddFavorite}
        />
      ))}
    </div>
  );
}
