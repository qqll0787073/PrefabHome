import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { resolveAuthProfilesMigrationBaseline } from "./bootstrap-staging.mjs";

const publicDirectory = "public";

test("static HTML contains complete public metadata without a production-domain assumption", () => {
  const html = readFileSync("index.html", "utf8");
  for (const marker of [
    'name="description"',
    'name="viewport"',
    'name="theme-color"',
    'name="color-scheme"',
    'name="application-name"',
    'name="author"',
    'name="robots"',
    'rel="canonical"',
    'property="og:type"',
    'property="og:title"',
    'property="og:description"',
    'property="og:image"',
    'property="og:url"',
    'property="og:site_name"',
    'name="twitter:card"',
    'name="twitter:title"',
    'name="twitter:description"',
    'name="twitter:image"',
  ]) assert.ok(html.includes(marker), `Missing metadata marker ${marker}`);
  assert.match(html, /https:\/\/example\.invalid/);
  assert.doesNotMatch(html, /eoyrfrjbjglfudfuwxdf|bvzbkjpbnczquecwqvlm|access_token|refresh_token/i);
});

test("manifest is valid, public, non-role-specific, and references existing icons", () => {
  const manifest = JSON.parse(readFileSync(`${publicDirectory}/manifest.webmanifest`, "utf8"));
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  assert.ok(!JSON.stringify(manifest).match(/dashboard|admin|buyer|manufacturer|workspace|offline/i));
  assert.ok(manifest.icons.some((icon) => icon.purpose === "maskable"));
  for (const icon of manifest.icons) {
    const path = `${publicDirectory}/${icon.src.replace(/^\//, "")}`;
    assert.equal(existsSync(path), true, `Missing manifest icon ${path}`);
    const bytes = readFileSync(path);
    assert.equal(bytes.toString("hex", 1, 4), "504e47", `${path} must be PNG`);
    const [expectedWidth, expectedHeight] = icon.sizes.split("x").map(Number);
    assert.equal(bytes.readUInt32BE(16), expectedWidth);
    assert.equal(bytes.readUInt32BE(20), expectedHeight);
  }
});

test("favicon, Apple icon, social image, robots, and sitemap assets exist", () => {
  for (const file of [
    "favicon.svg",
    "favicon-32x32.png",
    "apple-touch-icon.png",
    "icon-192.png",
    "icon-512.png",
    "maskable-icon-512.png",
    "og-image.svg",
    "robots.txt",
    "sitemap.xml",
  ]) assert.equal(existsSync(`${publicDirectory}/${file}`), true, `Missing public/${file}`);
  assert.match(readFileSync(`${publicDirectory}/og-image.svg`, "utf8"), /width="1200" height="630"/);
});

test("robots excludes portal surfaces and does not claim access control", () => {
  const robots = readFileSync(`${publicDirectory}/robots.txt`, "utf8");
  assert.match(robots, /Disallow: \/marketplace/);
  assert.match(robots, /Disallow: \/\*\?view=/);
  assert.match(robots, /not an access-control mechanism/i);
  assert.doesNotMatch(robots, /^Allow:.*(?:dashboard|admin|buyer|manufacturer|rfq|contract|invoice|payment|workspace)/im);
});

test("sitemap lists only clean public informational paths", () => {
  const sitemap = readFileSync(`${publicDirectory}/sitemap.xml`, "utf8");
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.deepEqual(locations, [
    "https://example.invalid/",
    "https://example.invalid/about",
    "https://example.invalid/contact",
    "https://example.invalid/version",
  ]);
  assert.ok(locations.every((location) => !/[?#]/.test(location)));
  assert.doesNotMatch(locations.join("\n"), /dashboard|admin|buyer|manufacturer|rfq|quote|contract|invoice|payment|profile|workspace|request=/i);
});

test("public route model includes navigation and safe Not Found behavior", () => {
  const model = readFileSync("src/lib/publicSite.ts", "utf8");
  const website = readFileSync("src/features/public/PublicWebsite.tsx", "utf8");
  for (const path of ['path: "/"', 'path: "/about"', 'path: "/contact"', 'path: "/version"']) {
    assert.ok(model.includes(path), `Missing ${path}`);
  }
  assert.match(model, /page: publicPageByPath\.get\(normalizedPath\) \?\? "not-found"/);
  assert.match(website, /Return to Home/);
  assert.match(website, /Contact details will be published before production launch/);
  assert.doesNotMatch(website, /Privacy Policy|Terms of Service|legal compliance/i);
});

test("public UI has responsive accessibility rules and no service worker or analytics", () => {
  const css = readFileSync("src/styles.css", "utf8");
  const source = [
    readFileSync("src/app/App.tsx", "utf8"),
    readFileSync("src/features/public/PublicWebsite.tsx", "utf8"),
    readFileSync("src/components/layout/PublicHeader.tsx", "utf8"),
    readFileSync("package.json", "utf8"),
  ].join("\n");
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(max-width: 420px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(source, /Suspense fallback=/);
  assert.doesNotMatch(source, /serviceWorker|navigator\.serviceWorker|workbox|Google Analytics|gtag\(|segment|mixpanel|cookie consent/i);
});

test("build-time public URL replacement is deterministic and non-networking", () => {
  const vite = readFileSync("vite.config.ts", "utf8");
  assert.match(vite, /PUBLIC_SITE_PLACEHOLDER = "https:\/\/example\.invalid"/);
  assert.match(vite, /for \(const filename of \["robots\.txt", "sitemap\.xml"\]\)/);
  assert.doesNotMatch(vite, /\bfetch\s*\(|node:(?:http|https|net|tls)|\bdeploy\b/i);
});

test("CI stays read-only and migrations remain exactly 0001 through 0024 unchanged", () => {
  const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
  assert.match(workflow, /^\s*- production-sprint-2b\s*$/m);
  assert.match(workflow, /permissions:\s*\n\s+contents: read/);
  const executableLines = workflow.split(/\r?\n/).filter((line) => /^\s*run:/.test(line)).join("\n");
  assert.doesNotMatch(executableLines, /\bdeploy\b|supabase\s+db|migration\s+(?:apply|repair)|git\s+tag|create[- ]release/i);
  const migrations = readdirSync("supabase/migrations").filter((file) => /^\d{4}_.+\.sql$/.test(file)).sort();
  assert.equal(migrations.length, 24);
  assert.equal(migrations[0].slice(0, 4), "0001");
  assert.equal(migrations.at(-1).slice(0, 4), "0024");
  const changed = execFileSync("git", [
    "diff", "--name-only", resolveAuthProfilesMigrationBaseline(), "--", "supabase/migrations",
  ], { encoding: "utf8", windowsHide: true }).trim();
  assert.equal(changed, "");
});
