import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REQUIRED_BETA_FILES = [
  "README.md",
  "CHANGELOG.md",
  "docs/BETA_V1_RELEASE_NOTES.md",
  "docs/QUICK_START_GUIDE.md",
  "docs/BUYER_USER_GUIDE.md",
  "docs/MANUFACTURER_USER_GUIDE.md",
  "docs/ADMIN_USER_GUIDE.md",
  "docs/API_AND_RPC_REFERENCE.md",
  "docs/DEPLOYMENT_AND_OPERATIONS_GUIDE.md",
  "docs/BACKUP_RESTORE_ROLLBACK_GUIDE.md",
  "docs/BETA_QA_CHECKLIST.md",
  "docs/DEMO_DATA_AND_DEMO_RUNBOOK.md",
  "docs/BETA_RELEASE_SIGNOFF.md",
];

export const EXPECTED_MIGRATIONS = Array.from(
  { length: 24 },
  (_, index) => String(index + 1).padStart(4, "0")
);

function localMarkdownTargets(markdown) {
  const targets = [];
  const expression = /\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of markdown.matchAll(expression)) {
    const target = match[1].trim().replace(/^<|>$/g, "").split("#", 1)[0];
    if (!target || /^(?:https?:|mailto:|tel:)/i.test(target)) continue;
    targets.push(decodeURIComponent(target));
  }
  return targets;
}

export function auditBetaDocs(root = process.cwd()) {
  const errors = [];

  for (const relativePath of REQUIRED_BETA_FILES) {
    const absolutePath = resolve(root, relativePath);
    if (!existsSync(absolutePath)) {
      errors.push(`Missing required release file: ${relativePath}`);
      continue;
    }
    if (!statSync(absolutePath).isFile() || readFileSync(absolutePath, "utf8").trim().length === 0) {
      errors.push(`Required release file is empty: ${relativePath}`);
    }
  }

  const documentationFiles = ["README.md", "CHANGELOG.md"];
  const docsDirectory = resolve(root, "docs");
  if (existsSync(docsDirectory)) {
    documentationFiles.push(
      ...readdirSync(docsDirectory)
        .filter((name) => extname(name) === ".md")
        .map((name) => `docs/${name}`)
    );
  }

  for (const relativePath of [...new Set(documentationFiles)]) {
    const absolutePath = resolve(root, relativePath);
    if (!existsSync(absolutePath)) continue;
    const markdown = readFileSync(absolutePath, "utf8");
    for (const target of localMarkdownTargets(markdown)) {
      const resolvedTarget = resolve(dirname(absolutePath), target);
      if (!existsSync(resolvedTarget)) {
        errors.push(`Broken local link in ${relativePath}: ${target}`);
      }
    }
  }

  const migrationDirectory = resolve(root, "supabase/migrations");
  if (!existsSync(migrationDirectory)) {
    errors.push("Missing migration directory: supabase/migrations");
  } else {
    const migrations = readdirSync(migrationDirectory)
      .filter((name) => /^\d{4}_.+\.sql$/.test(name))
      .sort();
    const versions = migrations.map((name) => name.slice(0, 4));
    if (JSON.stringify(versions) !== JSON.stringify(EXPECTED_MIGRATIONS)) {
      errors.push(`Migration versions must be exactly 0001-0024; found ${versions.join(", ") || "none"}.`);
    }
  }

  return errors;
}

function main() {
  const errors = auditBetaDocs();
  if (errors.length > 0) {
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Beta release document audit passed (${REQUIRED_BETA_FILES.length} required files, 24 migrations).`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
