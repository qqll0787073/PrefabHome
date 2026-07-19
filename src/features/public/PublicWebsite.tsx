import React, { useEffect, useRef } from "react";
import { PublicHeader } from "../../components/layout/PublicHeader";
import { runtimeConfig } from "../../lib/runtimeConfig";
import {
  applyPublicPageMetadata,
  safeReleaseDisplay,
  type PublicPage,
} from "../../lib/publicSite";

interface PublicWebsiteProps {
  page: PublicPage;
  onNavigate: (path: string) => void;
}

function PublicLink({ path, onNavigate, children }: {
  path: string;
  onNavigate: (path: string) => void;
  children: React.ReactNode;
}) {
  return (
    <a
      href={path}
      onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onNavigate(path);
      }}
    >
      {children}
    </a>
  );
}

function HomePage({ onNavigate }: Pick<PublicWebsiteProps, "onNavigate">) {
  return (
    <main id="public-content" className="public-main" tabIndex={-1}>
      <section className="public-home-hero" aria-labelledby="home-title">
        <div className="public-home-copy">
          <p className="eyebrow">Public marketplace foundation</p>
          <h1 id="home-title">PrefabHome Marketplace</h1>
          <p>
            Discover prefab home products and enter structured Buyer, Manufacturer, and Admin
            workflows through role-controlled portals.
          </p>
          <div className="public-actions">
            <PublicLink path="/marketplace" onNavigate={onNavigate}>Explore marketplace</PublicLink>
            <PublicLink path="/about" onNavigate={onNavigate}>How PrefabHome works</PublicLink>
          </div>
        </div>
        <img
          src="/og-image.svg"
          width="1200"
          height="630"
          alt="PrefabHome modular home mark and marketplace name"
          loading="eager"
          decoding="async"
          fetchPriority="high"
        />
      </section>
      <section className="public-content-band" aria-labelledby="public-path-title">
        <p className="eyebrow">A clear starting point</p>
        <h2 id="public-path-title">Public discovery, private transaction workspaces</h2>
        <div className="public-feature-grid">
          <article><h3>Browse publicly</h3><p>Review approved public product information without signing in.</p></article>
          <article><h3>Work by role</h3><p>Buyer, Manufacturer, and Admin access continues to follow the approved account profile.</p></article>
          <article><h3>Keep context</h3><p>Marketplace and portal workspace URLs retain their existing query-based navigation.</p></article>
        </div>
      </section>
    </main>
  );
}

function AboutPage() {
  return (
    <main id="public-content" className="public-main public-document-page" tabIndex={-1}>
      <p className="eyebrow">About</p>
      <h1>Structured prefab home discovery</h1>
      <p>PrefabHome is a marketplace application for public product discovery and role-controlled trade preparation.</p>
      <section aria-labelledby="about-boundary"><h2 id="about-boundary">Current boundary</h2><p>The application supports internal marketplace workflows from product discovery through logistics planning. It does not represent carrier booking, payment processing, legal execution, or production deployment.</p></section>
      <section aria-labelledby="about-access"><h2 id="about-access">Access model</h2><p>Public pages require no account. Private portal access is determined by the authenticated database profile and existing authorization policies.</p></section>
    </main>
  );
}

function ContactPage() {
  return (
    <main id="public-content" className="public-main public-document-page" tabIndex={-1}>
      <p className="eyebrow">Contact</p>
      <h1>Contact PrefabHome</h1>
      <p>Contact details will be published before production launch.</p>
      <section aria-labelledby="contact-safety"><h2 id="contact-safety">Account and transaction support</h2><p>No private email, phone number, address, account identifier, or support credential is published by this release candidate.</p></section>
    </main>
  );
}

function VersionPage() {
  const release = safeReleaseDisplay(runtimeConfig.release);
  return (
    <main id="public-content" className="public-main public-document-page" tabIndex={-1}>
      <p className="eyebrow">Version</p>
      <h1>Application release information</h1>
      <dl className="public-release-metadata">
        <div><dt>Version</dt><dd>{release.version}</dd></div>
        <div><dt>Commit</dt><dd>{release.commit}</dd></div>
        <div><dt>Environment</dt><dd>{release.environment}</dd></div>
      </dl>
      <section aria-labelledby="release-notes-title"><h2 id="release-notes-title">Release notes</h2><p>Repository-defined release history is maintained in the project changelog and release documentation. This page exposes only non-sensitive build metadata.</p></section>
    </main>
  );
}

function NotFoundPage({ onNavigate }: Pick<PublicWebsiteProps, "onNavigate">) {
  return (
    <main id="public-content" className="public-main public-document-page public-not-found" tabIndex={-1}>
      <p className="eyebrow">404</p>
      <h1>Public page not found</h1>
      <p>The requested public page is not available. No portal or account information was exposed.</p>
      <PublicLink path="/" onNavigate={onNavigate}>Return to Home</PublicLink>
    </main>
  );
}

export function PublicWebsite({ page, onNavigate }: PublicWebsiteProps) {
  const previousPage = useRef(page);

  useEffect(() => {
    applyPublicPageMetadata(page, runtimeConfig.publicSiteUrl ?? "https://example.invalid");
    if (previousPage.current !== page) {
      document.getElementById("public-content")?.focus({ preventScroll: true });
    }
    previousPage.current = page;
  }, [page]);

  return (
    <div className="public-shell">
      <a className="skip-link" href="#public-content">Skip to main content</a>
      <PublicHeader activePage={page} onNavigate={onNavigate} />
      {page === "home" && <HomePage onNavigate={onNavigate} />}
      {page === "about" && <AboutPage />}
      {page === "contact" && <ContactPage />}
      {page === "version" && <VersionPage />}
      {page === "not-found" && <NotFoundPage onNavigate={onNavigate} />}
      <footer className="public-footer">
        <p>PrefabHome Marketplace public website foundation.</p>
        <PublicLink path="/version" onNavigate={onNavigate}>Version information</PublicLink>
      </footer>
    </div>
  );
}
