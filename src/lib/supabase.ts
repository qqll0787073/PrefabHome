import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runtimeConfig } from "./runtimeConfig";

export const isSupabaseConfigured = runtimeConfig.isSupabaseConnected;

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(runtimeConfig.supabaseUrl!, runtimeConfig.supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
