import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runtimeConfig, type RuntimeConfig } from "./runtimeConfig";

export const isSupabaseConfigured = runtimeConfig.isSupabaseConnected;

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

export const supabase = createConfiguredSupabaseClient(runtimeConfig);
