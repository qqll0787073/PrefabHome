import type { MouseEvent, ReactNode } from "react";

interface PublicLinkProps {
  path: string;
  onNavigate: (path: string) => void;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  current?: boolean;
}

export function shouldHandlePublicNavigation(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export function PublicLink({
  path,
  onNavigate,
  children,
  className,
  ariaLabel,
  current = false,
}: PublicLinkProps) {
  return (
    <a
      href={path}
      className={className}
      aria-label={ariaLabel}
      aria-current={current ? "page" : undefined}
      onClick={(event) => {
        if (!shouldHandlePublicNavigation(event)) return;
        event.preventDefault();
        onNavigate(path);
      }}
    >
      {children}
    </a>
  );
}
import React from "react";
