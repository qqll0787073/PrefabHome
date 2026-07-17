import { pathToFileURL, URL } from "node:url";

export const PRODUCTION_PROJECT_REF = "eoyrfrjbjglfudfuwxdf";

export const REQUIRED_STAGING_KEYS = [
  "PREFAB_TEST_ENVIRONMENT",
  "PREFAB_ALLOW_FIXTURE_RESET",
  "PREFAB_STAGING_PROJECT_REF",
  "PREFAB_STAGING_SUPABASE_URL",
  "PREFAB_STAGING_SUPABASE_PUBLISHABLE_KEY",
  "PREFAB_STAGING_SUPABASE_SERVICE_ROLE_KEY",
  "PREFAB_STAGING_DATABASE_PASSWORD",
];

export function projectRefFromSupabaseUrl(value) {
  if (!value) {
    return null;
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost")) {
    return "local";
  }

  const suffix = ".supabase.co";
  if (!host.endsWith(suffix)) {
    return null;
  }

  return host.slice(0, -suffix.length);
}

export function evaluateStagingSafety(env = process.env) {
  const presentKeys = REQUIRED_STAGING_KEYS.filter((key) => Boolean(env[key]));
  const missingKeys = REQUIRED_STAGING_KEYS.filter((key) => !env[key]);
  const environmentType = env.PREFAB_TEST_ENVIRONMENT || "";
  const projectRef = env.PREFAB_STAGING_PROJECT_REF || "";
  const urlRef = projectRefFromSupabaseUrl(env.PREFAB_STAGING_SUPABASE_URL);
  const errors = [];

  if (environmentType !== "staging") {
    errors.push("PREFAB_TEST_ENVIRONMENT must be staging.");
  }

  if (!projectRef) {
    errors.push("PREFAB_STAGING_PROJECT_REF is required.");
  }

  if (projectRef === PRODUCTION_PROJECT_REF) {
    errors.push("Production project ref is denied.");
  }

  if (env.PREFAB_ALLOW_FIXTURE_RESET !== "true") {
    errors.push("PREFAB_ALLOW_FIXTURE_RESET=true is required.");
  }

  if (!urlRef) {
    errors.push("PREFAB_STAGING_SUPABASE_URL must be a valid Supabase project URL.");
  } else if (urlRef === "local") {
    errors.push("Localhost Supabase URL is not staging. Use explicit local mode outside this staging guard.");
  } else if (projectRef && urlRef !== projectRef) {
    errors.push("Supabase URL project ref must match PREFAB_STAGING_PROJECT_REF.");
  }

  for (const key of missingKeys) {
    errors.push(`${key} is required.`);
  }

  return {
    safe: errors.length === 0,
    environmentType: environmentType || "missing",
    projectRef: projectRef || null,
    presentKeys,
    missingKeys,
    decision: errors.length === 0 ? "safe_for_staging_dry_run" : "unsafe",
    errors,
  };
}

export function formatSafetyReport(result) {
  return {
    environmentType: result.environmentType,
    projectRef: result.projectRef,
    presentKeys: result.presentKeys,
    missingKeys: result.missingKeys,
    safetyDecision: result.decision,
    errors: result.errors,
  };
}

export function assertStagingSafety(env = process.env) {
  const result = evaluateStagingSafety(env);
  if (!result.safe) {
    const error = new Error("Unsafe staging environment.");
    error.report = formatSafetyReport(result);
    throw error;
  }
  return result;
}

export function main() {
  const result = evaluateStagingSafety(process.env);
  console.log(JSON.stringify(formatSafetyReport(result), null, 2));
  if (!result.safe) {
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
