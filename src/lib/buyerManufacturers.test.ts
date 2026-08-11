import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchBuyerManufacturers, manufacturerLocation, safeWebsite, selectBuyerManufacturers, type BuyerManufacturer } from "./buyerManufacturers";

const records: BuyerManufacturer[] = [
  { id: "b", displayName: "Zen Homes", description: "Steel modular", website: null, city: "Suzhou", region: "Jiangsu", country: "China", certifications: ["CE"], publishedProductCount: 3 },
  { id: "a", displayName: "Acme Prefab", description: null, website: null, city: null, region: null, country: "Canada", certifications: [], publishedProductCount: 0 },
  { id: "c", displayName: "Null Stable", description: null, website: null, city: null, region: null, country: null, certifications: [], publishedProductCount: 0 },
];

test("search is trimmed, case-insensitive, and covers safe name/location/certification fields", () => {
  assert.deepEqual(selectBuyerManufacturers(records, "  sUzHoU ", "", "name").map((x) => x.id), ["b"]);
  assert.deepEqual(selectBuyerManufacturers(records, "ce", "", "name").map((x) => x.id), ["b"]);
});
test("country filter and deterministic sorts tolerate null data", () => {
  assert.deepEqual(selectBuyerManufacturers(records, "", "Canada", "name").map((x) => x.id), ["a"]);
  assert.deepEqual(selectBuyerManufacturers(records, "", "", "products").map((x) => x.id), ["b", "a", "c"]);
  assert.equal(manufacturerLocation(records[2]), "Location not listed");
});

test("website links allow only normalized HTTP(S)", () => {
  assert.equal(safeWebsite("example.com")?.startsWith("https://example.com"), true);
  assert.equal(safeWebsite("javascript:alert(1)"), null);
  assert.equal(safeWebsite("data:text/html,bad"), null);
});

test("service requests only the approved safe projection and maps malformed counts", async () => {
  let projection = "";
  const query: any = { order: () => query, then: (resolve: (value: unknown) => void) => resolve({ data: [{ id: "a", display_name: "Acme", description: null, website: null, city: null, region: null, country: null, certifications: null, published_product_count: null }], error: null }) };
  const client = { from(table: string) { assert.equal(table, "buyer_manufacturer_directory"); return { select(value: string) { projection = value; return query; } }; } } as unknown as SupabaseClient;
  const result = await fetchBuyerManufacturers(client);
  assert.doesNotMatch(projection, /\*|email|phone|owner|status|review|address/i);
  assert.equal(result[0].publishedProductCount, 0);
  assert.deepEqual(result[0].certifications, []);
});
