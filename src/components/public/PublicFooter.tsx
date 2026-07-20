import React from "react";
import { legalPublicationLabel } from "../../lib/legalDocuments";
import { publicOperator } from "../../lib/publicOperator";
import { publicFooterPages, type PublicPage } from "../../lib/publicSite";
import { PublicLink } from "./PublicLink";

interface PublicFooterProps {
  activePage: PublicPage;
  onNavigate: (path: string) => void;
}

export function PublicFooter({ activePage, onNavigate }: PublicFooterProps) {
  return (
    <footer className="public-footer">
      <div className="public-footer-identity">
        <strong>{publicOperator.operatorDisplayName}</strong>
        <span>Copyright {new Date().getUTCFullYear()}. Operator identity pending approval.</span>
        <span className="public-footer-draft">{legalPublicationLabel()}. Not effective until approved and published.</span>
      </div>
      <nav className="public-footer-navigation" aria-label="Public information and legal documents">
        {publicFooterPages.map((page) => (
          <PublicLink
            key={page.id}
            path={page.path}
            onNavigate={onNavigate}
            current={activePage === page.id}
          >
            {page.label}
          </PublicLink>
        ))}
      </nav>
    </footer>
  );
}
