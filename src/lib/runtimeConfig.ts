import { normalizePublicSiteUrl } from "./publicSite";

export type DeploymentEnvironment = "local" | "staging" | "production";

export type RuntimeConfigIssueCode =
  | "INVALID_DEPLOYMENT_ENV"
  | "INVALID_DEMO_FLAG"
  | "PRODUCTION_DEMO_BLOCKED"
  | "SUPABASE_CONFIGURATION_MISSING"
  | "SUPABASE_CONFIGURATION_INCOMPLETE"
  | "SUPABASE_URL_INVALID"
  | "PUBLIC_SITE_URL_INVALID";

export interface RuntimeConfigIssue {
  code: RuntimeConfigIssueCode;
  message: string;
}

export interface ReleaseMetadata {
  environment: DeploymentEnvironment;
  appVersion: string;
  commitSha: string;
}

export interface RuntimeConfig {
  deploymentEnvironment: DeploymentEnvironment;
  marketplaceDemoEnabled: boolean;
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  isSupabaseConnected: boolean;
  publicSiteUrl: string | null;
  release: ReleaseMetadata;
  issues: RuntimeConfigIssue[];
}

const TRUE_VALUES = new Set(["true", "1", "yes", "on"]);
const FALSE_VALUES = new Set(["false", "0", "no", "off", ""]);
const DEPLOYMENT_ENVIRONMENTS = new Set<DeploymentEnvironment>(["local", "staging", "production"]);

function envValue(env: Record<string, string | undefined>, name: string): string {
  return env[name]?.trim() ?? "";
}

export function parseRuntimeBoolean(value: string | undefined): { value: boolean; valid: boolean } {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (TRUE_VALUES.has(normalized)) return { value: true, valid: true };
  if (FALSE_VALUES.has(normalized)) return { value: false, valid: true };
  return { value: false, valid: false };
}

function normalizeDeploymentEnvironment(
  value: string,
  issues: RuntimeConfigIssue[]
): DeploymentEnvironment {
  const normalized = value.toLowerCase();
  if (!normalized) return "local";
  if (DEPLOYMENT_ENVIRONMENTS.has(normalized as DeploymentEnvironment)) {
    return normalized as DeploymentEnvironment;
  }
  issues.push({
    code: "INVALID_DEPLOYMENT_ENV",
    message: "The deployment environment must be local, staging, or production.",
  });
  return "local";
}

function normalizeReleaseValue(value: string, fallback: string): string {
  const normalized = value.trim().slice(0, 64);
  return normalized && /^[A-Za-z0-9._+-]+$/.test(normalized) ? normalized : fallback;
}

function validSupabaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function parseRuntimeConfig(env: Record<string, string | undefined>): RuntimeConfig {
  const issues: RuntimeConfigIssue[] = [];
  const deploymentEnvironment = normalizeDeploymentEnvironment(
    envValue(env, "VITE_DEPLOYMENT_ENV"),
    issues
  );
  const demo = parseRuntimeBoolean(env.VITE_ENABLE_MARKETPLACE_DEMO);
  if (!demo.valid) {
    issues.push({
      code: "INVALID_DEMO_FLAG",
      message: "Marketplace demo mode must be set to true or false.",
    });
  }

  let marketplaceDemoEnabled = demo.value;
  if (deploymentEnvironment === "production" && marketplaceDemoEnabled) {
    marketplaceDemoEnabled = false;
    issues.push({
      code: "PRODUCTION_DEMO_BLOCKED",
      message: "Marketplace demo mode is disabled in production.",
    });
  }

  const rawSupabaseUrl = envValue(env, "VITE_SUPABASE_URL");
  const rawSupabaseAnonKey = envValue(env, "VITE_SUPABASE_ANON_KEY");
  const hasUrl = Boolean(rawSupabaseUrl);
  const hasKey = Boolean(rawSupabaseAnonKey);
  const urlIsValid = hasUrl && validSupabaseUrl(rawSupabaseUrl);

  if (!hasUrl && !hasKey && !marketplaceDemoEnabled) {
    issues.push({
      code: "SUPABASE_CONFIGURATION_MISSING",
      message: "Supabase connection settings are missing.",
    });
  } else if (hasUrl !== hasKey) {
    issues.push({
      code: "SUPABASE_CONFIGURATION_INCOMPLETE",
      message: "Supabase URL and publishable key must be configured together.",
    });
  }

  if (hasUrl && !urlIsValid) {
    issues.push({
      code: "SUPABASE_URL_INVALID",
      message: "The Supabase URL must be a valid HTTP or HTTPS URL.",
    });
  }

  const isSupabaseConnected = urlIsValid && hasKey;
  const publicSiteResult = normalizePublicSiteUrl(
    envValue(env, "VITE_PUBLIC_SITE_URL"),
    deploymentEnvironment === "production",
  );
  if (publicSiteResult.error) {
    issues.push({
      code: "PUBLIC_SITE_URL_INVALID",
      message: publicSiteResult.error,
    });
  }
  const appVersion = normalizeReleaseValue(envValue(env, "VITE_APP_VERSION"), "development");
  const commitSha = normalizeReleaseValue(envValue(env, "VITE_COMMIT_SHA"), "unknown");

  return {
    deploymentEnvironment,
    marketplaceDemoEnabled,
    supabaseUrl: isSupabaseConnected ? rawSupabaseUrl : null,
    supabaseAnonKey: isSupabaseConnected ? rawSupabaseAnonKey : null,
    isSupabaseConnected,
    publicSiteUrl: publicSiteResult.value,
    release: {
      environment: deploymentEnvironment,
      appVersion,
      commitSha,
    },
    issues,
  };
}

function browserEnvironment(): Record<string, string | undefined> {
  const viteEnv = (import.meta as ImportMeta & {
    env?: Record<string, string | undefined>;
  }).env;
  if (viteEnv) return viteEnv;
  return typeof process !== "undefined"
    ? (process.env as Record<string, string | undefined>)
    : {};
}

export function readRuntimeConfig(): RuntimeConfig {
  return parseRuntimeConfig(browserEnvironment());
}

export const runtimeConfig = readRuntimeConfig();

export function isDemoFallbackAllowed(
  config: Pick<RuntimeConfig, "deploymentEnvironment"> = runtimeConfig
): boolean {
  return config.deploymentEnvironment !== "production";
}

export function runtimeConfigMessages(config: RuntimeConfig = runtimeConfig): string[] {
  return config.issues.map((issue) => issue.message);
}
