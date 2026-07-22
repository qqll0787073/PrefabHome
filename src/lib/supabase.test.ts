import assert from "node:assert/strict";
import test from "node:test";
import { parseRuntimeConfig } from "./runtimeConfig";
import {
  createConfiguredSupabaseClient,
  createRuntimeSupabaseClient,
  isBrowserClientRuntime,
} from "./supabase";

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

test("accepted fake CI configuration does not create a Supabase client in Node", () => {
  const config = parseRuntimeConfig({
    VITE_DEPLOYMENT_ENV: "ci",
    VITE_SUPABASE_URL: "https://nonconnecting.example.invalid",
    VITE_SUPABASE_ANON_KEY: "browser-publishable-placeholder",
  });
  let factoryCalls = 0;
  const client = createRuntimeSupabaseClient(config, (() => {
    factoryCalls += 1;
    throw new Error("Node test runtime must not construct the browser client.");
  }) as never, false);
  assert.equal(config.isSupabaseConnected, true);
  assert.equal(isBrowserClientRuntime(), false);
  assert.equal(client, null);
  assert.equal(factoryCalls, 0);
});
