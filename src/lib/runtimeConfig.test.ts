import assert from "node:assert/strict";
import test from "node:test";
import {
  isDemoFallbackAllowed,
  parseRuntimeBoolean,
  parseRuntimeConfig,
} from "./runtimeConfig";

test("runtime configuration rejects a missing Supabase URL", () => {
  const config = parseRuntimeConfig({
    VITE_SUPABASE_ANON_KEY: "browser-publishable-placeholder",
  });
  assert.equal(config.isSupabaseConnected, false);
  assert.ok(config.issues.some((issue) => issue.code === "SUPABASE_CONFIGURATION_INCOMPLETE"));
  assert.ok(config.issues.every((issue) => !issue.message.includes("browser-publishable-placeholder")));
});

test("runtime configuration rejects an invalid Supabase URL", () => {
  const config = parseRuntimeConfig({
    VITE_SUPABASE_URL: "not-a-url",
    VITE_SUPABASE_ANON_KEY: "browser-publishable-placeholder",
  });
  assert.equal(config.isSupabaseConnected, false);
  assert.ok(config.issues.some((issue) => issue.code === "SUPABASE_URL_INVALID"));
});

test("runtime configuration requires the publishable key with a URL", () => {
  const config = parseRuntimeConfig({
    VITE_SUPABASE_URL: "https://project.invalid",
  });
  assert.equal(config.isSupabaseConnected, false);
  assert.ok(config.issues.some((issue) => issue.code === "SUPABASE_CONFIGURATION_INCOMPLETE"));
});

test("runtime booleans accept explicit forms and reject ambiguous values", () => {
  assert.deepEqual(parseRuntimeBoolean(" true "), { value: true, valid: true });
  assert.deepEqual(parseRuntimeBoolean("OFF"), { value: false, valid: true });
  assert.deepEqual(parseRuntimeBoolean(undefined), { value: false, valid: true });
  assert.deepEqual(parseRuntimeBoolean("sometimes"), { value: false, valid: false });
});

test("production configuration blocks marketplace demo mode", () => {
  const config = parseRuntimeConfig({
    VITE_DEPLOYMENT_ENV: "production",
    VITE_ENABLE_MARKETPLACE_DEMO: "true",
  });
  assert.equal(config.deploymentEnvironment, "production");
  assert.equal(config.marketplaceDemoEnabled, false);
  assert.equal(isDemoFallbackAllowed(config), false);
  assert.ok(config.issues.some((issue) => issue.code === "PRODUCTION_DEMO_BLOCKED"));
});

test("local demo mode remains available without Supabase credentials", () => {
  const config = parseRuntimeConfig({
    VITE_DEPLOYMENT_ENV: "local",
    VITE_ENABLE_MARKETPLACE_DEMO: "true",
  });
  assert.equal(config.marketplaceDemoEnabled, true);
  assert.equal(isDemoFallbackAllowed(config), true);
  assert.equal(config.isSupabaseConnected, false);
  assert.equal(config.issues.length, 0);
});

test("non-production runtime aliases reject the production Supabase project without exposing configuration", () => {
  const productionUrl = "https://eoyrfrjbjglfudfuwxdf.supabase.co";
  const publishableKey = "production-shaped-publishable-value";
  for (const environment of ["local", "test", "ci", "development", "preview"]) {
    const config = parseRuntimeConfig({
      VITE_DEPLOYMENT_ENV: environment,
      VITE_SUPABASE_URL: productionUrl,
      VITE_SUPABASE_ANON_KEY: publishableKey,
      VITE_ENABLE_MARKETPLACE_DEMO: "true",
    });
    assert.equal(config.deploymentEnvironment, "local");
    assert.equal(config.isSupabaseConnected, false);
    assert.equal(config.supabaseUrl, null);
    assert.equal(config.supabaseAnonKey, null);
    assert.equal(config.marketplaceDemoEnabled, false);
    assert.equal(isDemoFallbackAllowed(config), false);
    assert.ok(config.issues.some((issue) => issue.code === "LOCAL_PRODUCTION_SUPABASE_BLOCKED"));
    const messages = config.issues.map((issue) => issue.message).join(" ");
    assert.doesNotMatch(messages, /eoyrfrjbjglfudfuwxdf|supabase\.co|production-shaped-publishable-value/i);
  }
});

test("fake CI placeholders remain accepted without weakening the production-project guard", () => {
  const config = parseRuntimeConfig({
    VITE_DEPLOYMENT_ENV: "ci",
    VITE_SUPABASE_URL: "https://nonconnecting.example.invalid",
    VITE_SUPABASE_ANON_KEY: "browser-publishable-placeholder",
    VITE_ENABLE_MARKETPLACE_DEMO: "false",
  });
  assert.equal(config.deploymentEnvironment, "local");
  assert.equal(config.isSupabaseConnected, true);
  assert.equal(config.issues.length, 0);
});

test("release metadata uses safe local fallbacks", () => {
  const config = parseRuntimeConfig({});
  assert.deepEqual(config.release, {
    environment: "local",
    appVersion: "development",
    commitSha: "unknown",
  });
  assert.equal(config.publicSiteUrl, "http://localhost:5173");
});

test("runtime public site URL follows local and production safety rules", () => {
  const local = parseRuntimeConfig({ VITE_PUBLIC_SITE_URL: "http://localhost:5173" });
  assert.equal(local.publicSiteUrl, "http://localhost:5173");
  const production = parseRuntimeConfig({
    VITE_DEPLOYMENT_ENV: "production",
    VITE_PUBLIC_SITE_URL: "https://www.example.test",
  });
  assert.equal(production.publicSiteUrl, "https://www.example.test");
  const unsafe = parseRuntimeConfig({
    VITE_DEPLOYMENT_ENV: "production",
    VITE_PUBLIC_SITE_URL: "https://user:password@example.test/private?role=admin",
  });
  assert.equal(unsafe.publicSiteUrl, null);
  assert.ok(unsafe.issues.some((issue) => issue.code === "PUBLIC_SITE_URL_INVALID"));
  assert.ok(unsafe.issues.every((issue) => !issue.message.includes("password")));
});
