import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const overview = readFileSync("src/features/dashboard/BuyerOverview.tsx", "utf8");
const orders = readFileSync("src/features/purchase-orders/BuyerPurchaseOrders.tsx", "utf8");
const contracts = readFileSync("src/features/contracts/BuyerContracts.tsx", "utf8");
const invoices = readFileSync("src/features/invoices/BuyerInvoices.tsx", "utf8");
const shipping = readFileSync("src/features/shipping-readiness/BuyerShippingReadiness.tsx", "utf8");

test("Buyer Dashboard uses existing authorized services in parallel and routes every actionable card", () => {
  for (const service of ["fetchBuyerQuotes", "fetchBuyerPurchaseOrders", "fetchBuyerContracts", "fetchBuyerInvoices", "fetchBuyerShippingReadiness"]) assert.match(overview, new RegExp(`${service}\\(\\)`));
  assert.match(overview, /Promise\.allSettled/);
  for (const workspace of ["quotes", "orders", "contracts", "invoices", "shipping"]) assert.match(overview, new RegExp(`workspace=\\$\\{workspace\\}`));
  assert.match(overview, /state === "loading"[\s\S]+Loading your/);
});

test("Purchase Order links only resolved related records and preserves lifecycle services", () => {
  assert.match(orders, /relatedContract &&[\s\S]+workspace=contracts&record=/);
  assert.match(orders, /relatedInvoice &&[\s\S]+workspace=invoices&record=/);
  assert.match(orders, /relatedShipping &&[\s\S]+workspace=shipping&record=/);
  assert.doesNotMatch(orders, /from "\.\.\/\.\.\/lib\/supabase"|\.from\(/i);
  assert.match(orders, /canCreatePurchaseOrderForQuote/);
});

test("Contract Invoice and Shipping provide reciprocal authorized context links", () => {
  assert.match(contracts, /workspace=orders&record=/);
  assert.match(invoices, /workspace=orders&record=[\s\S]+workspace=contracts&record=/);
  assert.match(shipping, /workspace=orders&record=[\s\S]+workspace=contracts&record=[\s\S]+workspace=invoices&record=[\s\S]+workspace=logistics/);
  for (const source of [contracts, invoices, shipping]) assert.doesNotMatch(source, /buyer_id|manufacturer_id|service_role/);
});
