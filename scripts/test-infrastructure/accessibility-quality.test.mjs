import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { resolveAuthProfilesMigrationBaseline } from "./bootstrap-staging.mjs";

function source(path) {
  return readFileSync(path, "utf8");
}

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

const applicationSource = sourceFiles("src").map((path) => ({ path, content: source(path) }));

test("public and portal shells provide one stable main target and matching skip links", () => {
  const publicWebsite = source("src/features/public/PublicWebsite.tsx");
  const portalApplication = source("src/app/PortalApplication.tsx");
  assert.match(publicWebsite, /href="#public-content">Skip to main content/);
  assert.match(publicWebsite, /<main id="public-content"[^>]+tabIndex=\{-1\}/);
  assert.equal((portalApplication.match(/<main\b/g) ?? []).length, 1);
  assert.match(portalApplication, /href="#portal-content">Skip to main content/);
  assert.match(portalApplication, /<main id="portal-content" tabIndex=\{-1\}>/);
});

test("source contains no positive tabindex or click-only non-interactive controls", () => {
  for (const file of applicationSource) {
    assert.doesNotMatch(file.content, /tabIndex\s*=\s*(?:\{\s*)?[1-9]\d*/, `${file.path} has a positive tabIndex`);
    assert.doesNotMatch(
      file.content,
      /<(?:div|span|li|p|section|article)\b[^>]*\bonClick\s*=/,
      `${file.path} has click handling on a non-interactive element`,
    );
  }
});

test("icon-only buttons and links have a statically detectable accessible name", () => {
  const failures = [];

  for (const file of applicationSource) {
    const ast = ts.createSourceFile(file.path, file.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

    function inspect(node) {
      if (ts.isJsxElement(node)) {
        const tag = node.openingElement.tagName.getText(ast);
        if (tag === "button" || tag === "a") {
          const attributes = node.openingElement.attributes.properties;
          const hasLabel = attributes.some((attribute) =>
            ts.isJsxAttribute(attribute)
            && ["aria-label", "aria-labelledby", "title"].includes(attribute.name.getText(ast)),
          );
          const hasText = node.children.some((child) =>
            (ts.isJsxText(child) && child.text.trim().length > 0)
            || (ts.isJsxExpression(child) && Boolean(child.expression))
            || (ts.isJsxElement(child) && child.openingElement.tagName.getText(ast) === "span")
            || (ts.isJsxSelfClosingElement(child)
              && child.tagName.getText(ast) === "img"
              && child.attributes.properties.some((attribute) =>
                ts.isJsxAttribute(attribute)
                && attribute.name.getText(ast) === "alt"
                && Boolean(attribute.initializer)
                && attribute.initializer.getText(ast) !== '""',
              )),
          );

          if (!hasLabel && !hasText) {
            const position = ast.getLineAndCharacterOfPosition(node.getStart(ast));
            failures.push(`${file.path}:${position.line + 1}`);
          }
        }
      }
      ts.forEachChild(node, inspect);
    }

    inspect(ast);
  }

  assert.deepEqual(failures, [], `Unlabelled icon-only controls: ${failures.join(", ")}`);
});

test("image components include accessible text and deliberate loading behavior", () => {
  const publicWebsite = source("src/features/public/PublicWebsite.tsx");
  const publicHeader = source("src/components/layout/PublicHeader.tsx");
  const card = source("src/features/marketplace/MarketplaceProductCard.tsx");
  const gallery = source("src/features/marketplace/MarketplaceImageGallery.tsx");
  const privateGallery = source("src/features/product-media/ProductMediaGallery.tsx");
  assert.match(publicWebsite, /width="1200"[\s\S]*height="630"[\s\S]*alt=/);
  assert.match(publicWebsite, /fetchPriority="high"/);
  assert.match(publicHeader, /alt="" width="40" height="40" decoding="async"/);
  for (const content of [card, gallery]) {
    assert.match(content, /alt=/);
    assert.match(content, /loading=/);
    assert.match(content, /decoding="async"/);
    assert.match(content, /fetchPriority=/);
  }
  assert.match(privateGallery, /alt=/);
  assert.match(privateGallery, /loading="lazy"/);
  assert.match(privateGallery, /decoding="async"/);
});

test("auth form exposes labels, autocomplete, busy state, invalid state, and associated errors", () => {
  const auth = source("src/features/auth/AuthPanel.tsx");
  for (const id of ["auth-full-name", "auth-email", "auth-password", "registration-account-role"]) {
    assert.match(auth, new RegExp(`htmlFor="${id}"`));
    assert.match(auth, new RegExp(`id="${id}"`));
  }
  assert.match(auth, /aria-busy=\{isLoading \|\| isSubmitting\}/);
  assert.match(auth, /aria-invalid=\{Boolean\(authError\)\}/);
  assert.match(auth, /aria-describedby=\{authError \? authErrorId : undefined\}/);
  assert.match(auth, /role="alert" tabIndex=\{-1\}/);
  assert.match(auth, /autoComplete="email"/);
  assert.match(auth, /"current-password" : "new-password"/);
});

test("CSS preserves focus, reduced-motion, forced-colors, and narrow reflow rules", () => {
  const css = source("src/styles.css");
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.match(css, /@media \(max-width: 420px\)/);
  assert.match(css, /main\[id\]\s*\{[\s\S]*scroll-margin-top/);
  assert.doesNotMatch(css, /outline:\s*(?:none|0)\s*;/);
});

test("public entry lazily loads the portal boundary and excludes selected portal-only modules", () => {
  const app = source("src/app/App.tsx");
  assert.match(app, /lazy\(\(\) => import\("\.\/PortalApplication"\)/);
  assert.doesNotMatch(app, /MarketplacePage|PortalDashboard|AdminLogisticsWorkspace|ParticipantLogisticsWorkspace|useAuth/);
  const portal = source("src/app/PortalApplication.tsx");
  assert.match(portal, /useAuth/);
  assert.match(portal, /MarketplacePage/);
});

test("quality gate is non-networking, non-deploying, and CI remains read-only", () => {
  const packageManifest = JSON.parse(source("package.json"));
  const analyzer = source("scripts/quality/analyze-bundle.mjs");
  const browserSmoke = source("scripts/quality/browser-smoke.mjs");
  const workflow = source(".github/workflows/ci.yml");
  assert.equal(packageManifest.scripts["quality:bundle"], "node scripts/quality/analyze-bundle.mjs");
  assert.equal(packageManifest.scripts["quality:browser"], "node scripts/quality/browser-smoke.mjs");
  assert.match(packageManifest.scripts["verify:quality"], /npm run build/);
  assert.match(packageManifest.scripts["verify:quality"], /npm run test/);
  assert.match(packageManifest.scripts["verify:quality"], /npm run verify:production-artifact/);
  assert.match(packageManifest.scripts["verify:quality"], /npm run quality:bundle/);
  assert.doesNotMatch(analyzer, /\bfetch\s*\(|node:(?:http|https|net|tls)|\bdeploy\b/i);
  for (const viewport of ["320, height: 568", "375, height: 667", "390, height: 844", "414, height: 896", "768, height: 1024", "1280, height: 800"]) {
    assert.match(browserSmoke, new RegExp(viewport));
  }
  assert.match(browserSmoke, /prefers-reduced-motion/);
  assert.match(browserSmoke, /consoleErrors: consoleErrors\.length/);
  assert.match(browserSmoke, /unsafeLogs: unsafeLogs\.length/);
  assert.match(browserSmoke, /Fetch\.enable/);
  assert.match(browserSmoke, /externalRequests: 0/);
  assert.doesNotMatch(browserSmoke, /\.env\.(?:local|staging|smoke)|SUPABASE|PREFAB_.*(?:PASSWORD|KEY|TOKEN)|screenshot/i);
  assert.match(workflow, /permissions:\s*\n\s+contents: read/);
  assert.doesNotMatch(workflow, /^\s+[A-Za-z_-]+:\s*write\s*$/m);
  assert.doesNotMatch(workflow, /\bsupabase\b|\bdeploy\b|git\s+tag|create[- ]release/i);
});

test("migrations contain unchanged 0001 through 0024 plus review-only 0025", () => {
  const migrations = readdirSync("supabase/migrations").filter((file) => /^\d{4}_.+\.sql$/.test(file)).sort();
  assert.equal(migrations.length, 25);
  assert.equal(migrations[0].slice(0, 4), "0001");
  assert.equal(migrations.at(-1), "0025_restore_rfq_quote_authority.sql");
  const changed = execFileSync("git", [
    "diff", "--name-only", resolveAuthProfilesMigrationBaseline(), "--", "supabase/migrations",
  ], { encoding: "utf8", windowsHide: true }).trim();
  assert.ok(changed === "" || changed === "supabase/migrations/0025_restore_rfq_quote_authority.sql");
});
