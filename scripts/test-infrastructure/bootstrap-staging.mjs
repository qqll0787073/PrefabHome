import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { assertStagingSafety } from "./staging-safety.mjs";

export function listMigrationVersions(migrationsDir = "supabase/migrations") {
  return fs.readdirSync(migrationsDir)
    .filter((file) => /^\d{4}_.+\.sql$/.test(file))
    .map((file) => file.slice(0, 4))
    .sort();
}

export function assertExpectedMigrations(versions) {
  const expected = Array.from({ length: 23 }, (_, index) => String(index + 1).padStart(4, "0"));
  const actual = [...versions].sort();
  if (actual.join(",") !== expected.join(",")) {
    throw new Error(`Expected migrations 0001 through 0023, found ${actual.join(",") || "none"}.`);
  }
  if (actual.includes("0024")) {
    throw new Error("Migration 0024 must not exist for this task.");
  }
  return true;
}

export function assertMigrationsUnchangedFromAuthProfiles() {
  try {
    execFileSync("git", ["diff", "--quiet", "auth-profiles", "--", "supabase/migrations"], { stdio: "pipe" });
    return true;
  } catch {
    throw new Error("Migration files differ from auth-profiles.");
  }
}

export function createIsolatedWorkspacePlan(projectRef, rootDir = process.cwd()) {
  if (!projectRef) {
    throw new Error("Staging project ref is required.");
  }
  const workspaceDir = path.join(os.tmpdir(), `prefab-staging-supabase-${projectRef}`);
  return {
    workspaceDir,
    filesToCopy: [
      "supabase/config.toml",
      "supabase/migrations",
    ],
    linkCommand: ["npx", "supabase", "link", "--project-ref", projectRef],
    migrationListCommand: ["npx", "supabase", "migration", "list", "--linked"],
    dryRunCommand: ["npx", "supabase", "db", "push", "--dry-run"],
    rootDir,
  };
}

export function buildBootstrapPlan(env = process.env) {
  const safety = assertStagingSafety(env);
  const versions = listMigrationVersions();
  assertExpectedMigrations(versions);
  assertMigrationsUnchangedFromAuthProfiles();
  const workspace = createIsolatedWorkspacePlan(safety.projectRef);
  return {
    mode: "dry_run_plan_only",
    projectRef: safety.projectRef,
    migrationVersions: versions,
    pendingIfEmpty: versions,
    workspace,
    remoteWritesExecuted: 0,
    migrationApplicationEnabled: false,
    applyRequested: env.PREFAB_STAGING_APPLY_MIGRATIONS === "true",
    applyBlockedByTaskScope: true,
  };
}

export function main() {
  try {
    const plan = buildBootstrapPlan(process.env);
    console.log(JSON.stringify(plan, null, 2));
    if (plan.applyRequested) {
      console.error("PREFAB_STAGING_APPLY_MIGRATIONS=true was provided, but actual application is disabled for this preparation task.");
      process.exitCode = 2;
    }
  } catch (error) {
    console.error(JSON.stringify({
      safetyDecision: "unsafe_or_incomplete",
      message: error.message,
      report: error.report,
      remoteWritesExecuted: 0,
    }, null, 2));
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
