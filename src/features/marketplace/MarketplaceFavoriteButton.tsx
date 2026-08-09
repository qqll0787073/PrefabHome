import React from "react";
import type { MarketplaceProduct } from "../../types";

interface MarketplaceFavoriteButtonProps {
  product: MarketplaceProduct;
  eligible: boolean;
  saved: boolean;
  pending: boolean;
  onAdd: (product: MarketplaceProduct) => void;
}

export function MarketplaceFavoriteButton({ product, eligible, saved, pending, onAdd }: MarketplaceFavoriteButtonProps) {
  if (!eligible) return null;
  const title = product.model_name || product.name;
  return <button type="button" className="secondary" disabled={saved || pending} aria-label={saved ? `${title} is saved to favorites` : `Add ${title} to favorites`} onClick={() => onAdd(product)}>{pending ? "Saving..." : saved ? "Saved" : "Add Favorite"}</button>;
}
