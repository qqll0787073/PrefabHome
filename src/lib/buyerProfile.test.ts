import assert from "node:assert/strict";
import test from "node:test";
import type { ProfileRecord } from "../types";
import { fetchBuyerProfile, type BuyerProfileOperations } from "./buyerProfile";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const profile = (overrides: Partial<ProfileRecord> = {}): ProfileRecord => ({ id: USER_ID, role: "buyer", full_name: "Buyer Name", email: "buyer@example.test", status: "active", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", ...overrides });
function operations(overrides: Partial<BuyerProfileOperations> = {}) { let selected = ""; let fetches = 0; const value: BuyerProfileOperations = { async getAuthIdentity() { return { id: USER_ID, email: "Buyer@Example.Test" }; }, async fetchProfile(id) { selected = id; fetches += 1; return profile(); }, ...overrides }; return { value, selected: () => selected, fetches: () => fetches }; }

test("profile load derives identity from Auth and reads only that UUID", async () => { const mock = operations(); await fetchBuyerProfile(USER_ID, mock.value); assert.equal(mock.selected(), USER_ID); });
test("caller cannot substitute another profile UUID", async () => { const mock = operations(); await assert.rejects(fetchBuyerProfile("22222222-2222-4222-8222-222222222222", mock.value), /account changed/i); assert.equal(mock.fetches(), 0); });
test("profile UUID must match Auth", async () => { const mock = operations({ async fetchProfile() { return profile({ id: "22222222-2222-4222-8222-222222222222" }); } }); await assert.rejects(fetchBuyerProfile(USER_ID, mock.value), /unavailable/i); });
test("only active Buyers can load", async () => { for (const change of [{ role: "manufacturer" as const }, { status: "suspended" }]) { const mock = operations({ async fetchProfile() { return profile(change); } }); await assert.rejects(fetchBuyerProfile(USER_ID, mock.value), /unavailable/i); } });
test("missing profile fails closed", async () => { const mock = operations({ async fetchProfile() { return null; } }); await assert.rejects(fetchBuyerProfile(USER_ID, mock.value), /unavailable/i); });
test("Auth email is authoritative and normalized profile email must match", async () => { const mock = operations(); const result = await fetchBuyerProfile(USER_ID, mock.value); assert.equal(result.accountEmail, "Buyer@Example.Test"); const mismatch = operations({ async fetchProfile() { return profile({ email: "other@example.test" }); } }); await assert.rejects(fetchBuyerProfile(USER_ID, mismatch.value), /needs support/i); });
test("service errors are sanitized", async () => { const mock = operations({ async fetchProfile() { throw new Error("sql policy jwt secret"); } }); await assert.rejects(fetchBuyerProfile(USER_ID, mock.value), (error: Error) => error.message === "Profile service is unavailable."); });
test("service has no update operation or caller-selected fields", () => { const mock = operations(); assert.deepEqual(Object.keys(mock.value).sort(), ["fetchProfile", "getAuthIdentity"]); });
