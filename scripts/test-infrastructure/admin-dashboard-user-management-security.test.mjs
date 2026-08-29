import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/0034_admin_dashboard_user_management.sql", "utf8");
const service = readFileSync("src/lib/adminUsers.ts", "utf8");
const users = readFileSync("src/features/admin/AdminUsersWorkspace.tsx", "utf8");
const dashboard = readFileSync("src/features/dashboard/PortalDashboard.tsx", "utf8");

test("0034 makes canonical authority active-profile dependent", () => {
  assert.match(migration, /p\.role = 'admin' and p\.status = 'active'/);
  assert.match(migration, /p\.role = 'manufacturer'[\s\S]+p\.status = 'active'/);
  assert.match(migration, /current_profile_role[\s\S]+p\.status = 'active'/);
});

test("Admin RPCs use fixed search paths and minimum grants", () => {
  for (const name of ["admin_list_users", "admin_set_profile_status", "admin_dashboard_summary"]) {
    assert.match(migration, new RegExp(`function public\\.${name}`));
  }
  assert.ok((migration.match(/set search_path = public, pg_temp/g) ?? []).length >= 7);
  assert.match(migration, /revoke all on function public\.admin_list_users[^;]+from public, anon, authenticated, service_role/);
  assert.match(migration, /grant execute on function public\.admin_list_users[^;]+to authenticated/);
  assert.match(migration, /revoke insert, update, delete on table public\.profiles from authenticated/);
});

test("status changes serialize final-Admin protection and cannot alter identity or role", () => {
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /for update/);
  assert.match(migration, /target\.id = actor_id and new_status = 'suspended'/);
  const update = migration.match(/return query\s+update public\.profiles[\s\S]+?returning[^;]+;/)?.[0] ?? "";
  assert.match(update, /set status = new_status/);
  const setClause = update.match(/set[\s\S]+?where/i)?.[0] ?? "";
  assert.doesNotMatch(setClause, /role\s*=|email\s*=|full_name\s*=|\bid\s*=/);
});

test("frontend sends only narrow RPC payloads and exposes no identity editors", () => {
  assert.match(service, /rpc\("admin_list_users"/);
  assert.match(service, /rpc\("admin_set_profile_status"/);
  assert.match(service, /target_profile_id: profileId/);
  assert.doesNotMatch(service, /admin[_-]?id|caller[_-]?role|from\("profiles"\).*update/s);
  assert.match(users, /Account email \(read-only\)/);
  assert.doesNotMatch(users, /type=["']password|Delete user|Promote to Admin|Edit role/);
  assert.match(users, /requestGeneration/);
  assert.match(users, /await setAdminProfileStatus[\s\S]+await load\(\)/);
  assert.match(dashboard, /auth\.user\.status !== "suspended"/);
});
