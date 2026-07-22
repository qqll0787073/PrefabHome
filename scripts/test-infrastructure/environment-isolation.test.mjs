import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  browserRequestPolicy,
  browserSmokeEnvironment,
  localDevelopmentEnvironment,
} from "../environment/safe-vite-environment.mjs";

test("safe launch environments clear inherited browser variables", () => {
  const inherited = {
    PATH: "preserved-path",
    VITE_SUPABASE_URL: "https://eoyrfrjbjglfudfuwxdf.supabase.co",
    VITE_SUPABASE_ANON_KEY: "must-be-removed",
    VITE_DEPLOYMENT_ENV: "production",
    VITE_UNAPPROVED_VALUE: "must-also-be-removed",
  };
  const browser = browserSmokeEnvironment(inherited);
  assert.equal(browser.PATH, "preserved-path");
  assert.equal(browser.VITE_DEPLOYMENT_ENV, "test");
  assert.equal(browser.VITE_SUPABASE_URL, "https://nonconnecting.example.invalid");
  assert.equal(browser.VITE_SUPABASE_ANON_KEY, "browser-publishable-placeholder");
  assert.equal(browser.VITE_UNAPPROVED_VALUE, undefined);

  const local = localDevelopmentEnvironment(inherited);
  assert.equal(local.VITE_DEPLOYMENT_ENV, "local");
  assert.equal(local.VITE_ENABLE_MARKETPLACE_DEMO, "true");
  assert.equal(local.VITE_SUPABASE_URL, undefined);
  assert.equal(local.VITE_SUPABASE_ANON_KEY, undefined);
});

test("browser policy permits only the local app and non-network document schemes", () => {
  const origin = "http://127.0.0.1:4173";
  for (const url of [
    `${origin}/marketplace`,
    `${origin}/assets/app.js`,
    "about:blank",
    "data:image/png;base64,AA==",
    "blob:http://127.0.0.1:4173/example",
  ]) assert.equal(browserRequestPolicy(url, origin).allowed, true, url);

  assert.deepEqual(
    browserRequestPolicy("https://nonconnecting.example.invalid/auth/v1/token?secret=hidden", origin),
    { allowed: false, safeHost: "nonconnecting.example.invalid" },
  );
  assert.deepEqual(
    browserRequestPolicy("https://eoyrfrjbjglfudfuwxdf.supabase.co/rest/v1/private?token=hidden", origin),
    { allowed: false, safeHost: "blocked-supabase-host" },
  );
});

test("Vite and browser smoke enforce isolated modes before local rendering", () => {
  const vite = readFileSync("vite.config.ts", "utf8");
  const browserSmoke = readFileSync("scripts/quality/browser-smoke.mjs", "utf8");
  const safeLauncher = readFileSync("scripts/environment/run-vite-safe.mjs", "utf8");
  const packageManifest = JSON.parse(readFileSync("package.json", "utf8"));
  assert.match(vite, /envDir:\s*ISOLATED_ENV_DIRECTORY/);
  assert.doesNotMatch(vite, /\bloadEnv\b/);
  assert.equal(packageManifest.scripts["dev:safe"], "node scripts/environment/run-vite-safe.mjs dev");
  assert.match(packageManifest.scripts.build, /--mode ci/);
  assert.match(browserSmoke, /browserSmokeEnvironment\(\)/);
  assert.match(browserSmoke, /"build",[\s\S]*"--mode", "test"/);
  assert.match(browserSmoke, /Fetch\.enable/);
  assert.match(browserSmoke, /Fetch\.failRequest/);
  assert.match(browserSmoke, /externalRequests: 0/);
  assert.doesNotMatch(browserSmoke, /\.env\.production|\.env\.local/);
  assert.match(safeLauncher, /command === "preview"[\s\S]*"build", "--mode", "preview"/);
  assert.doesNotMatch(safeLauncher, /\.env\.production|\.env\.local/);
});
