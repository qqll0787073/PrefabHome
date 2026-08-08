import test from "node:test";
import assert from "node:assert/strict";
import { findAllAuthUsersByEmail } from "./supabase-adapter.mjs";

const TARGET = "buyer.uat@example.test";
const user = (id, email = `other-${id}@example.test`) => ({ id: String(id), email });
const adminFor = (pages, errorPage) => ({ async listUsers({ page }) { if (page === errorPage) throw new Error("network"); return pages[page - 1] ?? { data: { users: [] }, error: null }; } });
const page = (users, metadata = {}) => ({ data: { users, ...metadata }, error: null });

test("one-page exhaustion", async () => assert.equal((await findAllAuthUsersByEmail(adminFor([page([user(1, TARGET)])]), TARGET, { perPage: 2 })).length, 1));
test("enumerates multiple pages", async () => assert.equal((await findAllAuthUsersByEmail(adminFor([page([user(1), user(2)]), page([user(3, TARGET)])]), TARGET, { perPage: 2 })).length, 1));
test("a full page is followed by another page", async () => assert.equal((await findAllAuthUsersByEmail(adminFor([page([user(1), user(2)]), page([user(3, TARGET), user(4)]), page([])]), TARGET, { perPage: 2 })).length, 1));
test("discovers an identity after the former page-100 boundary", async () => { const pages = Array.from({ length: 100 }, (_, i) => page([user(i)])); pages.push(page([user(101, TARGET)])); assert.equal((await findAllAuthUsersByEmail(adminFor(pages), TARGET, { perPage: 1, pageSafetyCeiling: 102 })).length, 1); });
test("detects duplicate identities across distant pages", async () => { const pages = [page([user(1, TARGET)])]; for (let i = 2; i < 101; i += 1) pages.push(page([user(i)])); pages.push(page([user(101, TARGET)]), page([])); assert.equal((await findAllAuthUsersByEmail(adminFor(pages), TARGET, { perPage: 1, pageSafetyCeiling: 102 })).length, 2); });
test("fails closed at the safety ceiling", async () => assert.rejects(findAllAuthUsersByEmail(adminFor([page([user(1)]), page([user(2)])]), TARGET, { perPage: 1, pageSafetyCeiling: 2 }), (error) => error.code === "INVENTORY_INCOMPLETE"));
test("fails closed on repeated pages", async () => assert.rejects(findAllAuthUsersByEmail(adminFor([page([user(1)]), page([user(1)])]), TARGET, { perPage: 1 }), (error) => error.code === "INVENTORY_INCOMPLETE"));
test("fails closed on malformed pagination metadata", async () => assert.rejects(findAllAuthUsersByEmail(adminFor([page([user(1)], { total: "many" })]), TARGET, { perPage: 1 }), (error) => error.code === "INVENTORY_INCOMPLETE"));
test("fails closed on non-sequential next-page metadata", async () => assert.rejects(findAllAuthUsersByEmail(adminFor([page([user(1)], { nextPage: 7 })]), TARGET, { perPage: 1 }), (error) => error.code === "INVENTORY_INCOMPLETE"));
test("fails closed on a later network error", async () => assert.rejects(findAllAuthUsersByEmail(adminFor([page([user(1)])], 2), TARGET, { perPage: 1 }), (error) => error.code === "INVENTORY_INCOMPLETE"));
