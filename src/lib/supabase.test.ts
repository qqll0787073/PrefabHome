import assert from "node:assert/strict";
import test from "node:test";
import { parseRuntimeConfig } from "./runtimeConfig";
import { createConfiguredSupabaseClient } from "./supabase";

test("blocked local production configuration never reaches Supabase client creation", () => {
  const config = parseRuntimeConfig({
    VITE_DEPLOYMENT_ENV: "test",
    VITE_SUPABASE_URL: "https://eoyrfrjbjglfudfuwxdf.supabase.co",
    VITE_SUPABASE_ANON_KEY: "production-shaped-publishable-value",
  });
  let factoryCalls = 0;
  const client = createConfiguredSupabaseClient(config, (() => {
    factoryCalls += 1;
    throw new Error("Client factory must not run.");
  }) as never);
  assert.equal(client, null);
  assert.equal(factoryCalls, 0);
});
