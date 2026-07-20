import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const legalVerifierArguments = ["node_modules/tsx/dist/cli.mjs", "scripts/quality/verify-legal-readiness.ts"];

test("legal structure gate passes and publication remains explicitly unauthorized", () => {
  const structure = spawnSync(process.execPath, legalVerifierArguments, {
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(structure.status, 0, `${structure.stdout}\n${structure.stderr}`);
  assert.match(`${structure.stdout}\n${structure.stderr}`, /Legal structure verification passed/);

  const publication = spawnSync(process.execPath, [...legalVerifierArguments, "--publication"], {
    encoding: "utf8",
    windowsHide: true,
  });
  assert.notEqual(publication.status, 0);
  const output = `${publication.stdout}\n${publication.stderr}`;
  assert.match(output, /Legal publication authorization is not granted\./);
  assert.doesNotMatch(output, /at\s+\S+\s+\([^\n]+:\d+:\d+\)/);
  assert.doesNotMatch(output, /access[_-]?token|refresh[_-]?token|password/i);
});

test("contact center has no form and footer owns every public legal link", () => {
  const website = readFileSync("src/features/public/PublicWebsite.tsx", "utf8");
  const footer = readFileSync("src/components/public/PublicFooter.tsx", "utf8");
  const site = readFileSync("src/lib/publicSite.ts", "utf8");
  assert.doesNotMatch(website, /<form|successfully sent|message sent/i);
  assert.match(website, /publicContactCategories\.map/);
  assert.match(footer, /publicFooterPages\.map/);
  for (const page of ["privacy", "terms", "cookies", "accessibility", "acceptable-use", "copyright-trademark"]) {
    assert.match(site, new RegExp(`"${page}"`));
  }
});

test("legal foundation changes neither authorization nor migration surfaces", () => {
  const files = [
    "src/lib/publicOperator.ts",
    "src/lib/legalDocuments.ts",
    "src/lib/publicStatusPages.ts",
    "src/features/public/PublicWebsite.tsx",
  ].map((path) => readFileSync(path, "utf8")).join("\n");
  assert.doesNotMatch(files, /supabase\.|\.rpc\(|profiles\.role\s*=|service[_-]?role|CREATE\s+(?:POLICY|FUNCTION|TABLE)/i);
});
