import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateTotalPages,
  defaultMarketplaceFilters,
  fetchMarketplaceProducts,
  isMarketplaceDemoModeEnabled,
  mapMarketplaceProduct,
  marketplaceFilterPayload,
  marketplaceFiltersKey,
  marketplaceProductSlug,
  marketplaceSortOrder,
  paginationRange,
  resolveMarketplaceImageUrls,
  sanitizeMarketplacePageSize,
} from "./marketplace";

const marketplaceRow = {
  id: "product-1",
  manufacturer_id: "manufacturer-1",
  manufacturer_display_name: "Public Factory",
  manufacturer_country: "China",
  name: "Prefab ADU",
  model_name: "ADU-20",
  slug: "adu-20",
  category: "ADU",
  short_description: "Compact published home",
  description: "A public-safe product description.",
  tags: ["folding", "adu"],
  intended_uses: ["backyard"],
  floor_area_sq_ft: 320,
  bedrooms: 1,
  bathrooms: 1,
  stories: 1,
  length_ft: 20,
  width_ft: 16,
  height_ft: 10,
  structure_material: "Steel",
  exterior_finish: "Composite",
  roof_type: "Flat",
  insulation: "Panel",
  electrical_standard: "US-ready",
  plumbing_standard: "UPC planning",
  wind_rating: "120 mph",
  snow_load_psf: 30,
  currency: "USD",
  fob_price: 28500,
  price_unit: "unit",
  minimum_order_quantity: 1,
  production_lead_time_weeks: 7,
  port_of_loading: "Shenzhen",
  hs_code: "9406",
  certifications: ["CE"],
  target_markets: ["United States"],
  published_at: "2026-07-01T00:00:00Z",
  search_text: "Prefab ADU ADU-20 ADU Compact published home folding adu",
  primary_media_id: "media-1",
  primary_media_type: "exterior_image",
  primary_storage_bucket: "product-images",
  primary_storage_path: "manufacturer-1/product-1/image.png",
  primary_original_filename: "image.png",
  primary_mime_type: "image/png",
  primary_title: "Exterior",
  primary_alt_text: "Exterior view",
  primary_sort_order: 0,
  primary_is_primary: true,
};

