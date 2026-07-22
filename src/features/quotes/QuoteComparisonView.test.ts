import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QuoteComparisonView } from "./QuoteComparisonView";
import type { RFQQuoteWithItems, RFQWithDetails } from "../../types";

const rfq = {
  id: "rfq-1", buyer_id: "buyer-1", manufacturer_id: "manufacturer-1", product_id: "product-1",
  product_snapshot: { model_name: "Model A", manufacturer_display_name: "Public Homes" }, status: "quoted",
  requested_quantity: 1, requested_currency: "USD", incoterm: null, destination_country: "Canada",
  destination_port: null, target_delivery_date: null, buyer_message: null,
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
  manufacturer: { id: "manufacturer-1", company_name: "Private Legal Name", company_display_name: "Private Join", country: "CA" },
} satisfies RFQWithDetails;

const quote = {
  id: "quote-1", rfq_id: "rfq-1", manufacturer_id: "manufacturer-1", version: 1, status: "submitted",
  currency: "USD", unit_price: null, quantity: null, subtotal: 100, incoterm: "FOB", origin_port: null,
  destination_port: null, production_lead_days: 30, shipping_lead_days: null, valid_until: null,
  manufacturer_note: "Commercial note", created_by: "owner-1", submitted_at: "2026-01-02T00:00:00Z",
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-02T00:00:00Z", items: [],
} satisfies RFQQuoteWithItems;

test("renders a semantic participant-safe comparison without private manufacturer fields", () => {
  const html = renderToStaticMarkup(React.createElement(QuoteComparisonView, { rfq, quotes: [quote] }));
  assert.match(html, /<table>/);
  assert.match(html, /<caption>Commercial quote versions/);
  assert.match(html, /Public Homes/);
  assert.match(html, /No exchange-rate conversion/);
  assert.match(html, /No dedicated shipping scope/);
  assert.doesNotMatch(html, /Private Legal Name|Private Join/);
  assert.doesNotMatch(html, /Accept|order|payment/i);
});
