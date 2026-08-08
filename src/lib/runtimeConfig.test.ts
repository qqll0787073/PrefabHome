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

test("staging rejects Production and accepts only the authorized Staging project", () => {
  const production = parseRuntimeConfig({
    VITE_DEPLOYMENT_ENV: "staging",
    VITE_SUPABASE_URL: "https://eoyrfrjbjglfudfuwxdf.supabase.co",
    VITE_SUPABASE_ANON_KEY: "browser-publishable-placeholder",
  });
  assert.equal(production.isSupabaseConnected, false);
  assert.equal(production.supabaseUrl, null);
  assert.ok(production.issues.some((issue) => issue.code === "LOCAL_PRODUCTION_SUPABASE_BLOCKED"));

  const staging = parseRuntimeConfig({
    VITE_DEPLOYMENT_ENV: "staging",
    VITE_SUPABASE_URL: "https://bvzbkjpbnczquecwqvlm.supabase.co",
    VITE_SUPABASE_ANON_KEY: "browser-publishable-placeholder",
  });
  assert.equal(staging.isSupabaseConnected, true);
  assert.equal(staging.issues.length, 0);
});

test("unknown environments fail closed before connecting to Production", () => {
  const config = parseRuntimeConfig({
    VITE_DEPLOYMENT_ENV: "unexpected",
    VITE_SUPABASE_URL: "https://eoyrfrjbjglfudfuwxdf.supabase.co",
    VITE_SUPABASE_ANON_KEY: "browser-publishable-placeholder",
  });
  assert.equal(config.isSupabaseConnected, false);
  assert.equal(config.marketplaceDemoEnabled, false);
  assert.equal(isDemoFallbackAllowed(config), false);
  assert.ok(config.issues.some((issue) => issue.code === "INVALID_DEPLOYMENT_ENV"));
  assert.ok(config.issues.some((issue) => issue.code === "LOCAL_PRODUCTION_SUPABASE_BLOCKED"));
});

test("Production project requires an explicit Production deployment", () => {
  const config = parseRuntimeConfig({
    VITE_DEPLOYMENT_ENV: "production",
    VITE_SUPABASE_URL: "https://eoyrfrjbjglfudfuwxdf.supabase.co",
    VITE_SUPABASE_ANON_KEY: "browser-publishable-placeholder",
    VITE_ENABLE_MARKETPLACE_DEMO: "false",
  });
  assert.equal(config.deploymentEnvironment, "production");
  assert.equal(config.isSupabaseConnected, true);
  assert.ok(config.issues.every((issue) => issue.code !== "LOCAL_PRODUCTION_SUPABASE_BLOCKED"));
});

test("configured project refs must match a valid Supabase project URL", () => {
  for (const url of ["not-a-url", "https://wrongprojectref00000.supabase.co", "https://example.invalid"]) {
    const config = parseRuntimeConfig({
      VITE_DEPLOYMENT_ENV: "staging",
      VITE_SUPABASE_URL: url,
      VITE_SUPABASE_PROJECT_REF: "bvzbkjpbnczquecwqvlm",
      VITE_SUPABASE_ANON_KEY: "browser-publishable-placeholder",
    });
    assert.equal(config.isSupabaseConnected, false);
  }
});

test("canonicalizes one terminal DNS dot before enforcing project isolation", () => {
  const productionUrl = "https://eoyrfrjbjglfudfuwxdf.supabase.co.";
  const publishableKey = "browser-publishable-placeholder";

  for (const environment of ["staging", "local", "preview", "test", "ci", "development", "unexpected"]) {
    const config = parseRuntimeConfig({
      VITE_DEPLOYMENT_ENV: environment,
      VITE_SUPABASE_URL: productionUrl,
      VITE_SUPABASE_ANON_KEY: publishableKey,
      VITE_ENABLE_MARKETPLACE_DEMO: "true",
    });
    assert.equal(config.isSupabaseConnected, false, environment);
    assert.equal(config.marketplaceDemoEnabled, false, environment);
    assert.equal(isDemoFallbackAllowed(config), false, environment);
    assert.ok(config.issues.some((issue) => issue.code === "LOCAL_PRODUCTION_SUPABASE_BLOCKED"), environment);
  }
});

test("accepts canonical trailing-dot projects only in their authorized environments", () => {
  const publishableKey = "browser-publishable-placeholder";
  const staging = parseRuntimeConfig({
    VITE_DEPLOYMENT_ENV: "staging",
    VITE_SUPABASE_URL: "https://bvzbkjpbnczquecwqvlm.supabase.co.",
    VITE_SUPABASE_PROJECT_REF: "bvzbkjpbnczquecwqvlm",
    VITE_SUPABASE_ANON_KEY: publishableKey,
  });
  assert.equal(staging.isSupabaseConnected, true);
  assert.equal(staging.issues.length, 0);

  const production = parseRuntimeConfig({
    VITE_DEPLOYMENT_ENV: "production",
    VITE_SUPABASE_URL: "https://eoyrfrjbjglfudfuwxdf.supabase.co.",
    VITE_SUPABASE_PROJECT_REF: "eoyrfrjbjglfudfuwxdf",
    VITE_SUPABASE_ANON_KEY: publishableKey,
  });
  assert.equal(production.isSupabaseConnected, true);
  assert.ok(production.issues.every((issue) => issue.code !== "LOCAL_PRODUCTION_SUPABASE_BLOCKED"));
});

test("does not misclassify unrelated Supabase-like hostnames as Production", () => {
  for (const url of [
    "https://x.eoyrfrjbjglfudfuwxdf.supabase.co",
    "https://eoyrfrjbjglfudfuwxdf.supabase.co.example.invalid",
  ]) {
    const config = parseRuntimeConfig({
      VITE_DEPLOYMENT_ENV: "local",
      VITE_SUPABASE_URL: url,
      VITE_SUPABASE_ANON_KEY: "browser-publishable-placeholder",
    });
    assert.equal(config.isSupabaseConnected, true);
    assert.ok(config.issues.every((issue) => issue.code !== "LOCAL_PRODUCTION_SUPABASE_BLOCKED"));
  }
});

test("canonical project checks preserve URL parser host semantics", () => {
  for (const url of [
    "https://EOYRFRJBJGLFUDFUWXDF.SUPABASE.CO",
    "https://eoyrfrjbjglfudfuwxdf.supabase.co:443",
    "https://user:password@eoyrfrjbjglfudfuwxdf.supabase.co",
  ]) {
    const config = parseRuntimeConfig({
      VITE_DEPLOYMENT_ENV: "local",
      VITE_SUPABASE_URL: url,
      VITE_SUPABASE_ANON_KEY: "browser-publishable-placeholder",
    });
    assert.equal(config.isSupabaseConnected, false);
    assert.ok(config.issues.some((issue) => issue.code === "LOCAL_PRODUCTION_SUPABASE_BLOCKED"));
  }

  const wrongProject = parseRuntimeConfig({
    VITE_DEPLOYMENT_ENV: "staging",
    VITE_SUPABASE_URL: "https://wrongprojectref00000.supabase.co.",
    VITE_SUPABASE_ANON_KEY: "browser-publishable-placeholder",
  });
  assert.equal(wrongProject.isSupabaseConnected, false);
  assert.ok(wrongProject.issues.some((issue) => issue.code === "SUPABASE_PROJECT_MISMATCH"));
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
