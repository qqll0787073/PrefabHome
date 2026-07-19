/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_ENABLE_MARKETPLACE_DEMO?: string;
  readonly VITE_DEPLOYMENT_ENV?: "local" | "staging" | "production";
  readonly VITE_APP_VERSION?: string;
  readonly VITE_COMMIT_SHA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
