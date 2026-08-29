import assert from "node:assert/strict";
import test from "node:test";
import { buyerJourneyMetrics, buyerOverviewMetrics, buyerRFQContext, buyerRFQTitle, recentBuyerRFQs } from "./buyerOverviewModel";
import type { ContractRecord, InvoiceRecord, PurchaseOrderWithItems, RFQQuoteWithItems, ShippingReadinessRecord } from "../../types";
import type { RFQStatus, RFQWithDetails } from "../../types";

function rfq(id: string, status: RFQStatus, updated: string): RFQWithDetails {
  return { id, status, updated_at: updated, created_at: updated, product_snapshot: { name: `Home ${id}` } } as RFQWithDetails;
}

test("computes Buyer metrics only from supplied RFQs", () => {
  const result = buyerOverviewMetrics([rfq("1", "draft", "2026-01-01"), rfq("2", "submitted", "2026-01-02"), rfq("3", "accepted", "2026-01-03")]);
  assert.deepEqual(result, { active: 1, drafts: 1, open: 1, total: 3 });
});

test("derives cross-domain Buyer attention metrics only from authoritative lifecycle records", () => {
  const metrics = buyerJourneyMetrics({
    quotes: [{ status: "submitted" }, { status: "accepted" }] as RFQQuoteWithItems[],
    orders: [{ status: "draft" }, { status: "confirmed" }, { status: "cancelled" }] as PurchaseOrderWithItems[],
    contracts: [{ status: "draft" }, { status: "revision_requested" }, { status: "accepted" }] as ContractRecord[],
    invoices: [{ status: "issued" }, { status: "draft" }] as InvoiceRecord[],
    shipping: [{ status: "shipping_draft" }, { status: "cancelled" }] as ShippingReadinessRecord[],
  });
  assert.deepEqual(metrics, { quotesAwaitingDecision: 1, activeOrders: 2, contractsNeedingAttention: 2, openInvoices: 1, shippingInProgress: 1 });
});

test("orders recent RFQs by latest update and applies the limit", () => {
  const rows = [rfq("old", "draft", "2026-01-01"), rfq("new", "quoted", "2026-03-01"), rfq("middle", "submitted", "2026-02-01")];
  assert.deepEqual(recentBuyerRFQs(rows, 2).map((item) => item.id), ["new", "middle"]);
  assert.deepEqual(rows.map((item) => item.id), ["old", "new", "middle"]);
});

test("uses authorized participant product fields and snapshot context", () => {
  const row = rfq("1", "draft", "2026-01-01");
  row.product = { id: "p", name: "Current home", model_name: null, category: "home" };
  row.product_snapshot.manufacturer_display_name = "Trusted Homes";
  assert.equal(buyerRFQTitle(row), "Current home");
  assert.equal(buyerRFQContext(row), "Trusted Homes");
});
