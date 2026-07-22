export const SAFE_BROWSER_SUPABASE_URL = "https://nonconnecting.example.invalid";
export const SAFE_BROWSER_SUPABASE_KEY = "browser-publishable-placeholder";

export function withoutInheritedViteVariables(environment = process.env) {
  const isolated = { ...environment };
  for (const name of Object.keys(isolated)) {
    if (name.startsWith("VITE_")) delete isolated[name];
  }
  return isolated;
}

export function localDevelopmentEnvironment(environment = process.env) {
  return {
    ...withoutInheritedViteVariables(environment),
    VITE_DEPLOYMENT_ENV: "local",
    VITE_ENABLE_MARKETPLACE_DEMO: "true",
    VITE_APP_VERSION: "local-development",
    VITE_COMMIT_SHA: "unknown",
    VITE_PUBLIC_SITE_URL: "http://localhost:5173",
  };
}

export function browserSmokeEnvironment(environment = process.env) {
  return {
    ...withoutInheritedViteVariables(environment),
    VITE_SUPABASE_URL: SAFE_BROWSER_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: SAFE_BROWSER_SUPABASE_KEY,
    VITE_DEPLOYMENT_ENV: "test",
    VITE_ENABLE_MARKETPLACE_DEMO: "false",
    VITE_APP_VERSION: "browser-smoke",
    VITE_COMMIT_SHA: "unknown",
    VITE_PUBLIC_SITE_URL: "http://localhost:5173",
  };
}

export function browserRequestPolicy(rawUrl, applicationOrigin) {
  let requestUrl;
  let originUrl;
  try {
    requestUrl = new URL(rawUrl);
    originUrl = new URL(applicationOrigin);
  } catch {
    return { allowed: false, safeHost: "invalid-external-host" };
  }

  if (["about:", "blob:", "data:"].includes(requestUrl.protocol)) {
    return { allowed: true, safeHost: null };
  }
  const allowed =
    ["http:", "https:"].includes(requestUrl.protocol)
    && requestUrl.hostname === originUrl.hostname
    && requestUrl.port === originUrl.port;
  if (allowed) return { allowed: true, safeHost: null };

  return {
    allowed: false,
    safeHost: requestUrl.hostname.endsWith(".supabase.co")
      ? "blocked-supabase-host"
      : requestUrl.hostname || "invalid-external-host",
  };
}
