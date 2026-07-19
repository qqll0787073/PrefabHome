import React from "react";
import { publicPages, type PublicPage } from "../../lib/publicSite";

interface PublicHeaderProps {
  activePage: PublicPage;
  onNavigate: (path: string) => void;
}

function shouldHandleNavigation(event: React.MouseEvent<HTMLAnchorElement>) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export function PublicHeader({ activePage, onNavigate }: PublicHeaderProps) {
  return (
    <header className="public-header">
      <a
        className="public-brand"
        href="/"
        onClick={(event) => {
          if (!shouldHandleNavigation(event)) return;
          event.preventDefault();
          onNavigate("/");
        }}
        aria-label="PrefabHome Marketplace home"
      >
        <img src="/favicon.svg" alt="" width="40" height="40" />
        <span>PrefabHome</span>
      </a>
      <nav className="public-navigation" aria-label="Public website">
        {publicPages.map((page) => (
          <a
            key={page.id}
            href={page.path}
            aria-current={activePage === page.id ? "page" : undefined}
            onClick={(event) => {
              if (!shouldHandleNavigation(event)) return;
              event.preventDefault();
              onNavigate(page.path);
            }}
          >
            {page.label}
          </a>
        ))}
        <a
          className="public-portal-link"
          href="/marketplace"
          onClick={(event) => {
            if (!shouldHandleNavigation(event)) return;
            event.preventDefault();
            onNavigate("/marketplace");
          }}
        >
          Marketplace
        </a>
      </nav>
    </header>
  );
}
