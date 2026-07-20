import React from "react";
import { publicOperator } from "../../lib/publicOperator";
import { publicHeaderPages, type PublicPage } from "../../lib/publicSite";
import { PublicLink } from "../public/PublicLink";

interface PublicHeaderProps {
  activePage: PublicPage;
  onNavigate: (path: string) => void;
}

export function PublicHeader({ activePage, onNavigate }: PublicHeaderProps) {
  return (
    <header className="public-header">
      <PublicLink
        className="public-brand"
        path="/"
        onNavigate={onNavigate}
        ariaLabel={`${publicOperator.operatorDisplayName} home`}
      >
        <img src="/favicon.svg" alt="" width="40" height="40" decoding="async" />
        <span>{publicOperator.operatorDisplayName}</span>
      </PublicLink>
      <nav className="public-navigation" aria-label="Public website">
        {publicHeaderPages.map((page) => (
          <PublicLink
            key={page.id}
            path={page.path}
            current={activePage === page.id}
            onNavigate={onNavigate}
          >
            {page.label}
          </PublicLink>
        ))}
        <PublicLink
          className="public-portal-link"
          path="/marketplace"
          onNavigate={onNavigate}
        >
          Marketplace
        </PublicLink>
      </nav>
    </header>
  );
}
