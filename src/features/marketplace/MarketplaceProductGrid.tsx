import type { MarketplaceProduct } from "../../types";
import { MarketplaceProductCard } from "./MarketplaceProductCard";

interface MarketplaceProductGridProps {
  products: MarketplaceProduct[];
  onSelectProduct: (product: MarketplaceProduct) => void;
}

export function MarketplaceProductGrid({
  products,
  onSelectProduct,
}: MarketplaceProductGridProps) {
  return (
    <div className="product-grid">
      {products.map((product) => (
        <MarketplaceProductCard
          key={product.id}
          product={product}
          onSelect={onSelectProduct}
        />
      ))}
    </div>
  );
}
