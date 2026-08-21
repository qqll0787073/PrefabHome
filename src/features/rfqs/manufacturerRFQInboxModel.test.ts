import assert from "node:assert/strict";
import test from "node:test";
import type { RFQStatus, RFQWithDetails } from "../../types";
import { isQuoteEditableByManufacturer } from "../../lib/quotes";
import { manufacturerRFQActionLabel, refreshOpenedManufacturerRFQ, selectManufacturerRFQs } from "./manufacturerRFQInboxModel";

function rfq(id: string, status: RFQStatus, model: string, country: string, quantity: number, createdAt: string, updatedAt: string): RFQWithDetails {
  return { id, status, product_snapshot: { model_name: model, category: "ADU" }, destination_country: country, destination_port: null, requested_quantity: quantity, created_at: createdAt, updated_at: updatedAt } as RFQWithDetails;
}

const items = [
  rfq("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "submitted", "Aspen", "Canada", 2, "2026-01-02", "2026-01-03"),
  rfq("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "revision_requested", "Birch", "United States", 8, "2026-01-01", "2026-01-04"),
  rfq("cccccccc-cccc-4ccc-8ccc-cccccccccccc", "accepted", "Cedar", "Mexico", 4, "2026-01-03", "2026-01-02"),
];

test("Manufacturer inbox composes safe search, lifecycle group filtering, and stable sorting", () => {
  assert.deepEqual(selectManufacturerRFQs(items, "all", "canada", "updated").map((item) => item.id), [items[0].id]);
  assert.deepEqual(selectManufacturerRFQs(items, "quoted", "revision", "updated").map((item) => item.id), [items[1].id]);
  assert.deepEqual(selectManufacturerRFQs(items, "all", "", "quantity").map((item) => item.id), [items[1].id, items[2].id, items[0].id]);
  assert.deepEqual(items.map((item) => item.id), ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "cccccccc-cccc-4ccc-8ccc-cccccccccccc"]);
});

test("Manufacturer inbox actions describe lifecycle constraints accurately", () => {
  assert.equal(manufacturerRFQActionLabel("submitted"), "Open and review");
  assert.equal(manufacturerRFQActionLabel("manufacturer_review"), "Continue Quote");
  assert.equal(manufacturerRFQActionLabel("revision_requested"), "Review revision request");
  assert.equal(manufacturerRFQActionLabel("buyer_review"), "View Quote history");
  assert.equal(manufacturerRFQActionLabel("accepted"), "View RFQ");
});

test("opening a submitted RFQ selects the refreshed Manufacturer-review record so a new draft stays editable", async () => {
  const submitted = rfq("dddddddd-dddd-4ddd-8ddd-dddddddddddd", "submitted", "Douglas", "Canada", 3, "2026-01-01", "2026-01-01");
  let backendStatus: RFQStatus = "submitted";
  const result = await refreshOpenedManufacturerRFQ(
    submitted.id,
    async (rfqId) => {
      assert.equal(rfqId, submitted.id);
      backendStatus = "manufacturer_review";
    },
    async () => [{ ...submitted, status: backendStatus }],
  );

  assert.equal(result.current?.status, "manufacturer_review");
  assert.equal(isQuoteEditableByManufacturer({ status: "draft" }, result.current?.status), true);
});
