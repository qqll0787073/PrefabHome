import React, { useEffect, useRef } from "react";
import { PublicHeader } from "../../components/layout/PublicHeader";
import { LegalDocumentPage } from "../../components/public/LegalDocumentPage";
import { PublicFooter } from "../../components/public/PublicFooter";
import { PublicLink } from "../../components/public/PublicLink";
import { PublicStatusPage } from "../../components/public/PublicStatusPage";
import { legalDocumentForPage, legalPublicationLabel } from "../../lib/legalDocuments";
import {
  operatorPublicationLabel,
  publicContactCategories,
  publicOperator,
} from "../../lib/publicOperator";
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

function HomePage({ onNavigate }: Pick<PublicWebsiteProps, "onNavigate">) {
  return (
    <main id="public-content" className="public-main" tabIndex={-1}>
      <section className="public-home-hero" aria-labelledby="home-title">
        <div className="public-home-copy">
          <p className="eyebrow">Public marketplace foundation</p>
          <h1 id="home-title">{publicOperator.operatorDisplayName}</h1>
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
      <h1>Contact {publicOperator.operatorDisplayName}</h1>
      <p>Public contact channels will be activated before production launch after operator, ownership, monitoring, privacy, accessibility, and legal review.</p>
      <section aria-labelledby="contact-categories-title">
        <h2 id="contact-categories-title">Contact categories</h2>
        <div className="public-contact-grid">
          {publicContactCategories.map((contact) => (
            <article key={contact.category}>
              <h3>{contact.label}</h3>
              <p><strong>Intended owner:</strong> {contact.owner}</p>
              <p><strong>Channel:</strong> {contact.displayValue}</p>
              <p>{contact.note}</p>
            </article>
          ))}
        </div>
      </section>
      <section aria-labelledby="contact-safety">
        <h2 id="contact-safety">Pre-launch safety boundary</h2>
        <p>No public form sends data, no placeholder is a monitored channel, and no response time is promised. Do not send account, transaction, legal, privacy, accessibility, or security-incident information to an unapproved channel.</p>
      </section>
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
        <div><dt>Release candidate</dt><dd>{release.releaseCandidate}</dd></div>
        <div><dt>Build timestamp</dt><dd>{release.buildTimestamp}</dd></div>
        <div><dt>Artifact checksum</dt><dd>{release.artifactChecksum}</dd></div>
        <div><dt>Legal publication</dt><dd>{legalPublicationLabel()}</dd></div>
        <div><dt>Operator publication</dt><dd>{operatorPublicationLabel()}</dd></div>
        <div><dt>Deployment authorization</dt><dd>Not granted</dd></div>
      </dl>
      <section aria-labelledby="release-notes-title"><h2 id="release-notes-title">Release notes</h2><p>Repository-defined release history is maintained in the project changelog and release documentation. This page exposes only allowlisted non-sensitive build and publication metadata. Build status does not grant legal publication or production deployment.</p></section>
    </main>
  );
}

export function PublicWebsite({ page, onNavigate }: PublicWebsiteProps) {
  const previousPage = useRef(page);
  const legalDocument = legalDocumentForPage(page);

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
      {legalDocument && <LegalDocumentPage document={legalDocument} />}
      {page === "not-found" && <PublicStatusPage status={404} onNavigate={onNavigate} />}
      <PublicFooter activePage={page} onNavigate={onNavigate} />
    </div>
  );
}
