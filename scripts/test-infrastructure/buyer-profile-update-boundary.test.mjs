import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const migrationPath = "supabase/migrations/0026_secure_buyer_profile_self_update.sql";
const migration = readFileSync(migrationPath, "utf8");
const authService = readFileSync("src/lib/auth.ts", "utf8");
const buyerProfileService = readFileSync("src/lib/buyerProfile.ts", "utf8");
const buyerProfileWorkspace = readFileSync("src/features/profile/BuyerProfileWorkspace.tsx", "utf8");
const databaseSecurityTest = readFileSync("supabase/tests/buyer_profile_self_update_security.sql", "utf8");

test("migration inventory is exactly 0001 through 0034 and Buyer profile migration remains unchanged", () => {
  const migrations = readdirSync("supabase/migrations").filter((file) => /^\d{4}_.+\.sql$/.test(file)).sort();
  assert.equal(migrations.length, 34);
  assert.equal(migrations.at(-1), "0034_admin_dashboard_user_management.sql");
  for (const file of migrations.slice(0, 25)) {
    const baseline = execFileSync("git", ["show", `origin/auth-profiles:supabase/migrations/${file}`], { encoding: "utf8", windowsHide: true }).replace(/\r\n/g, "\n");
    assert.equal(readFileSync(`supabase/migrations/${file}`, "utf8").replace(/\r\n/g, "\n"), baseline, `${file} changed`);
  }
});

test("0026 is transactional, local-only, and fingerprints the legacy exposure", () => {
  assert.match(migration, /^begin;/m);
  assert.match(migration, /Migration 0026 preflight failed:/);
  assert.match(migration, /has_table_privilege\('authenticated', 'public\.profiles', 'UPDATE'\)/);
  assert.match(migration, /Migration 0026 postflight failed:/);
  assert.match(migration, /commit;\s*$/);
  assert.doesNotMatch(migration, /project-ref|\.supabase\.co|supabase\s+(?:db|migration)/i);
  assert.doesNotMatch(migration, /drop\s+.+cascade|dynamic\s+sql|execute\s+format/i);
});

test("direct profile DML is removed while authorized reads remain", () => {
  assert.match(migration, /revoke insert, update, delete on table public\.profiles from authenticated/);
  assert.match(migration, /grant select on table public\.profiles to authenticated/);
  assert.match(migration, /drop policy if exists "profiles_insert_own"/);
  assert.match(migration, /drop policy if exists "profiles_update_own_or_admin"/);
  assert.match(migration, /authenticated profile DML remains granted/);
  assert.match(migration, /a profile mutation policy remains/);
});

test("Buyer RPC derives identity and exposes only full_name as input", () => {
  assert.match(migration, /update_my_buyer_profile\(full_name_text text\)/);
  assert.match(migration, /actor_uuid uuid := auth\.uid\(\)/);
  assert.match(migration, /where p\.id = actor_uuid/);
  assert.doesNotMatch(migration, /buyer_(?:id|uuid)|profile_(?:id|uuid)|email_text|role_text|status_text/);
  assert.doesNotMatch(migration, /jsonb|dynamic sql|execute format/i);
  assert.match(migration, /incompatible Buyer profile RPC overload exists/);
  assert.match(migration, /Buyer profile RPC overloads are unsafe/);
});

test("Buyer RPC requires an active Buyer and normalizes a bounded Unicode-capable name", () => {
  assert.match(migration, /actor_profile\.role <> 'buyer' or actor_profile\.status <> 'active'/);
  assert.match(migration, /normalized_full_name text := btrim\(full_name_text\)/);
  assert.match(migration, /normalized_full_name is null or normalized_full_name = ''/);
  assert.match(migration, /char_length\(normalized_full_name\) > 160/);
  assert.doesNotMatch(migration, /regexp_replace|lower\(normalized_full_name\)|html|sanitize/i);
});

test("RPC can update only full_name and returns only safe profile fields", () => {
  const updateStatement = migration.match(/return query\s+update public\.profiles[\s\S]+?returning[^;]+;/i)?.[0] ?? "";
  const setClause = updateStatement.match(/set[\s\S]+?where/i)?.[0] ?? "";
  const returningClause = updateStatement.match(/returning[^;]+/i)?.[0] ?? "";
  assert.match(updateStatement, /set full_name = normalized_full_name/);
  assert.doesNotMatch(setClause, /(?:role|status|email|created_at|updated_at|id)\s*=/i);
  assert.match(updateStatement, /returning p\.full_name, p\.role, p\.status, p\.updated_at/);
  assert.doesNotMatch(returningClause, /p\.id|p\.email|created_at/);
});

test("SECURITY DEFINER ownership, search_path, and execute grants fail closed", () => {
  assert.match(migration, /security definer\s+set search_path = public, pg_temp/);
  assert.match(migration, /function_owner <> 'postgres'/);
  assert.match(migration, /function_config is distinct from array\['search_path=public, pg_temp'\]/);
  assert.match(migration, /revoke all on function public\.update_my_buyer_profile\(text\) from public, anon, authenticated, service_role/);
  assert.match(migration, /grant execute on function public\.update_my_buyer_profile\(text\) to authenticated/);
});

test("signup relies on the trusted Auth trigger instead of browser profile upsert", () => {
  assert.doesNotMatch(authService, /from\("profiles"\)\.upsert/);
  assert.doesNotMatch(authService, /profilePayload/);
});

test("Buyer Profile frontend uses the narrow RPC and never writes profiles directly", () => {
  const combined = `${buyerProfileService}\n${buyerProfileWorkspace}`;
  assert.match(buyerProfileService, /supabase\.rpc\("update_my_buyer_profile", \{ full_name_text: fullName \}\)/);
  assert.doesNotMatch(combined, /from\("profiles"\)[\s\S]{0,120}\.(?:update|insert|upsert|delete)\(/);
  assert.doesNotMatch(buyerProfileWorkspace, /Change Email|Change Password|Enable MFA|Delete Account/);
  assert.match(buyerProfileWorkspace, /Save Changes/);
});

test("database regression suite covers approved, protected, cross-Buyer, and actor cases", () => {
  assert.match(databaseSecurityTest, /update_my_buyer_profile\('  李 雷  '\)/);
  for (const protectedField of ["role", "status", "email", "id", "created_at", "updated_at"]) {
    assert.match(databaseSecurityTest, new RegExp(`set ${protectedField} =`));
  }
  assert.match(databaseSecurityTest, /Cross Buyer/);
  assert.match(databaseSecurityTest, /RLS exposed another Buyer profile/);
  assert.match(databaseSecurityTest, /repeat\('名', 161\)/);
  assert.match(databaseSecurityTest, /\['inactive', 'manufacturer', 'admin'\]/);
  assert.match(databaseSecurityTest, /set local role anon/);
  assert.match(databaseSecurityTest, /rollback;\s*$/);
});
