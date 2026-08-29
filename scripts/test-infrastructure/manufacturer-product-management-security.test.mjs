import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/0032_secure_manufacturer_product_management.sql", "utf8");
const databaseSecurityTest = readFileSync("supabase/tests/manufacturer_product_management_security.sql", "utf8");
const databaseRunner = readFileSync("scripts/local-db/run-disposable-database-validation.mjs", "utf8");
const products = readFileSync("src/lib/products.ts", "utf8");
const workspace = readFileSync("src/features/products/ManufacturerProductList.tsx", "utf8");
const navigation = readFileSync("src/lib/portalNavigation.ts", "utf8");

test("migration inventory is exactly 0001 through 0034", () => {
  const migrations = readdirSync("supabase/migrations").filter((file) => /^\d{4}_.+\.sql$/.test(file)).sort();
  assert.equal(migrations.length, 34);
  assert.equal(migrations.at(-1), "0034_admin_dashboard_user_management.sql");
});

test("0032 derives authority and exposes only explicit Manufacturer-owned fields", () => {
  assert.match(migration, /security definer[\s\S]*set search_path = public/gi);
  assert.match(migration, /where public\.owns_manufacturer\(p\.manufacturer_id\)/);
  assert.match(migration, /where public\.owns_manufacturer\(m\.id\)/);
  assert.doesNotMatch(migration.match(/returns table \([\s\S]*?\)\s*language sql/)?.[0] ?? "", /review_notes|reviewed_by|reviewed_at|owner_id|email|phone/i);
  assert.doesNotMatch(migration.match(/create or replace function public\.save_my_manufacturer_product\([\s\S]*?\)\s*returns uuid/)?.[0] ?? "", /manufacturer_id|status_text|review_notes|reviewed_by|published_at/i);
});

test("0032 removes raw Manufacturer Product DML while preserving Admin authority", () => {
  for (const policy of ["products_authenticated_select_visible", "products_manufacturer_insert_own_approved", "products_manufacturer_update_own_editable"]) {
    assert.match(migration, new RegExp(`drop policy if exists "${policy}"`));
  }
  assert.doesNotMatch(migration, /drop policy if exists "products_admin_all"/);
  assert.match(migration, /revoke all on function public\.get_my_manufacturer_products\(\) from public, anon/);
  assert.match(migration, /grant execute on function public\.get_my_manufacturer_products\(\) to authenticated/);
});

test("0032 validates every numeric field independently and has executable database regression coverage", () => {
  assert.doesNotMatch(migration, /greatest\s*\(/i);
  for (const field of [
    "fob_price_value", "floor_area_value", "bathrooms_value", "length_value", "width_value",
    "height_value", "snow_load_value", "bedrooms_value", "stories_value", "production_lead_time_value",
  ]) {
    assert.match(migration, new RegExp(`${field} is not null and ${field} < 0`));
  }
  assert.match(migration, /minimum_order_quantity_value is not null and minimum_order_quantity_value < 1/);
  assert.match(databaseSecurityTest, /save_my_manufacturer_product/);
  for (const field of [
    "fob_price", "floor_area", "bathrooms", "length_ft", "width_ft", "height_ft",
    "snow_load", "bedrooms", "stories", "production_lead_time",
  ]) {
    assert.match(databaseSecurityTest, new RegExp(`'${field}'`));
  }
  assert.match(databaseSecurityTest, /minimum_order => 0/);
  assert.match(databaseRunner, /manufacturer_product_management_security\.sql/);
});

test("Manufacturer client reads and writes through constrained RPCs", () => {
  assert.match(products, /\.rpc\("get_my_manufacturer_products"\)/);
  assert.match(products, /\.rpc\("save_my_manufacturer_product"/);
  const ownRead = products.match(/export async function fetchOwnProducts[\s\S]*?\n}/)?.[0] ?? "";
  assert.doesNotMatch(ownRead, /\.from\("manufacturers"\)|\.from\("products"\)|select\("\*"\)/);
  assert.match(ownRead, /auth\.getUser\(\)/);
});

test("Manufacturer workspace includes collection, routing, async, and authorization controls", () => {
  assert.match(workspace, /type="search"/);
  assert.match(workspace, /All statuses/);
  assert.match(workspace, /Recently updated/);
  assert.match(workspace, /Name A.Z/);
  assert.match(workspace, /record=\$\{encodeURIComponent\(product\.id\)}/);
  assert.match(navigation, /\["rfqs", "quotes", "messages", "manufacturers", "products"/);
  assert.match(workspace, /generation\.current/);
  assert.match(workspace, /saving\.current/);
  assert.match(workspace, /account\.profile_status === "active"/);
  assert.match(workspace, /No Products match your search and status filters/);
  assert.match(workspace, />Retry</);
});
