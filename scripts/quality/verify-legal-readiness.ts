import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { legalDocuments, unresolvedLegalDocuments } from "../../src/lib/legalDocuments";
import {
  PUBLIC_OPERATOR_PLACEHOLDER,
  publicContactCategories,
  publicOperator,
  unresolvedPublicOperatorFields,
} from "../../src/lib/publicOperator";
import { publicFooterPages, publicPageMetadata, publicPages, readApplicationLocation } from "../../src/lib/publicSite";
import { publicStatusPages } from "../../src/lib/publicStatusPages";

const requiredLegalPages = [
  "privacy",
  "terms",
  "cookies",
  "accessibility",
  "acceptable-use",
  "copyright-trademark",
];
const requiredContactCategories = [
  "general",
  "buyer-support",
  "manufacturer-onboarding",
  "sales",
  "partnerships",
  "accessibility",
  "privacy",
  "legal",
  "press",
];
const requiredStatusCodes = [401, 403, 404, 429, 500, 503];
const placeholderPattern = /pending|placeholder|not granted|not supplied|\{\{|<[^>]+>/i;
const privateValuePattern = /(?:mailto:|tel:|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\b(?:\+?\d[\d(). -]{7,}\d)\b)/i;

function isIsoDate(value: string | null): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function sitemapLocations(root: string): string[] {
  const sitemap = readFileSync(resolve(root, "public/sitemap.xml"), "utf8");
  return [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]).pathname);
}

export function verifyLegalStructure(root = process.cwd()): string[] {
  const errors: string[] = [];
  const pages = new Set<string>(legalDocuments.map((document) => document.pageId));
  const paths = new Set(legalDocuments.map((document) => document.path));
  const slugs = new Set(legalDocuments.map((document) => document.slug));
  const contacts = new Set<string>(publicContactCategories.map((contact) => contact.category));
  const publicPageIds = new Set<string>(publicPages.map((page) => page.id));
  const footerPageIds = new Set<string>(publicFooterPages.map((page) => page.id));

  if (legalDocuments.length !== requiredLegalPages.length) errors.push("Legal document inventory must contain exactly six required pages.");
  if (paths.size !== legalDocuments.length || slugs.size !== legalDocuments.length) errors.push("Legal document paths and slugs must be unique.");
  for (const page of requiredLegalPages) {
    if (!pages.has(page)) errors.push(`Missing legal document: ${page}.`);
    if (!publicPageIds.has(page)) errors.push(`Missing public route: ${page}.`);
    if (!footerPageIds.has(page)) errors.push(`Missing public footer link: ${page}.`);
  }
  for (const category of requiredContactCategories) {
    if (!contacts.has(category)) errors.push(`Missing public contact category: ${category}.`);
  }
  for (const code of requiredStatusCodes) {
    if (!(code in publicStatusPages)) errors.push(`Missing public status-page model: ${code}.`);
  }

  for (const document of legalDocuments) {
    if (!document.documentTitle || !document.slug || !document.version) errors.push(`${document.pageId} metadata is incomplete.`);
    if (document.reviewStatus !== "approved-for-publication" && (!document.draftWarning || !/draft/i.test(document.draftWarning))) {
      errors.push(`${document.pageId} must display a draft warning while review is pending.`);
    }
    if (document.reviewStatus === "approved-for-publication" && document.draftWarning) errors.push(`${document.pageId} cannot be approved while a draft warning remains.`);
    if (document.sections.length < 3 || document.sections.some((section) => !section.heading || section.paragraphs.length === 0)) {
      errors.push(`${document.pageId} requires structured plain-language sections.`);
    }
    const expectedRobots = document.reviewStatus === "approved-for-publication" ? "index, follow" : "noindex, nofollow";
    if (publicPageMetadata(document.pageId, "https://example.invalid").robots !== expectedRobots) {
      errors.push(`${document.pageId} indexing does not match review status.`);
    }
  }

  const operatorSerialized = JSON.stringify(publicOperator);
  if (privateValuePattern.test(operatorSerialized)) errors.push("Public operator placeholders must not contain email addresses or phone numbers.");
  if (!operatorSerialized.includes(PUBLIC_OPERATOR_PLACEHOLDER)) errors.push("Public operator defaults must use an obvious placeholder.");
  if (/[<>\u0000-\u001F]/.test(operatorSerialized)) errors.push("Public operator data must not contain HTML or control characters.");
  for (const channel of publicContactCategories) {
    if (channel.publicationStatus !== "approved-for-publication" && channel.href !== null) {
      errors.push(`${channel.label} must not be clickable before approval.`);
    }
  }

  const locations = sitemapLocations(root);
  for (const document of legalDocuments) {
    if (document.reviewStatus !== "approved-for-publication" && locations.includes(document.path)) {
      errors.push(`${document.path} must remain outside the sitemap while draft.`);
    }
  }
  if (readApplicationLocation("/marketplace", "?view=dashboard").kind !== "portal") errors.push("Marketplace routing boundary changed.");
  if (readApplicationLocation("/", "?view=dashboard").kind !== "portal") errors.push("Legacy portal routing boundary changed.");

  for (const file of [
    "src/components/public/LegalDocumentPage.tsx",
    "src/components/public/PublicFooter.tsx",
    "src/components/public/PublicStatusPage.tsx",
    "docs/LEGAL_AND_PUBLIC_OPERATIONS_GUIDE.md",
    "docs/LEGAL_REVIEW_CHECKLIST.md",
    "docs/PUBLIC_CONTACT_AND_SUPPORT_MODEL.md",
  ]) {
    if (!existsSync(resolve(root, file))) errors.push(`Missing legal/public operations file: ${file}.`);
  }
  return errors;
}

