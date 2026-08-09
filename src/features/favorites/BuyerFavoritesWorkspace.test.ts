import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { MarketplaceProduct } from "../../types";
import type { BuyerFavorite } from "../../lib/buyerFavorites";
import {
  BuyerFavoriteProductCard,
  BuyerFavoritesEmptyState,
  BuyerFavoritesErrorState,
  BuyerFavoritesLoadingState,
  BuyerFavoritesWorkspace,
} from "./BuyerFavoritesWorkspace";

const product = { id: "product-1", slug: "sample-home", name: "Sample Home", model_name: "Model S", manufacturer_display_name: "Sample Manufacturer", manufacturer_country: "China", category: "modular-home", image_url: null, primary_image: null } as MarketplaceProduct;
const favorite: BuyerFavorite = { product, favoritedAt: "2026-08-08T00:00:00Z" };

test("loading empty and error states are accessible and include recovery paths", () => {
  const loading = renderToStaticMarkup(createElement(BuyerFavoritesLoadingState));
  assert.match(loading, /role="status"/);
  assert.match(loading, /aria-busy="true"/);
  const empty = renderToStaticMarkup(createElement(BuyerFavoritesEmptyState));
  assert.match(empty, /No favorite products yet/);
  assert.match(empty, /href="\/marketplace\?view=browse"/);
  const error = renderToStaticMarkup(createElement(BuyerFavoritesErrorState, { onRetry: () => {} }));
  assert.match(error, /role="alert"/);
  assert.match(error, />Retry</);
  assert.doesNotMatch(error, /sql|jwt|supabase|policy|endpoint/i);
});

test("favorite card renders Marketplace fields canonical link and removal control", () => {
  const markup = renderToStaticMarkup(createElement(BuyerFavoriteProductCard, { favorite, removing: false, onRemove: () => {} }));
  assert.match(markup, /Model S/);
  assert.match(markup, /Sample Manufacturer/);
  assert.match(markup, /modular-home/);
  assert.match(markup, /China/);
  assert.match(markup, /Favorited:/);
  assert.match(markup, /href="\/products\/sample-home"/);
  assert.match(markup, /aria-label="View Model S in Marketplace"/);
  assert.match(markup, /aria-label="Remove Model S from favorites"/);
});

test("native product links preserve modified-click behavior", () => {
  const markup = renderToStaticMarkup(createElement(BuyerFavoriteProductCard, { favorite, removing: false, onRemove: () => {} }));
  assert.match(markup, /<a class="button-link" href="\/products\/sample-home"/);
  assert.doesNotMatch(markup, /target="_blank"|download=|onclick=/i);
});

test("workspace starts with accessible loading and reuses responsive product grid", () => {
  const markup = renderToStaticMarkup(createElement(BuyerFavoritesWorkspace));
  assert.match(markup, /aria-labelledby="favorite-products-heading"/);
  assert.match(markup, /Favorite Products/);
  assert.match(markup, /Loading your favorite products/);
  const styles = readFileSync(new URL("../../styles.css", import.meta.url), "utf8");
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*?\.product-grid\s*\{\s*grid-template-columns: 1fr;/);
});

test("removal service derives Buyer authority and scopes the delete by Buyer and product", () => {
  const source = readFileSync(new URL("../../lib/buyerFavorites.ts", import.meta.url), "utf8");
  assert.match(source, /supabase\.auth\.getUser\(\)/);
  assert.match(source, /profile\.role !== "buyer" \|\| profile\.status !== "active"/);
  assert.match(source, /\.from\("saved_products"\)[\s\S]*?\.delete\(\)[\s\S]*?\.eq\("buyer_id", buyerId\)[\s\S]*?\.eq\("product_id", productId\)/);
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
});
