import React from "react";
import { publicStatusPage, type PublicStatusAction, type PublicStatusCode } from "../../lib/publicStatusPages";
import { PublicLink } from "./PublicLink";

interface PublicStatusPageProps {
  status: PublicStatusCode;
  onNavigate: (path: string) => void;
  onRetry?: () => void;
  onReload?: () => void;
}

const actionLabels: Record<PublicStatusAction, string> = {
  home: "Return to Home",
  marketplace: "Open Marketplace",
  retry: "Try again",
  reload: "Reload page",
};

export function PublicStatusPage({ status, onNavigate, onRetry, onReload }: PublicStatusPageProps) {
  const definition = publicStatusPage(status);
  return (
    <main id="public-content" className="public-main public-document-page public-status-page" tabIndex={-1}>
      <p className="eyebrow">{definition.status} - {definition.eyebrow}</p>
      <h1>{definition.heading}</h1>
      <p>{definition.summary}</p>
      <p>{definition.detail}</p>
      <div className="public-status-actions">
        {definition.actions.map((action) => {
          if (action === "home" || action === "marketplace") {
            return (
              <PublicLink
                key={action}
                path={action === "home" ? "/" : "/marketplace"}
                onNavigate={onNavigate}
              >
                {actionLabels[action]}
              </PublicLink>
            );
          }
          const handler = action === "retry" ? onRetry : onReload;
          return handler ? <button key={action} type="button" onClick={handler}>{actionLabels[action]}</button> : null;
        })}
      </div>
    </main>
  );
}
