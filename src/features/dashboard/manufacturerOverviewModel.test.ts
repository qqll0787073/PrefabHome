import assert from "node:assert/strict";
import test from "node:test";
import type { RFQStatus, RFQWithDetails } from "../../types";
import { manufacturerOverviewMetrics, recentManufacturerRFQs } from "./manufacturerOverviewModel";

function rfq(id: string, status: RFQStatus, updatedAt: string): RFQWithDetails {
  return { id, status, updated_at: updatedAt } as RFQWithDetails;
}

test("Manufacturer overview metrics reflect backend RFQ and Quote lifecycle states", () => {
  const items = [rfq("1", "submitted", "2026-01-01"), rfq("2", "manufacturer_review", "2026-01-02"), rfq("3", "quoted", "2026-01-03"), rfq("4", "buyer_review", "2026-01-04"), rfq("5", "revision_requested", "2026-01-05"), rfq("6", "accepted", "2026-01-06")];
  assert.deepEqual(manufacturerOverviewMetrics(items), { newRequests: 1, preparingQuotes: 1, buyerReview: 2, revisionsRequested: 1 });
});

test("Manufacturer overview selects recent assigned RFQs without mutating input", () => {
  const items = [rfq("1", "submitted", "2026-01-01"), rfq("2", "quoted", "2026-01-03"), rfq("3", "manufacturer_review", "2026-01-02")];
  assert.deepEqual(recentManufacturerRFQs(items, 2).map((item) => item.id), ["2", "3"]);
  assert.deepEqual(items.map((item) => item.id), ["1", "2", "3"]);
});
