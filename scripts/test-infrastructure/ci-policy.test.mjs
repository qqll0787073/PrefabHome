import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflowPath = ".github/workflows/ci.yml";
const workflow = readFileSync(workflowPath, "utf8");
const packageManifest = JSON.parse(readFileSync("package.json", "utf8"));

test("infrastructure test glob remains portable to the Linux CI shell", () => {
  assert.match(packageManifest.scripts.test, /node --test scripts\/test-infrastructure\/\*\.test\.mjs/);
  assert.doesNotMatch(packageManifest.scripts.test, /node --test ["']scripts\/test-infrastructure/);
});

test("CI runs the deterministic quality gate and dependency audit for PRs and production branches", () => {
  assert.match(workflow, /^\s*pull_request:\s*$/m);
  assert.match(workflow, /^\s*push:\s*$/m);
  assert.match(workflow, /^\s*- production-sprint-1\s*$/m);
  for (const command of [
    "npm ci",
    "npm run verify:quality",
    "npm audit --audit-level=low",
  ]) {
    assert.ok(workflow.includes(command), `Missing CI command: ${command}`);
  }
  assert.match(workflow, /^\s*- production-sprint-2c\s*$/m);
  assert.match(workflow, /^\s*- production-sprint-2d\s*$/m);
  assert.match(workflow, /VITE_PUBLIC_SITE_URL:\s*https:\/\/example\.invalid/);
});

test("CI permissions are read-only and superseded runs are cancelled", () => {
  assert.match(workflow, /permissions:\s*\n\s+contents: read/);
  assert.doesNotMatch(workflow, /^\s+[A-Za-z_-]+:\s*write\s*$/m);
  assert.match(workflow, /cancel-in-progress: true/);
});

test("CI contains no deployment, release, Supabase, or database-write commands", () => {
  assert.doesNotMatch(workflow, /\bsupabase\b|\bdb\s+(?:push|reset|pull)\b|migration\s+repair/i);
  assert.doesNotMatch(workflow, /\bdeploy(?:ment)?\b|create[- ]release|git\s+tag|environment:/i);
  assert.doesNotMatch(workflow, /service[_-]?role|database[_-]?password|access[_-]?token/i);
  assert.doesNotMatch(workflow, /eoyrfrjbjglfudfuwxdf|bvzbkjpbnczquecwqvlm/);
});

test("beta migrations are unchanged through 0031 and reviewed local inventory includes 0032-0035", () => {
  const changed = execFileSync(
    "git",
    ["diff", "--name-only", "beta-v1.0.0", "--", "supabase/migrations", ":(exclude)supabase/migrations/0032_secure_manufacturer_product_management.sql", ":(exclude)supabase/migrations/0033_secure_manufacturer_company_profile.sql", ":(exclude)supabase/migrations/0034_admin_dashboard_user_management.sql", ":(exclude)supabase/migrations/0035_harden_suspended_buyer_transaction_authority.sql"],
    { encoding: "utf8", windowsHide: true }
  ).trim();
  const expectedWith0029 = [
    "supabase/migrations/0025_restore_rfq_quote_authority.sql",
    "supabase/migrations/0026_secure_buyer_profile_self_update.sql",
    "supabase/migrations/0027_buyer_manufacturer_directory.sql",
    "supabase/migrations/0028_restrict_buyer_manufacturer_directory_grants.sql",
    "supabase/migrations/0029_require_active_buyer_for_rfq_drafts.sql",
    "supabase/migrations/0030_harden_buyer_purchase_order_entry.sql",
    "supabase/migrations/0031_secure_manufacturer_account_foundation.sql",
  ].join("\n");
  assert.equal(changed, expectedWith0029);
  assert.equal(
    readFileSync("supabase/migrations/0032_secure_manufacturer_product_management.sql", "utf8").includes("save_my_manufacturer_product"),
    true,
  );
  assert.equal(readFileSync("supabase/migrations/0033_secure_manufacturer_company_profile.sql", "utf8").includes("update_my_manufacturer_company_profile"), true);
});
