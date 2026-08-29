import assert from "node:assert/strict";
import test from "node:test";
import { fetchAdminDashboardSummary, fetchAdminUsers, setAdminProfileStatus } from "./adminUsers";

function client(data: unknown = [], error: unknown = null) {
  const calls: Array<{ name: string; payload: unknown }> = [];
  return { calls, value: { async rpc(name: string, payload?: unknown) { calls.push({ name, payload }); return { data, error }; } } as never };
}

test("Admin user listing normalizes filters and bounded pagination payload", async () => {
  const mock = client([{ total_count: 1 }]);
  const result = await fetchAdminUsers({ search: "  User  ", role: "admin", status: "active", limit: 500, offset: -2 }, mock.value);
  assert.deepEqual(mock.calls[0], { name: "admin_list_users", payload: { search_text: "User", role_filter: "admin", status_filter: "active", page_limit: 100, page_offset: 0 } });
  assert.equal(result.total, 1);
});

test("status mutation supplies target and status without caller authority claims", async () => {
  const mock = client([{}]);
  await setAdminProfileStatus("11111111-1111-4111-8111-111111111111", "suspended", mock.value);
  assert.deepEqual(mock.calls[0], { name: "admin_set_profile_status", payload: { target_profile_id: "11111111-1111-4111-8111-111111111111", new_status: "suspended" } });
});

test("dashboard uses one authoritative aggregation RPC", async () => {
  const summary = { total_users: 4 };
  const mock = client([summary]);
  assert.equal((await fetchAdminDashboardSummary(mock.value)).total_users, 4);
  assert.deepEqual(mock.calls, [{ name: "admin_dashboard_summary", payload: undefined }]);
});
