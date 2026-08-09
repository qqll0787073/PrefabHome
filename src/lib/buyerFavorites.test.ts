import assert from "node:assert/strict";
import test from "node:test";
import type { MarketplaceProduct } from "../types";
import {
  favoriteProductHref,
  filterBuyerFavorites,
  selectBuyerFavorites,
  sortBuyerFavorites,
  toBuyerFavoritesError,
  type BuyerFavorite,
  type BuyerFavoriteSort,
} from "./buyerFavorites";

function product(id: string, name: string, model: string | null, manufacturer: string, publishedAt: string | null): MarketplaceProduct {
  return { id, name, model_name: model, manufacturer_display_name: manufacturer, published_at: publishedAt, slug: `${name.toLowerCase().replaceAll(" ", "-")}-${id}`, manufacturer_id: `maker-${id}`, manufacturer_country: "China", category: "modular-home", short_description: null, description: null, tags: [], intended_uses: [], floor_area_sq_ft: null, bedrooms: null, bathrooms: null, stories: null, length_ft: null, width_ft: null, height_ft: null, structure_material: null, exterior_finish: null, roof_type: null, insulation: null, electrical_standard: null, plumbing_standard: null, wind_rating: null, snow_load_psf: null, currency: "USD", fob_price: null, price_unit: null, minimum_order_quantity: null, production_lead_time_weeks: null, port_of_loading: null, hs_code: null, certifications: [], target_markets: [], search_text: null, primary_image: null, image_url: null };
}

const favorites: BuyerFavorite[] = [
  { product: product("b", "Beta Home", "Model Two", "Zen Homes", "2026-02-01T00:00:00Z"), favoritedAt: "2026-03-01T00:00:00Z" },
  { product: product("a", "Alpha Home", "Model One", "Apex Homes", "2026-01-01T00:00:00Z"), favoritedAt: "2026-04-01T00:00:00Z" },
  { product: product("c", "Gamma Home", null, "Apex Homes", "invalid"), favoritedAt: "invalid" },
];

test("search is trimmed case-insensitive and limited to product model and manufacturer", () => {
  assert.deepEqual(filterBuyerFavorites(favorites, "  alpha HOME ").map((item) => item.product.id), ["a"]);
  assert.deepEqual(filterBuyerFavorites(favorites, "MODEL two").map((item) => item.product.id), ["b"]);
  assert.deepEqual(filterBuyerFavorites(favorites, " apex ").map((item) => item.product.id), ["a", "c"]);
  assert.equal(filterBuyerFavorites(favorites, "modular-home").length, 0);
});

test("all sorts are stable deterministic non-mutating and tolerate malformed dates", () => {
  const original = [...favorites];
  const expected: Record<BuyerFavoriteSort, string[]> = {
    latest: ["a", "b", "c"],
    newest_product: ["b", "a", "c"],
    manufacturer: ["a", "c", "b"],
    alphabetical: ["c", "a", "b"],
  };
  for (const sort of Object.keys(expected) as BuyerFavoriteSort[]) {
    assert.deepEqual(sortBuyerFavorites(favorites, sort).map((item) => item.product.id), expected[sort]);
  }
  assert.deepEqual(favorites, original);
  assert.deepEqual(selectBuyerFavorites(favorites, "apex", "alphabetical").map((item) => item.product.id), ["c", "a"]);
});

test("product detail links use the canonical Marketplace product route", () => {
  assert.equal(favoriteProductHref(favorites[0].product), "/products/beta-home-b");
  assert.equal(favoriteProductHref({ id: "fallback", slug: null }), "/products/fallback");
});

test("errors are sanitized", () => {
  assert.equal(toBuyerFavoritesError().message, "Your favorite products could not be loaded. Please try again.");
  assert.doesNotMatch(toBuyerFavoritesError().message, /sql|jwt|supabase|policy|endpoint/i);
});
