import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflowPath = ".github/workflows/ci.yml";
const workflow = readFileSync(workflowPath, "utf8");

test("CI runs required verification for PRs and production-sprint-1", () => {
  assert.match(workflow, /^\s*pull_request:\s*$/m);
  assert.match(workflow, /^\s*push:\s*$/m);
  assert.match(workflow, /^\s*- production-sprint-1\s*$/m);
  for (const command of [
    "npm ci",
    "npm run test",
    "npm run build",
    "npm audit --audit-level=low",
    "npm run verify:beta",
  ]) {
    assert.ok(workflow.includes(command), `Missing CI command: ${command}`);
  }
});

test("CI permissions are read-only and superseded runs are cancelled", () => {
  assert.match(workflow, /permissions:\s*\n\s+contents: read/);
  assert.doesNotMatch(workflow, /^\s+[A-Za-z_-]+:\s*write\s*$/m);
  assert.match(workflow, /cancel-in-progress: true/);
});

test("CI contains no deployment, release, Supabase, or database-write commands", () => {
  assert.doesNotMatch(workflow, /\bsupabase\b|\bdb\s+(?:push|reset|pull)\b|migration\s+repair/i);
  assert.doesNotMatch(workflow, /\bdeploy(?:ment)?\b|create[- ]release|git\s+tag|environment:/i);
  assert.doesNotMatch(workflow, /service[_-]?role|database[_-]?password|access[_-]?token/i);
  assert.doesNotMatch(workflow, /eoyrfrjbjglfudfuwxdf|bvzbkjpbnczquecwqvlm/);
});

test("migrations are unchanged from beta-v1.0.0", () => {
  const changed = execFileSync(
    "git",
    ["diff", "--name-only", "beta-v1.0.0", "--", "supabase/migrations"],
    { encoding: "utf8", windowsHide: true }
  ).trim();
  assert.equal(changed, "");
});
