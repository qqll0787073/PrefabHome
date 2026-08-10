import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import type { MarketplaceProduct } from "../../types";
import React from "react";
import { MarketplaceProductCard } from "./MarketplaceProductCard";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const product = { id: "11111111-1111-4111-8111-111111111111", name: "Sample Home", model_name: "Model S", category: "modular-home", short_description: null, description: null, manufacturer_display_name: "Sample Manufacturer", manufacturer_country: "China", image_url: null, primary_image: null, fob_price: null, currency: "USD", floor_area_sq_ft: null, production_lead_time_weeks: null, bedrooms: null, bathrooms: null, tags: [] } as MarketplaceProduct;

test("logged-out and non-Buyer callers receive no Favorite authority control", () => {
  assert.doesNotMatch(renderCard(false, false, false), /Add Favorite/);
});

test("eligible Buyer receives an accessible Add Favorite button", () => {
  const markup = renderCard(true, false, false);
  assert.match(markup, /type="button"/);
  assert.match(markup, /aria-label="Add Model S to favorites"/);
  assert.match(markup, />Add Favorite</);
  assert.doesNotMatch(markup, /disabled/);
});

test("Marketplace product card exposes the Buyer Favorite action", () => {
  const source = readFileSync(new URL("./MarketplaceProductCard.tsx", import.meta.url), "utf8");
  assert.match(source, /favoriteEligible && <button/);
});

test("saved and pending states disable duplicate action with textual state", () => {
  const saved = renderCard(true, true, false);
  assert.match(saved, /disabled/);
  assert.match(saved, /aria-label="Model S is saved to favorites"/);
  assert.match(saved, />Saved</);
  const pending = renderCard(true, false, true);
  assert.match(pending, /disabled/);
  assert.match(pending, />Saving\.\.\.</);
});

test("Marketplace state flow rolls back pending state on failure and guards stale responses", () => {
  const source = readFile();
  assert.match(source, /catch[\s\S]*setFavoriteError/);
  assert.match(source, /finally[\s\S]*setPendingFavoriteId\(null\)/);
  assert.match(source, /generation !== favoriteGeneration\.current/);
});

function readFile(): string {
  return readFileSync(new URL("./MarketplacePage.tsx", import.meta.url), "utf8");
}

function renderCard(eligible: boolean, saved: boolean, pending: boolean): string {
  return renderToStaticMarkup(createElement(MarketplaceProductCard, { product, onSelect: () => {}, favoriteEligible: eligible, favoriteSaved: saved, favoritePending: pending, onAddFavorite: () => {} }));
}
