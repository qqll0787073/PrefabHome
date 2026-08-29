import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const auth = readFileSync(new URL("../../src/lib/auth.ts", import.meta.url), "utf8");
const recovery = readFileSync(new URL("../../src/lib/authRecovery.ts", import.meta.url), "utf8");
const panel = readFileSync(new URL("../../src/features/auth/AuthPanel.tsx", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("../../src/features/dashboard/PortalDashboard.tsx", import.meta.url), "utf8");

test("recovery authority requires the Supabase PASSWORD_RECOVERY event", () => {
  assert.match(auth, /event === "PASSWORD_RECOVERY"[\s\S]*setRecoveryState\("valid"\)/);
  assert.match(auth, /recoveryState !== "valid"/);
  assert.match(dashboard, /auth\.recoveryRequested[\s\S]*recoveryState=\{auth\.recoveryState\}/);
  assert.doesNotMatch(recovery, /recovery.*(?:role|status|application_status)/i);
});

test("recovery and confirmation redirects are fixed internal destinations", () => {
  assert.match(recovery, /new URL\("\/marketplace", trustedOrigin\)/);
  assert.match(recovery, /redirect\.searchParams\.set\("auth", mode\)/);
  assert.doesNotMatch(recovery, /returnTo|redirect_uri|nextUrl|window\.location\.assign/);
});

test("browser recovery uses only ordinary Supabase Auth methods", () => {
  assert.match(recovery, /resetPasswordForEmail/);
  assert.match(recovery, /\.resend/);
  assert.match(recovery, /updateUser/);
  assert.doesNotMatch(auth + recovery + panel, /service_role|SUPABASE_SERVICE|auth\.admin|createUser\(|profiles.*update|application_status/);
});

test("passwords are not persisted or logged by recovery code", () => {
  const source = auth + recovery + panel;
  assert.doesNotMatch(source, /localStorage\.setItem\([^\n]*(?:password|recovery)/i);
  assert.doesNotMatch(source, /sessionStorage[^\n]*(?:password|recovery)/i);
  assert.doesNotMatch(source, /console\.(?:log|info|warn|error)\([^\n]*password/i);
  assert.doesNotMatch(source, /searchParams\.set\([^\n]*password/i);
});

test("demo mode states that recovery is unavailable rather than simulating it", () => {
  assert.match(panel, /Password recovery requires real Supabase Auth and is not simulated in demo mode/);
  assert.match(auth, /Password recovery requires Supabase Auth and is unavailable in demo mode/);
});

test("existing suspended-profile portal boundary remains authoritative", () => {
  assert.match(dashboard, /auth\.user\.status !== "suspended"/);
  assert.doesNotMatch(auth + recovery, /setUser\([^)]*status:\s*"active"[^)]*recovery/s);
});
