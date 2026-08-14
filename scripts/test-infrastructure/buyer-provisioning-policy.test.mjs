import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const cli = readFileSync("scripts/buyer-provisioning/cli.mjs", "utf8");
const core = readFileSync("scripts/buyer-provisioning/core.mjs", "utf8");
const adapter = readFileSync("scripts/buyer-provisioning/supabase-adapter.mjs", "utf8");

test("Buyer provisioning remains operator-only and absent from frontend imports", () => {
  for (const path of readdirSync("src", { recursive: true }).filter((item) => /\.(?:ts|tsx)$/.test(item))) {
    assert.doesNotMatch(readFileSync(`src/${path}`, "utf8"), /buyer-provisioning|buyer:provision/);
  }
});

test("Buyer provisioning introduces no migration or manual profile SQL", () => {
  assert.deepEqual(readdirSync("supabase/migrations").filter((item) => item.endsWith(".sql")).map((item) => item.slice(0, 4)), Array.from({ length: 30 }, (_, index) => String(index + 1).padStart(4, "0")));
  assert.doesNotMatch(`${cli}\n${core}\n${adapter}`, /insert\s+into|update\s+public\.profiles|from\s+auth\.users/i);
});

test("CLI requires dry-run inventory, explicit mode, and typed confirmation", () => {
  assert.match(cli, /--dry-run/); assert.match(cli, /MODE_REQUIRED/); assert.match(cli, /assertConfirmation/);
  assert.doesNotMatch(cli, /--password\b/);
});

test("Production is hard-denied and only the authorized Staging ref is accepted", () => {
  assert.match(core, /eoyrfrjbjglfudfuwxdf/); assert.match(core, /bvzbkjpbnczquecwqvlm/);
  assert.match(core, /Only Staging execution is supported/); assert.match(core, /Production is hard-denied/);
});

test("existing identities can only recover and creation waits for profile consistency", () => {
  assert.match(core, /return "recovery"/); assert.match(core, /DUPLICATE_PREVENTED/);
  assert.match(core, /waitForProfile/); assert.match(core, /PROFILE_TRIGGER_MISSING/); assert.match(core, /assertBuyerState/); assert.match(core, /resumeBuyer/);
  assert.match(adapter, /resetPasswordForEmail/); assert.match(adapter, /auth\.admin\.createUser/);
});
