import type { ReleaseMetadata } from "./runtimeConfig";

export type PublicPage = "home" | "about" | "contact" | "version" | "not-found";

export interface PublicPageDefinition {
  id: Exclude<PublicPage, "not-found">;
  label: string;
  path: string;
  title: string;
  description: string;
}

export type ApplicationLocation =
  | { kind: "public"; page: PublicPage }
  | { kind: "portal" };

export const publicPages: PublicPageDefinition[] = [
  {
    id: "home",
    label: "Home",
    path: "/",
    title: "PrefabHome Marketplace",
    description: "Explore PrefabHome's public marketplace foundation and enter the Buyer, Manufacturer, or Admin portal.",
  },
  {
    id: "about",
    label: "About",
    path: "/about",
    title: "About | PrefabHome Marketplace",
    description: "Learn how PrefabHome connects public product discovery with role-controlled marketplace workflows.",
  },
  {
    id: "contact",
    label: "Contact",
    path: "/contact",
    title: "Contact | PrefabHome Marketplace",
    description: "Find the current public contact status for PrefabHome Marketplace.",
  },
  {
    id: "version",
    label: "Version",
    path: "/version",
    title: "Version | PrefabHome Marketplace",
    description: "View non-sensitive PrefabHome application release metadata and repository-defined release notes.",
  },
];

const publicPageByPath = new Map(publicPages.map((page) => [page.path, page.id]));

export function readApplicationLocation(pathname: string, search: string): ApplicationLocation {
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, "") : "/";
  const hasLegacyPortalView = new URLSearchParams(search).has("view");
  if (normalizedPath === "/marketplace" || (normalizedPath === "/" && hasLegacyPortalView)) {
    return { kind: "portal" };
  }
  return {
    kind: "public",
    page: publicPageByPath.get(normalizedPath) ?? "not-found",
  };
}

export function normalizePublicSiteUrl(
  value: string | undefined,
  production = false,
): { value: string | null; error: string | null } {
  const raw = value?.trim() ?? "";
  if (!raw) {
    return production
      ? { value: null, error: "A public site URL is required for production." }
      : { value: "http://localhost:5173", error: null };
  }

  try {
    const url = new URL(raw);
    if (!new Set(["http:", "https:"]).has(url.protocol) || !url.hostname) {
      return { value: null, error: "The public site URL must use HTTP or HTTPS." };
    }
    if (url.username || url.password) {
      return { value: null, error: "The public site URL must not contain credentials." };
    }
    if (url.search || url.hash) {
      return { value: null, error: "The public site URL must not contain a query string or fragment." };
    }
    if (production && url.protocol !== "https:") {
      return { value: null, error: "The production public site URL must use HTTPS." };
    }
    if (production && ["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
      return { value: null, error: "The production public site URL must not use localhost." };
    }
    return { value: url.toString().replace(/\/$/, ""), error: null };
  } catch {
    return { value: null, error: "The public site URL must be a valid absolute URL." };
  }
}

export function publicPageDefinition(page: PublicPage): PublicPageDefinition | null {
  return publicPages.find((candidate) => candidate.id === page) ?? null;
}

export function publicPageMetadata(page: PublicPage, publicSiteUrl: string) {
  const definition = publicPageDefinition(page);
  const base = publicSiteUrl.replace(/\/$/, "");
  const path = definition?.path ?? "/not-found";
  return {
    title: definition?.title ?? "Page Not Found | PrefabHome Marketplace",
    description: definition?.description ?? "The requested PrefabHome public page could not be found.",
    canonicalUrl: `${base}${path === "/" ? "/" : path}`,
    imageUrl: `${base}/og-image.svg`,
    robots: page === "not-found" ? "noindex, nofollow" : "index, follow",
  };
}

function setNamedMeta(name: string, content: string) {
  document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.setAttribute("content", content);
}

function setPropertyMeta(property: string, content: string) {
  document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`)?.setAttribute("content", content);
}

export function applyPublicPageMetadata(page: PublicPage, publicSiteUrl: string) {
  const metadata = publicPageMetadata(page, publicSiteUrl);
  document.title = metadata.title;
  document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute("href", metadata.canonicalUrl);
  setNamedMeta("description", metadata.description);
  setNamedMeta("robots", metadata.robots);
  setNamedMeta("twitter:title", metadata.title);
  setNamedMeta("twitter:description", metadata.description);
  setNamedMeta("twitter:image", metadata.imageUrl);
  setPropertyMeta("og:title", metadata.title);
  setPropertyMeta("og:description", metadata.description);
  setPropertyMeta("og:image", metadata.imageUrl);
  setPropertyMeta("og:url", metadata.canonicalUrl);
}

export function applyPortalMetadata() {
  document.title = "Portal | PrefabHome Marketplace";
  setNamedMeta("robots", "noindex, nofollow");
}

export function safeReleaseDisplay(release: ReleaseMetadata) {
  const commit = /^[0-9a-f]{40}$/i.test(release.commitSha) ? release.commitSha.slice(0, 12) : "unavailable";
  return {
    version: release.appVersion === "development" ? "Development build" : release.appVersion,
    commit,
    environment: release.environment,
  };
}
