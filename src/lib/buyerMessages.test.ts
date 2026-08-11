import assert from "node:assert/strict";
import test from "node:test";
import type { RFQMessageRecord, RFQWithDetails } from "../types";
import {
  buyerConversationHref, buyerConversationManufacturer, buyerConversationProductHref, fetchBuyerConversations,
  filterBuyerConversations, selectBuyerConversations, sortBuyerConversations,
  type BuyerConversation,
} from "./buyerMessages";

const rfq = (id: string, name: string, manufacturer = "Acme", updated = "2026-01-01T00:00:00Z") => ({ id, buyer_id: "buyer", manufacturer_id: "maker", product_id: "product", product_snapshot: { name, model_name: name, manufacturer_display_name: manufacturer }, status: "submitted", requested_quantity: 1, requested_currency: "USD", incoterm: null, destination_country: "US", destination_port: null, target_delivery_date: null, buyer_message: null, created_at: updated, updated_at: updated }) as RFQWithDetails;
const message = (id: string, rfqId: string, body: string, created: string) => ({ id, rfq_id: rfqId, sender_profile_id: "buyer", sender_role: "buyer", message: body, attachment_path: null, created_at: created }) as RFQMessageRecord;
const conversation = (record: RFQWithDetails, messages: RFQMessageRecord[] = []): BuyerConversation => ({ rfq: record, messages, latestMessage: messages.at(-1) ?? null });

test("canonical conversation href uses dashboard Messages and record", () => assert.equal(buyerConversationHref("11111111-1111-4111-8111-111111111111"), "/marketplace?view=dashboard&workspace=messages&record=11111111-1111-4111-8111-111111111111"));
test("manufacturer uses the authorized RFQ snapshot", () => assert.equal(buyerConversationManufacturer(conversation(rfq("a", "Home", " Maker "))), "Maker"));
test("missing manufacturer has a safe fallback", () => assert.equal(buyerConversationManufacturer(conversation(rfq("a", "Home", ""))), "Manufacturer not named"));
test("published product context uses its canonical slug", () => { const item = conversation({ ...rfq("a", "Home"), product: { id: "p", slug: "cedar-home", name: "Home", model_name: "Cedar", category: "home" } }); assert.equal(buyerConversationProductHref(item), "/products/cedar-home"); });
test("unavailable product context falls back to Marketplace", () => assert.equal(buyerConversationProductHref(conversation(rfq("a", "Home"))), "/marketplace?view=browse"));
test("empty search returns a new collection", () => { const input = [conversation(rfq("a", "Home"))]; const result = filterBuyerConversations(input, "  "); assert.deepEqual(result, input); assert.notEqual(result, input); });
test("search is trimmed and case insensitive for product", () => assert.equal(filterBuyerConversations([conversation(rfq("a", "Alpine Home"))], " alpine ").length, 1));
test("search includes model", () => assert.equal(filterBuyerConversations([conversation(rfq("a", "Model Cedar"))], "CEDAR").length, 1));
test("search includes manufacturer", () => assert.equal(filterBuyerConversations([conversation(rfq("a", "Home", "Northstar"))], "north").length, 1));
test("search includes latest authorized message", () => { const r = rfq("a", "Home"); assert.equal(filterBuyerConversations([conversation(r, [message("m", "a", "Delivery update", "2026-01-02T00:00:00Z")])], "delivery").length, 1); });
test("search excludes nonmatching conversations", () => assert.equal(filterBuyerConversations([conversation(rfq("a", "Home"))], "unrelated").length, 0));
test("sort uses latest message descending", () => { const a = rfq("a", "A"), b = rfq("b", "B"); const sorted = sortBuyerConversations([conversation(a, [message("1", "a", "x", "2026-01-01T00:00:00Z")]), conversation(b, [message("2", "b", "x", "2026-01-03T00:00:00Z")])]); assert.equal(sorted[0].rfq.id, "b"); });
test("sort falls back to RFQ update date", () => { const sorted = sortBuyerConversations([conversation(rfq("a", "A", "M", "2026-01-01T00:00:00Z")), conversation(rfq("b", "B", "M", "2026-01-04T00:00:00Z"))]); assert.equal(sorted[0].rfq.id, "b"); });
test("malformed dates sort deterministically", () => { const sorted = sortBuyerConversations([conversation(rfq("b", "B", "M", "bad")), conversation(rfq("a", "A", "M", "bad"))]); assert.deepEqual(sorted.map((item) => item.rfq.id), ["a", "b"]); });
test("sorting does not mutate input", () => { const input = [conversation(rfq("b", "B")), conversation(rfq("a", "A"))]; const before = [...input]; sortBuyerConversations(input); assert.deepEqual(input, before); });
test("selection composes filter and stable sort", () => { const input = [conversation(rfq("b", "Cedar")), conversation(rfq("a", "Cedar"))]; assert.deepEqual(selectBuyerConversations(input, "cedar").map((item) => item.rfq.id), ["a", "b"]); });
test("inventory batches authorized RFQ message retrieval without N+1 reads", async () => { const records = [rfq("a", "A"), rfq("b", "B")]; let calls = 0; const result = await fetchBuyerConversations({ fetchRFQs: async () => records, fetchMessages: async (ids) => { calls += 1; assert.deepEqual(ids, ["a", "b"]); return ids.map((id) => message(`m-${id}`, id, id, "2026-01-01T00:00:00Z")); } }); assert.equal(calls, 1); assert.equal(result[1].latestMessage?.message, "b"); });
test("inventory propagates an incomplete message read instead of showing partial authority", async () => await assert.rejects(fetchBuyerConversations({ fetchRFQs: async () => [rfq("a", "A")], fetchMessages: async () => { throw new Error("denied"); } }), /denied/));