export function verifyLegalPublication(root = process.cwd()): string[] {
  const errors = [...verifyLegalStructure(root)];
  errors.push(...unresolvedPublicOperatorFields());
  errors.push(...unresolvedLegalDocuments());

  for (const document of legalDocuments) {
    if (document.reviewStatus !== "approved-for-publication") continue;
    if (!isIsoDate(document.effectiveDate)) errors.push(`${document.documentTitle} effective date is invalid.`);
    if (!isIsoDate(document.lastReviewedDate)) errors.push(`${document.documentTitle} last reviewed date is invalid.`);
    if (document.draftWarning.trim()) errors.push(`${document.documentTitle} draft warning remains.`);
    if (placeholderPattern.test(`${document.approverPlaceholder} ${document.jurisdictionPlaceholder}`)) {
      errors.push(`${document.documentTitle} contains unresolved approval placeholders.`);
    }
    if (publicPageMetadata(document.pageId, "https://example.invalid").robots !== "index, follow") {
      errors.push(`${document.documentTitle} indexing does not match approval status.`);
    }
  }

  if (publicOperator.publicationStatus === "approved-for-publication") {
    const operatorRequiredValues = [
      publicOperator.operatorDisplayName,
      publicOperator.legalEntityName,
      publicOperator.jurisdiction,
      publicOperator.businessAddress,
      publicOperator.supportHours,
      publicOperator.effectiveDate ?? "",
    ];
    if (operatorRequiredValues.some((value) => !value || placeholderPattern.test(value))) {
      errors.push("Approved operator identity still contains unresolved values.");
    }
    if (!isIsoDate(publicOperator.effectiveDate)) errors.push("Operator effective date is invalid.");
    for (const channel of publicContactCategories) {
      if (channel.publicationStatus !== "approved-for-publication" || !channel.href || placeholderPattern.test(channel.displayValue)) {
        errors.push(`${channel.label} is not approved for publication.`);
      }
    }
  }

  const locations = sitemapLocations(root);
  for (const document of legalDocuments) {
    if (document.reviewStatus === "approved-for-publication" && !locations.includes(document.path)) {
      errors.push(`${document.path} is approved but missing from the sitemap.`);
    }
  }
  return [...new Set(errors)];
}

function main() {
  const mode = process.argv.includes("--publication") ? "publication" : "structure";
  const errors = mode === "publication" ? verifyLegalPublication() : verifyLegalStructure();
  if (errors.length > 0) {
    if (mode === "publication") {
      console.error("Legal publication authorization is not granted.");
      console.error(`Unresolved approval checks: ${errors.length}.`);
    } else {
      console.error("Legal structure verification failed.");
      for (const error of errors) console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log(mode === "publication"
    ? "Legal publication structure is approved. Separate deployment authorization is still required."
    : `Legal structure verification passed (${legalDocuments.length} documents, ${publicContactCategories.length} contact categories, ${requiredStatusCodes.length} status models).`);
}

main();
