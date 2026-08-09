import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import type { MarketplaceProduct } from "../types";
import {
  favoriteProductHref,
  addBuyerFavorite,
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

test("add derives Buyer identity and inserts only authenticated buyer and selected product IDs", async () => {
  const { client, inserted } = fakeFavoritesClient();
  await addBuyerFavorite("11111111-1111-4111-8111-111111111111", client);
  assert.deepEqual(inserted, [{ buyer_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", product_id: "11111111-1111-4111-8111-111111111111" }]);
});

test("add requires an active Buyer and rejects other roles without inserting", async () => {
  for (const profile of [{ role: "manufacturer", status: "active" }, { role: "admin", status: "active" }, { role: "buyer", status: "suspended" }]) {
    const { client, inserted } = fakeFavoritesClient({ profile });
    await assert.rejects(() => addBuyerFavorite("11111111-1111-4111-8111-111111111111", client), /could not be added/);
    assert.deepEqual(inserted, []);
  }
});

test("duplicate add is idempotent across an insert race", async () => {
  const raced = fakeFavoritesClient({ duplicateOnInsert: true });
  await addBuyerFavorite("11111111-1111-4111-8111-111111111111", raced.client);
  assert.equal(raced.inserted.length, 1);
});

test("add rejects malformed or unpublished product IDs and never leaks database errors", async () => {
  const malformed = fakeFavoritesClient();
  await assert.rejects(() => addBuyerFavorite("not-a-product", malformed.client), /could not be added/);
  assert.deepEqual(malformed.inserted, []);
  const unpublished = fakeFavoritesClient({ published: false });
  await assert.rejects(() => addBuyerFavorite("11111111-1111-4111-8111-111111111111", unpublished.client), /could not be added/);
  const failed = fakeFavoritesClient({ insertError: { code: "42501", message: "raw policy SQL detail" } });
  await assert.rejects(() => addBuyerFavorite("11111111-1111-4111-8111-111111111111", failed.client), (error: Error) => {
    assert.doesNotMatch(error.message, /policy|sql|supabase|constraint|jwt/i);
    return true;
  });
});

test("Marketplace favorite state is batch-loaded once and never queried per card", () => {
  const source = readFileSync(new URL("../features/marketplace/MarketplacePage.tsx", import.meta.url), "utf8");
  assert.equal(source.match(/fetchBuyerFavoriteProductIds\(\)/g)?.length, 1);
  assert.doesNotMatch(source, /products\.map[\s\S]{0,300}fetchBuyerFavoriteProductIds/);
  assert.match(source, /favoriteIds=\{favoriteIds\}/);
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

function fakeFavoritesClient(options: { profile?: { role: string; status: string }; published?: boolean; duplicateOnInsert?: boolean; insertError?: { code: string; message: string } } = {}) {
  const inserted: Array<Record<string, string>> = [];
  const buyerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const profile = { id: buyerId, role: "buyer", status: "active", ...options.profile };
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: buyerId } }, error: null }) },
    from(table: string) {
      const filters: Record<string, string> = {};
      const builder = {
        select() { return builder; },
        eq(column: string, value: string) { filters[column] = value; return builder; },
        async maybeSingle() {
          if (table === "profiles") return { data: profile, error: null };
          if (table === "marketplace_products") return { data: options.published === false ? null : { id: filters.id }, error: null };
          return { data: null, error: null };
        },
        async insert(payload: Record<string, string>) {
          inserted.push(payload);
          return { error: options.duplicateOnInsert ? { code: "23505", message: "duplicate key" } : options.insertError ?? null };
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;
  return { client, inserted };
}
