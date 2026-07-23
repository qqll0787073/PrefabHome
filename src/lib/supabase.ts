import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runtimeConfig, type RuntimeConfig } from "./runtimeConfig";

type SupabaseClientFactory = typeof createClient;

export function createConfiguredSupabaseClient(
  config: RuntimeConfig,
  factory: SupabaseClientFactory = createClient,
): SupabaseClient | null {
  if (!config.isSupabaseConnected || !config.supabaseUrl || !config.supabaseAnonKey) return null;
  return factory(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }) as SupabaseClient;
}

export function isBrowserClientRuntime(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export function createRuntimeSupabaseClient(
  config: RuntimeConfig,
  factory: SupabaseClientFactory = createClient,
  browserRuntime = isBrowserClientRuntime(),
): SupabaseClient | null {
  if (!browserRuntime) return null;
  return createConfiguredSupabaseClient(config, factory);
}

export const supabase = createRuntimeSupabaseClient(runtimeConfig);
export const isSupabaseConfigured = supabase !== null;
