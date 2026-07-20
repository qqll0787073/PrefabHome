import {
  legalDocumentForPage,
  legalDocuments,
  type LegalPageId,
} from "./legalDocuments";
import type { ReleaseMetadata } from "./runtimeConfig";

export type PublicPage = "home" | "about" | "contact" | "version" | LegalPageId | "not-found";

export interface PublicPageDefinition {
  id: Exclude<PublicPage, "not-found">;
  label: string;
  path: string;
  title: string;
  description: string;
  navigation: "header" | "footer";
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
    navigation: "header",
  },
  {
    id: "about",
    label: "About",
    path: "/about",
    title: "About | PrefabHome Marketplace",
    description: "Learn how PrefabHome connects public product discovery with role-controlled marketplace workflows.",
    navigation: "header",
  },
  {
    id: "contact",
    label: "Contact",
    path: "/contact",
    title: "Contact | PrefabHome Marketplace",
    description: "Review public PrefabHome contact categories and their current pre-launch activation status.",
    navigation: "header",
  },
  {
    id: "version",
    label: "Version",
    path: "/version",
    title: "Version | PrefabHome Marketplace",
    description: "View non-sensitive PrefabHome application release metadata and repository-defined release notes.",
    navigation: "header",
  },
  ...legalDocuments.map((document): PublicPageDefinition => ({
    id: document.pageId,
    label: document.navigationLabel,
    path: document.path,
    title: `${document.documentTitle} | PrefabHome Marketplace`,
    description: document.description,
    navigation: "footer",
  })),
];

export const publicHeaderPages = publicPages.filter((page) => page.navigation === "header");

const footerPageOrder: Exclude<PublicPage, "home" | "not-found">[] = [
  "about",
  "contact",
  "privacy",
  "terms",
  "cookies",
  "accessibility",
  "acceptable-use",
  "copyright-trademark",
  "version",
];

export const publicFooterPages = footerPageOrder.map((pageId) => {
  const page = publicPages.find((candidate) => candidate.id === pageId);
  if (!page) throw new Error(`Missing public footer page: ${pageId}`);
  return page;
});

const publicPageByPath = new Map(publicPages.map((page) => [page.path, page.id]));

export function readApplicationLocation(pathname: string, search: string): ApplicationLocation {
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, "") : "/";
  const hasLegacyPortalView = new URLSearchParams(search).has("view");
  if (
    normalizedPath === "/marketplace" ||
    normalizedPath.startsWith("/products/") ||
    (normalizedPath === "/" && hasLegacyPortalView)
  ) {
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
  const legalDocument = legalDocumentForPage(page);
  const base = publicSiteUrl.replace(/\/$/, "");
  const path = definition?.path ?? "/not-found";
  return {
    title: definition?.title ?? "Page Not Found | PrefabHome Marketplace",
    description: definition?.description ?? "The requested PrefabHome public page could not be found.",
    canonicalUrl: `${base}${path === "/" ? "/" : path}`,
    imageUrl: `${base}/og-image.svg`,
    robots: page === "not-found" || (legalDocument && legalDocument.reviewStatus !== "approved-for-publication")
      ? "noindex, nofollow"
      : "index, follow",
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
    releaseCandidate: /(?:^|[._+-])rc\d*(?:$|[._+-])/i.test(release.appVersion)
      || /release-candidate/i.test(release.appVersion)
      ? "Release candidate"
      : "Not designated",
    buildTimestamp: "Not supplied",
    artifactChecksum: "Not supplied",
  };
}
