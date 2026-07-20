import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PublicWebsite } from "../features/public/PublicWebsite";
import {
  normalizePublicSiteUrl,
  publicPageMetadata,
  publicPages,
  readApplicationLocation,
  safeReleaseDisplay,
  type PublicPage,
} from "./publicSite";

test("public paths and the query-driven portal resolve independently", () => {
  assert.deepEqual(readApplicationLocation("/", ""), { kind: "public", page: "home" });
  assert.deepEqual(readApplicationLocation("/about/", ""), { kind: "public", page: "about" });
  assert.deepEqual(readApplicationLocation("/privacy", ""), { kind: "public", page: "privacy" });
  assert.deepEqual(readApplicationLocation("/marketplace", "?view=dashboard"), { kind: "portal" });
  assert.deepEqual(readApplicationLocation("/products/example-model", ""), { kind: "portal" });
  assert.deepEqual(readApplicationLocation("/", "?view=dashboard&workspace=rfqs"), { kind: "portal" });
  assert.deepEqual(readApplicationLocation("/unsupported", ""), { kind: "public", page: "not-found" });
});

test("public site URLs reject credentials, query strings, fragments, and insecure production origins", () => {
  assert.equal(normalizePublicSiteUrl("http://localhost:5173", false).value, "http://localhost:5173");
  assert.equal(normalizePublicSiteUrl("https://preview.example.test/base/", true).value, "https://preview.example.test/base");
  for (const value of [
    "https://user:password@example.test",
    "https://example.test?portal=admin",
    "https://example.test#account",
  ]) assert.notEqual(normalizePublicSiteUrl(value, false).error, null);
  assert.match(normalizePublicSiteUrl("http://example.test", true).error ?? "", /HTTPS/);
  assert.match(normalizePublicSiteUrl("https://localhost", true).error ?? "", /localhost/);
});

test("public metadata remains route-specific and contains no authenticated state", () => {
  const metadata = publicPageMetadata("about", "https://example.test");
  assert.equal(metadata.canonicalUrl, "https://example.test/about");
  assert.equal(metadata.imageUrl, "https://example.test/og-image.svg");
  assert.equal(metadata.robots, "index, follow");
  assert.doesNotMatch(JSON.stringify(metadata), /workspace|request=|access_token|buyer_id|manufacturer_id/i);
  assert.equal(publicPageMetadata("not-found", "https://example.test").robots, "noindex, nofollow");
  assert.equal(publicPageMetadata("privacy", "https://example.test").robots, "noindex, nofollow");
});

test("every public page renders one h1, landmarks, and safe navigation", () => {
  const pages: PublicPage[] = [...publicPages.map((page) => page.id), "not-found"];
  for (const page of pages) {
    const markup = renderToStaticMarkup(createElement(PublicWebsite, { page, onNavigate: () => undefined }));
    assert.equal((markup.match(/<h1(?:\s|>)/g) ?? []).length, 1, `${page} must render one h1`);
    assert.match(markup, /<header/);
    assert.match(markup, /<nav[^>]+aria-label="Public website"/);
    assert.match(markup, /<main[^>]+id="public-content"/);
    assert.match(markup, /<footer/);
    assert.match(markup, /href="\/marketplace"/);
    assert.doesNotMatch(markup, /password|access_token|refresh_token|signed_url/i);
  }
});

test("Not Found returns safely home and version labels expose only normalized release metadata", () => {
  const notFound = renderToStaticMarkup(createElement(PublicWebsite, { page: "not-found", onNavigate: () => undefined }));
  assert.match(notFound, /Public page not found/);
  assert.match(notFound, /Return to Home/);
  const release = safeReleaseDisplay({
    environment: "staging",
    appVersion: "beta-1.0.0",
    commitSha: "a".repeat(40),
  });
  assert.deepEqual(release, {
    environment: "staging",
    version: "beta-1.0.0",
    commit: "a".repeat(12),
    releaseCandidate: "Not designated",
    buildTimestamp: "Not supplied",
    artifactChecksum: "Not supplied",
  });
});