describe("marketplace helpers", () => {
  it("maps public product and manufacturer fields without internal fields", () => {
    const product = mapMarketplaceProduct(marketplaceRow);

    assert.equal(product.manufacturer_display_name, "Public Factory");
    assert.equal(product.manufacturer_country, "China");
    assert.equal(product.primary_image?.storage_bucket, "product-images");
    assert.equal("notes" in product, false);
    assert.equal("review_notes" in product, false);
    assert.equal("owner_id" in product, false);
    assert.equal("email" in product, false);
    assert.equal("phone" in product, false);
    assert.equal("manufacturer_province" in product, false);
    assert.equal("manufacturer_city" in product, false);
    assert.equal("manufacturer_website" in product, false);
  });

  it("builds search and filter payloads with numeric parsing", () => {
    const payload = marketplaceFilterPayload({
      ...defaultMarketplaceFilters,
      search: "  adu, compact  ",
      category: "ADU",
      minBedrooms: "2",
      minBathrooms: "1.5",
      minFloorArea: "300",
      maxFloorArea: "800",
      minPrice: "20000",
      maxPrice: "75000",
      targetMarket: "United States",
      certification: "CE",
    });

    assert.equal(payload.search, "adu, compact");
    assert.equal(payload.category, "ADU");
    assert.equal(payload.minBedrooms, 2);
    assert.equal(payload.minBathrooms, 1.5);
    assert.equal(payload.minFloorArea, 300);
    assert.equal(payload.maxFloorArea, 800);
    assert.equal(payload.minPrice, 20000);
    assert.equal(payload.maxPrice, 75000);
    assert.equal(payload.targetMarket, "United States");
    assert.equal(payload.certification, "CE");
  });

  it("maps searchable tag text through the public product projection", () => {
    const product = mapMarketplaceProduct(marketplaceRow);
    assert.ok(product.search_text?.includes("folding"));
  });

  it("maps sorting options to safe database columns", () => {
    assert.deepEqual(marketplaceSortOrder("newest"), {
      column: "published_at",
      ascending: false,
      nullsFirst: false,
    });
    assert.deepEqual(marketplaceSortOrder("price_asc"), {
      column: "fob_price",
      ascending: true,
      nullsFirst: false,
    });
    assert.deepEqual(marketplaceSortOrder("area_desc"), {
      column: "floor_area_sq_ft",
      ascending: false,
      nullsFirst: false,
    });
  });

  it("calculates pagination ranges and page counts", () => {
    assert.deepEqual(paginationRange(2, 12), { from: 12, to: 23 });
    assert.equal(sanitizeMarketplacePageSize(500), 24);
    assert.equal(sanitizeMarketplacePageSize(0), 12);
    assert.equal(calculateTotalPages(0, 12), 1);
    assert.equal(calculateTotalPages(25, 12), 3);
  });

  it("changes filter keys so the UI can reset page on filter changes", () => {
    const first = marketplaceFiltersKey(defaultMarketplaceFilters);
    const second = marketplaceFiltersKey({ ...defaultMarketplaceFilters, category: "ADU" });
    assert.notEqual(first, second);
  });

  it("selects stable product detail slugs", () => {
    const product = mapMarketplaceProduct(marketplaceRow);
    assert.equal(marketplaceProductSlug(product), "adu-20");
    assert.equal(marketplaceProductSlug({ id: "fallback-id", slug: null }), "fallback-id");
  });

  it("falls back when signed image URLs cannot be resolved", async () => {
    const [image] = await resolveMarketplaceImageUrls([
      {
        id: "media-document",
        product_id: "product-1",
        media_type: "exterior_image",
        storage_bucket: "product-documents",
        storage_path: "manufacturer-1/product-1/document.pdf",
        original_filename: "document.pdf",
        mime_type: "application/pdf",
        title: null,
        alt_text: null,
        sort_order: 0,
        is_primary: false,
        signed_url: null,
      },
    ]);

    assert.equal(image.signed_url, null);
  });

  it("does not return demo products when Supabase configuration is missing by default", async () => {
    const previous = process.env.VITE_ENABLE_MARKETPLACE_DEMO;
    try {
      delete process.env.VITE_ENABLE_MARKETPLACE_DEMO;
      await assert.rejects(
        () => fetchMarketplaceProducts({}, { page: 1, pageSize: 12 }, "newest"),
        /Marketplace Supabase configuration is missing/
      );
    } finally {
      restoreDemoEnv(previous);
    }
  });

  it("parses explicit marketplace demo mode as local-only opt-in", () => {
    assert.equal(isMarketplaceDemoModeEnabled({ VITE_ENABLE_MARKETPLACE_DEMO: "true" }), true);
    assert.equal(isMarketplaceDemoModeEnabled({ VITE_ENABLE_MARKETPLACE_DEMO: "false" }), false);
    assert.equal(isMarketplaceDemoModeEnabled({}), false);
  });

  it("uses demo marketplace data only when the explicit demo flag is enabled", async () => {
    const previous = process.env.VITE_ENABLE_MARKETPLACE_DEMO;
    let result;
    try {
      process.env.VITE_ENABLE_MARKETPLACE_DEMO = "true";
      result = await fetchMarketplaceProducts(
        { ...defaultMarketplaceFilters, search: "container" },
        { page: 1, pageSize: 12 },
        "newest"
      );
    } finally {
      restoreDemoEnv(previous);
    }

    assert.equal(result.page, 1);
    assert.ok(result.total >= 1);
    assert.ok(result.products.every((product) => product.image_url));
  });

  it("keeps demo products clearly identifiable as demo data", async () => {
    const previous = process.env.VITE_ENABLE_MARKETPLACE_DEMO;
    let result;
    try {
      process.env.VITE_ENABLE_MARKETPLACE_DEMO = "true";
      result = await fetchMarketplaceProducts({}, { page: 1, pageSize: 12 }, "newest");
    } finally {
      restoreDemoEnv(previous);
    }

    assert.ok(result.products.every((product) => product.manufacturer_id.startsWith("demo-")));
  });
});

function restoreDemoEnv(value: string | undefined) {
  if (value === undefined) {
    delete process.env.VITE_ENABLE_MARKETPLACE_DEMO;
  } else {
    process.env.VITE_ENABLE_MARKETPLACE_DEMO = value;
  }
}
