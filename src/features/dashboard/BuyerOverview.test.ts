import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BuyerOverview } from "./BuyerOverview";

const user = { id: "private-id", email: "buyer@example.test", fullName: "Avery Buyer", role: "buyer" as const };

test("renders an accessible stable Buyer loading state without private identity fields", () => {
  const markup = renderToStaticMarkup(createElement(BuyerOverview, { user, loadRFQs: async () => [] }));
  assert.match(markup, /aria-busy="true"/);
  assert.match(markup, /Welcome, Avery Buyer/);
  assert.match(markup, /Loading your RFQ activity/);
  assert.doesNotMatch(markup, /private-id|buyer@example\.test/);
});

test("Buyer quick actions and RFQ routes are canonical links", () => {
  const markup = renderToStaticMarkup(createElement(BuyerOverview, { user, loadRFQs: async () => [] }));
  assert.equal(typeof BuyerOverview, "function");
  assert.doesNotMatch(markup, /<table|role="button"/);
  assert.match(BuyerOverview.toString(), /workspace=rfqs/);
  assert.match(BuyerOverview.toString(), /Browse Marketplace/);
  assert.doesNotMatch(BuyerOverview.toString(), /user\.id|buyer_id.*user/);
});

test("Manufacturer variant reuses the overview with authorized RFQ and Quote routes", () => {
  const manufacturer = { ...user, role: "manufacturer" as const };
  const markup = renderToStaticMarkup(createElement(BuyerOverview, { user: manufacturer, variant: "manufacturer", loadRFQs: async () => [] }));
  assert.match(markup, /Manufacturer overview/);
  assert.match(BuyerOverview.toString(), /workspace=quotes/);
  assert.doesNotMatch(BuyerOverview.toString(), /manufacturer_id|owner_id/);
});
