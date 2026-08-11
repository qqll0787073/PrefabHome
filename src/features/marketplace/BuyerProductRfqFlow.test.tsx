import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { MarketplaceProduct } from "../../types";
import { MarketplaceProductDetail } from "./MarketplaceProductDetail";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const product = {
  id: "11111111-1111-4111-8111-111111111111",
  manufacturer_id: "22222222-2222-4222-8222-222222222222",
  manufacturer_display_name: "Approved Homes",
  manufacturer_country: "China",
  name: "Published Home",
  model_name: "PH-20",
  slug: "ph-20",
  category: "Modular home",
  short_description: "Published summary",
  description: "Published description",
  tags: [], intended_uses: [], certifications: [], target_markets: [],
  currency: "USD", fob_price: null, price_unit: null, minimum_order_quantity: 1,
  floor_area_sq_ft: null, bedrooms: null, bathrooms: null, stories: null,
  length_ft: null, width_ft: null, height_ft: null, structure_material: null,
  exterior_finish: null, roof_type: null, insulation: null, electrical_standard: null,
  plumbing_standard: null, wind_rating: null, snow_load_psf: null,
  production_lead_time_weeks: null, port_of_loading: null, hs_code: null,
  published_at: "2026-08-01T00:00:00Z", search_text: null, primary_image: null, image_url: null,
} satisfies MarketplaceProduct;

const pageSource = readFileSync(new URL("./MarketplacePage.tsx", import.meta.url), "utf8");
const detailSource = readFileSync(new URL("./MarketplaceProductDetail.tsx", import.meta.url), "utf8");
const dialogSource = readFileSync(new URL("../rfqs/RFQRequestDialog.tsx", import.meta.url), "utf8");
const rfqSource = readFileSync(new URL("../../lib/rfq.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../../supabase/migrations/0029_require_active_buyer_for_rfq_drafts.sql", import.meta.url), "utf8");

test("published Product Detail renders safe Marketplace fields, accessible CTA, and directory context", () => {
  const markup = renderToStaticMarkup(createElement(MarketplaceProductDetail, { product, user: null, onBack: () => {} }));
  assert.match(markup, /<h2>PH-20<\/h2>/);
  assert.match(markup, /Published description/);
  assert.match(markup, /Request Quote/);
  assert.match(markup, /workspace=manufacturers&amp;record=22222222/);
  assert.doesNotMatch(markup, /owner_id|email|phone|review_notes|dangerouslySetInnerHTML/);
});

test("direct product route has accessible loading and sanitized unavailable states with stale-response containment", () => {
  assert.match(pageSource, /detailStatus === "loading"[\s\S]*aria-busy="true"/);
  assert.match(pageSource, /Product not available/);
  assert.match(pageSource, /not published or is no longer available/);
  assert.match(pageSource, /generation !== detailGeneration\.current/);
  assert.match(pageSource, /popstate/);
});

test("logged-out Request Quote enters the existing Buyer auth gate", () => {
  assert.match(detailSource, /if \(!user\)[\s\S]*view=dashboard&workspace=rfqs/);
});

test("RFQ dialog fails closed for non-Buyers and announces pending and error states", () => {
  assert.match(dialogSource, /user && user\.role === "buyer"/);
  assert.match(dialogSource, /disabled=\{!canRequest \|\| isSaving\}/);
  assert.match(dialogSource, /ErrorList errors=\{errors\}/);
  assert.match(dialogSource, /Saving\.\.\./);
});

test("RFQ creation contains duplicate clicks, logout, identity switches, stale success, and unmount", () => {
  assert.match(dialogSource, /savingRef\.current/);
  assert.match(dialogSource, /requestGeneration\.current/);
  assert.match(dialogSource, /\[product\.id, user\?\.id\]/);
  assert.match(dialogSource, /generation !== requestGeneration\.current/);
  assert.match(dialogSource, /buyerRFQHref\(saved\.id\)/);
});

test("client sends only product selector and supported RFQ values through trusted RPC", () => {
  const create = rfqSource.match(/export async function createDraftRFQ[\s\S]+?\n}/)?.[0] ?? "";
  assert.match(create, /rpc\("create_rfq_draft"/);
  assert.match(create, /product_uuid: product\.id/);
  assert.doesNotMatch(create, /buyer_id|manufacturer_id|status/);
  assert.doesNotMatch(rfqSource, /\.from\("rfqs"\)\s*\.insert/);
});

test("database derives active Buyer and published Product/Manufacturer authority", () => {
  const create = migration.match(/create or replace function public\.create_rfq_draft[\s\S]+?\n\$\$;/)?.[0] ?? "";
  assert.match(create, /auth\.uid\(\)/);
  assert.match(create, /p\.role = 'buyer'/);
  assert.match(create, /p\.status = 'active'/);
  assert.match(create, /p\.status = 'published'/);
  assert.match(create, /m\.application_status = 'approved'/);
  assert.match(create, /p\.manufacturer_id into manufacturer_uuid/);
  assert.match(create, /status[\s\S]*'draft'/);
});

test("Marketplace source remains the only Product Detail data projection", () => {
  assert.match(pageSource, /fetchMarketplaceProductBySlug/);
  assert.doesNotMatch(pageSource + detailSource, /\.from\("products"\)|\.from\("manufacturers"\)|\.from\("profiles"\)/);
  assert.doesNotMatch(detailSource, /dangerouslySetInnerHTML/);
});
