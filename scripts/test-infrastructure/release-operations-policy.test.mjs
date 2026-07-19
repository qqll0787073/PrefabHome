import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { resolveAuthProfilesMigrationBaseline } from "./bootstrap-staging.mjs";

const requiredFiles = [
  "docs/PRODUCTION_SPRINT_2_PLAN.md",
  "docs/PRODUCTION_HOSTING_SPECIFICATION.md",
  "docs/SECURITY_HEADERS_POLICY.md",
  "docs/PRODUCTION_RELEASE_CHECKLIST.md",
  "config/security-headers.example",
  "config/hosting/generic-spa-fallback.example",
  "config/hosting/cloudflare-pages-spa.example",
  "config/hosting/netlify-spa._redirects.example",
  "scripts/release/verify-production-artifact.mjs",
  "scripts/release/verify-production-readiness.mjs",
];

test("Production Sprint 2 release-operation documents and templates exist", () => {
  for (const path of requiredFiles) assert.equal(existsSync(path), true, `Missing ${path}`);
  const checklist = readFileSync("docs/PRODUCTION_RELEASE_CHECKLIST.md", "utf8");
  for (const gate of ["Product Owner", "Technical Review", "QA", "Security", "Database", "Operations", "Backup/Restore", "Deployment Authorization"]) {
    assert.ok(checklist.includes(gate), `Missing release gate: ${gate}`);
  }
  assert.match(checklist, /Deployment Authorization: \*\*NOT GRANTED\*\*/);
});

test("security header template is strict and contains environment placeholders", () => {
  const headers = readFileSync("config/security-headers.example", "utf8");
  for (const header of [
    "Content-Security-Policy",
    "Strict-Transport-Security",
    "X-Content-Type-Options",
    "Referrer-Policy",
    "Permissions-Policy",
    "X-Frame-Options",
    "Cross-Origin-Opener-Policy",
  ]) assert.ok(headers.includes(header), `Missing header: ${header}`);
  assert.match(headers, /frame-ancestors 'none'/);
  assert.match(headers, /<SUPABASE_PROJECT_ORIGIN>/);
  assert.match(headers, /<SUPABASE_REALTIME_ORIGIN>/);
  assert.doesNotMatch(headers, /unsafe-inline|eoyrfrjbjglfudfuwxdf|bvzbkjpbnczquecwqvlm/);
});

test("hosting templates preserve static assets before SPA fallback", () => {
  const generic = readFileSync("config/hosting/generic-spa-fallback.example", "utf8");
  const cloudflare = readFileSync("config/hosting/cloudflare-pages-spa.example", "utf8");
  const netlify = readFileSync("config/hosting/netlify-spa._redirects.example", "utf8");
  assert.match(generic, /existing file[\s\S]*\/assets\/[\s\S]*404[\s\S]*index\.html/i);
  assert.match(cloudflare, /without a top-level 404\.html/);
  assert.match(cloudflare, /Do not add a catch-all _redirects rewrite/);
  assert.match(netlify, /\/\*\s+\/index\.html\s+200/);
});

test("artifact verification is local-only and package scripts keep release actions separate", () => {
  const artifact = readFileSync("scripts/release/verify-production-artifact.mjs", "utf8");
  const readiness = readFileSync("scripts/release/verify-production-readiness.mjs", "utf8");
  const packageManifest = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(packageManifest.scripts["verify:production-artifact"], "node scripts/release/verify-production-artifact.mjs");
  assert.equal(packageManifest.scripts["verify:production-readiness"], "node scripts/release/verify-production-readiness.mjs");
  assert.doesNotMatch(artifact, /from\s+["']node:(?:http|https|net|tls)["']|\bfetch\s*\(|\b(?:curl|wget|Invoke-WebRequest)\b|\b(?:upload|deploy)\b/i);
  assert.doesNotMatch(readiness, /\bsupabase\s+(?:db|link|migration)|\b(?:upload|deploy)\b/i);
  assert.match(artifact, /tmpdir\(\)/);
  assert.match(readiness, /runNpmScript\("verify:beta", betaEnvironment\)/);
  assert.match(readiness, /runNpmScript\("build", productionEnvironment\)/);
  assert.match(readiness, /runNpmScript\("verify:production-artifact", productionEnvironment\)/);
});

test("CI remains read-only and non-deploying while covering production-sprint-2", () => {
  const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
  assert.match(workflow, /^\s*- production-sprint-2\s*$/m);
  assert.match(workflow, /permissions:\s*\n\s+contents: read/);
  assert.doesNotMatch(workflow, /^\s+[A-Za-z_-]+:\s*write\s*$/m);
  assert.doesNotMatch(workflow, /^\s*environment:\s*production\s*$/mi);
  assert.doesNotMatch(workflow, /VITE_DEPLOYMENT_ENV:\s*production/i);
  assert.doesNotMatch(workflow, /\bsupabase\b|\bdb\s+(?:push|reset|pull)\b|migration\s+(?:apply|repair)|\bdeploy\b|git\s+tag|create[- ]release/i);
  assert.doesNotMatch(workflow, /service[_-]?role|database[_-]?password|eoyrfrjbjglfudfuwxdf|bvzbkjpbnczquecwqvlm/i);
});

test("Vite source maps are disabled and public CI/environment examples are non-connecting", () => {
  const vite = readFileSync("vite.config.ts", "utf8");
  const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
  const environmentExample = readFileSync(".env.example", "utf8");
  assert.match(vite, /sourcemap:\s*false/);
  assert.doesNotMatch(`${workflow}\n${environmentExample}`, /eoyrfrjbjglfudfuwxdf|bvzbkjpbnczquecwqvlm/);
  assert.match(environmentExample, /your-project-ref\.supabase\.co/);
  assert.match(environmentExample, /VITE_ENABLE_MARKETPLACE_DEMO=false/);
});

test("migration baseline remains exactly 0001 through 0024 and unchanged", () => {
  const migrations = readdirSync("supabase/migrations")
    .filter((file) => /^\d{4}_.+\.sql$/.test(file))
    .sort();
  assert.equal(migrations.length, 24);
  assert.equal(migrations[0].slice(0, 4), "0001");
  assert.equal(migrations.at(-1).slice(0, 4), "0024");
  const changed = execFileSync(
    "git",
    ["diff", "--name-only", resolveAuthProfilesMigrationBaseline(), "--", "supabase/migrations"],
    { encoding: "utf8", windowsHide: true },
  ).trim();
  assert.equal(changed, "");
});
