import { execFileSync, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const APPROVED_BROWSER_VARIABLES = new Set([
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_ENABLE_MARKETPLACE_DEMO",
  "VITE_DEPLOYMENT_ENV",
  "VITE_APP_VERSION",
  "VITE_COMMIT_SHA",
]);

export function assertProductionReadinessEnvironment(env, expectedCommitSha) {
  if (env.VITE_DEPLOYMENT_ENV?.trim().toLowerCase() !== "production") {
    throw new Error("Production readiness requires VITE_DEPLOYMENT_ENV=production.");
  }
  if (env.VITE_ENABLE_MARKETPLACE_DEMO?.trim().toLowerCase() !== "false") {
    throw new Error("Production readiness requires VITE_ENABLE_MARKETPLACE_DEMO=false.");
  }

  const unknownBrowserVariables = Object.keys(env)
    .filter((name) => name.startsWith("VITE_") && !APPROVED_BROWSER_VARIABLES.has(name))
    .sort();
  if (unknownBrowserVariables.length > 0) {
    throw new Error(`Production readiness rejects unapproved browser variables: ${unknownBrowserVariables.join(", ")}.`);
  }

  const appVersion = env.VITE_APP_VERSION?.trim() ?? "";
  if (!appVersion || appVersion === "development" || !/^[A-Za-z0-9._+-]{1,64}$/.test(appVersion)) {
    throw new Error("Production readiness requires explicit non-development VITE_APP_VERSION metadata.");
  }

  const commitSha = env.VITE_COMMIT_SHA?.trim().toLowerCase() ?? "";
  if (!/^[0-9a-f]{40}$/.test(commitSha) || commitSha !== expectedCommitSha.toLowerCase()) {
    throw new Error("Production readiness requires VITE_COMMIT_SHA to equal the full candidate commit SHA.");
  }

  return {
    deploymentEnvironment: "production",
    marketplaceDemoEnabled: false,
    appVersion,
    commitSha,
    approvedBrowserVariables: Object.keys(env).filter((name) => name.startsWith("VITE_")).sort(),
  };
}

function runNpmScript(script, env = process.env) {
  const npmCliPath = process.env.npm_execpath;
  if (!npmCliPath) throw new Error("npm_execpath is unavailable; run readiness through npm.");
  const result = spawnSync(process.execPath, [npmCliPath, "run", script], {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`npm run ${script} failed with exit code ${result.status}.`);
}

export function main() {
  try {
    const headSha = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      windowsHide: true,
    }).trim();
    assertProductionReadinessEnvironment(process.env, headSha);

    const productionEnvironment = { ...process.env };
    const betaEnvironment = {
      ...process.env,
      VITE_DEPLOYMENT_ENV: "local",
      VITE_ENABLE_MARKETPLACE_DEMO: "false",
    };
    delete betaEnvironment.VITE_SUPABASE_URL;
    delete betaEnvironment.VITE_SUPABASE_ANON_KEY;

    // Beta gates are deliberately disconnected; the separately verified artifact uses production metadata.
    runNpmScript("verify:beta", betaEnvironment);
    runNpmScript("build", productionEnvironment);
    runNpmScript("verify:production-artifact", productionEnvironment);
    console.log("Production readiness verification passed. No release action was performed.");
  } catch (error) {
    console.error(`Production readiness verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
