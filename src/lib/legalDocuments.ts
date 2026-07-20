import type { PublicContactCategory } from "./publicOperator";

export type LegalReviewStatus =
  | "draft"
  | "pending-legal-review"
  | "approved-for-publication";

export type LegalPageId =
  | "privacy"
  | "terms"
  | "cookies"
  | "accessibility"
  | "acceptable-use"
  | "copyright-trademark";

export interface LegalDocumentSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface LegalDocumentDefinition {
  pageId: LegalPageId;
  documentTitle: string;
  navigationLabel: string;
  slug: string;
  path: string;
  description: string;
  version: string;
  effectiveDate: string | null;
  lastReviewedDate: string | null;
  reviewStatus: LegalReviewStatus;
  approverPlaceholder: string;
  jurisdictionPlaceholder: string;
  draftWarning: string;
  contactCategory: PublicContactCategory;
  sections: LegalDocumentSection[];
}

const sharedDraftMetadata = {
  version: "0.1-draft",
  effectiveDate: null,
  lastReviewedDate: null,
  reviewStatus: "pending-legal-review" as const,
  approverPlaceholder: "Pending legal counsel approval",
  jurisdictionPlaceholder: "Pending jurisdiction and governing-law review",
  draftWarning: "Draft - Pending legal review",
};

export const legalDocuments: LegalDocumentDefinition[] = [
  {
    ...sharedDraftMetadata,
    pageId: "privacy",
    documentTitle: "Privacy Notice",
    navigationLabel: "Privacy",
    slug: "privacy-notice",
    path: "/privacy",
    description: "Review the draft PrefabHome Privacy Notice, pending operator and legal approval.",
    contactCategory: "privacy",
    sections: [
      {
        heading: "Purpose and current status",
        paragraphs: [
          "This draft describes the kinds of information the PrefabHome website and marketplace may handle. It is not effective, complete, or approved for publication.",
          "The final operator identity, legal basis, jurisdiction, retention rules, and request process require operator and legal review.",
        ],
      },
      {
        heading: "Public website data",
        paragraphs: ["Public visits may involve standard browser requests, device and connection information, requested pages, and security-related logs. Optional analytics or advertising vendors are not integrated in this sprint and would require separate approval and notice."],
      },
      {
        heading: "Accounts and authentication",
        paragraphs: ["Account workflows may process identifiers, profile names, email addresses, authentication/session information, approved roles, and account status. Database-controlled profiles and authorization policies determine portal access."],
      },
      {
        heading: "Marketplace and transaction workflows",
        paragraphs: ["Buyer, Manufacturer, and Admin workflows may contain product, RFQ, message, quote, purchase order, contract preparation, invoice, payment-recording, shipping-readiness, and logistics-planning information. Final purposes, notices, retention, and deletion rules remain pending review."],
      },
      {
        heading: "Uploaded and product media",
        paragraphs: ["Manufacturers and authorized operators may provide product images and documents. Private Storage and signed access controls remain separate from this public notice; content rights, retention, and removal processes require final policy review."],
      },
      {
        heading: "Infrastructure, logs, and security",
        paragraphs: ["Supabase currently provides application infrastructure for authentication, database, and Storage features. This public description does not disclose keys, project references, credentials, internal logs, or security configuration. Other infrastructure providers and processing terms require launch review."],
      },
      {
        heading: "Retention, deletion, and user choices",
        paragraphs: ["Retention periods, deletion standards, account closure, legal holds, correction, access, objection, and other choices are pending operator and legal policy. No request channel is active until the approved privacy contact is published."],
      },
      {
        heading: "Cross-border processing and minors",
        paragraphs: ["Cross-border processing, data-location disclosures, and safeguards require final legal review. Eligibility and any restrictions involving children or minors are also pending legal review; this draft does not invite minor use."],
      },
      {
        heading: "Sale, sharing, and contact",
        paragraphs: ["Any legal characterization of sale, sharing, targeted advertising, or similar activity requires a reviewed data and vendor inventory. The privacy contact shown below is a placeholder and is not yet a monitored request channel."],
      },
    ],
  },
  {
    ...sharedDraftMetadata,
    pageId: "terms",
    documentTitle: "Terms of Use",
    navigationLabel: "Terms",
    slug: "terms-of-use",
    path: "/terms",
    description: "Review the draft PrefabHome Terms of Use, pending operator and legal approval.",
    contactCategory: "legal",
    sections: [
      { heading: "Draft status and eligibility", paragraphs: ["These draft terms are not effective. Final age, authority, geographic, and account-eligibility requirements require legal and operator approval."] },
      { heading: "Accounts and role-based access", paragraphs: ["Users are expected to provide accurate account information, protect credentials, and use only their approved Buyer, Manufacturer, or Admin role. A portal selection never grants or overrides database-controlled access."] },
      { heading: "Buyer and Manufacturer responsibilities", paragraphs: ["Buyers are responsible for evaluating products, commercial terms, site conditions, permits, financing, logistics, and professional advice. Manufacturers are responsible for authorized, accurate, current listings, claims, specifications, certifications, pricing, capacity, and responses."] },
      { heading: "Content accuracy", paragraphs: ["Marketplace information may be incomplete, preliminary, supplied by third parties, or subject to change. Final verification duties, correction procedures, and reliance language require legal review."] },
      { heading: "Prohibited conduct", paragraphs: ["Users must not misuse accounts, bypass authorization, interfere with service, introduce malware, scrape beyond approved use, misrepresent identity or products, violate privacy or intellectual-property rights, or manipulate marketplace workflows."] },
      { heading: "Separate transaction workflows", paragraphs: ["RFQs, quotations, orders, contracts, invoices, payment records, shipping readiness, logistics, customs, import/export, and external provider work are separate workflows. They may require additional agreements, professional review, permits, taxes, insurance, and third-party terms."] },
      { heading: "Intellectual property", paragraphs: ["Platform-owned materials and user- or manufacturer-supplied content require distinct treatment. Final licenses, feedback rights, takedown procedures, and trademark rules require counsel review."] },
      { heading: "Suspension and termination", paragraphs: ["The platform may need to restrict access for security, policy, legal, or operational reasons. Final notice, appeal, preservation, and termination language is pending review and cannot be inferred from this draft."] },
      { heading: "Disclaimers and liability", paragraphs: ["Final warranty disclaimers, risk allocation, remedies, exclusions, liability limits, and consumer-law exceptions require legal approval. No limitation or waiver in this draft is effective."] },
      { heading: "Disputes, changes, and contact", paragraphs: ["Governing law, venue, dispute process, notice, amendment procedure, and the legal contact are unresolved placeholders pending counsel and operator approval."] },
    ],
  },
  {
    ...sharedDraftMetadata,
    pageId: "cookies",
    documentTitle: "Cookie and Tracking Notice",
    navigationLabel: "Cookie Notice",
    slug: "cookie-tracking-notice",
    path: "/cookies",
    description: "Review the draft PrefabHome Cookie and Tracking Notice, pending operator and legal approval.",
    contactCategory: "privacy",
    sections: [
      { heading: "Current technical behavior", paragraphs: ["The application may use browser storage, session information, or similar essential technology for Supabase authentication, security, navigation, and user-requested marketplace functions. The final inventory, names, duration, and classification require review."] },
      { heading: "Analytics and advertising", paragraphs: ["Analytics, advertising, session-replay, and tracking vendors are not integrated in this sprint. Any future proposal requires privacy, security, legal, and operator approval before code or public claims change."] },
      { heading: "Essential and optional technologies", paragraphs: ["Essential authentication or security storage is different from optional measurement or advertising technology. Final classifications and user-choice requirements depend on the approved implementation and applicable law."] },
      { heading: "Consent and choices", paragraphs: ["A consent platform may be required before optional technologies are enabled. This sprint does not select a vendor, display a consent prompt, store consent, or claim that consent is unnecessary."] },
      { heading: "Pending cookie inventory", paragraphs: ["The publication candidate must identify each approved technology, provider, purpose, data category, duration, first- or third-party status, and available control. That inventory is pending."] },
      { heading: "Contact", paragraphs: ["The privacy contact is a placeholder until a monitored organization-controlled channel is approved."] },
    ],
  },
  {
    ...sharedDraftMetadata,
    pageId: "accessibility",
    documentTitle: "Accessibility Statement",
    navigationLabel: "Accessibility",
    slug: "accessibility-statement",
    path: "/accessibility",
    description: "Review the draft PrefabHome Accessibility Statement, pending operator and accessibility review.",
    contactCategory: "accessibility",
    sections: [
      { heading: "Engineering objective", paragraphs: ["PrefabHome uses WCAG 2.2 Level AA as an engineering objective. This is not a certification, full-conformance claim, legal conclusion, or statement that every user can complete every workflow without a barrier."] },
      { heading: "Verification completed", paragraphs: ["Repository checks cover semantic landmarks, main targets, headings, skip links, focus rules, image alternatives, form labels, reduced motion, forced colors, responsive reflow, and selected local browser interactions."] },
      { heading: "Manual review still required", paragraphs: ["Screen-reader workflows, actual browser and text zoom, keyboard operation through authenticated roles, contrast, text spacing, platform high contrast, mobile devices, orientation, cognitive usability, and representative-user testing remain required."] },
      { heading: "Known limitations", paragraphs: ["The application is still a release candidate. Legal content, contact channels, production hosting, authenticated end-to-end accessibility, third-party content, and real-device coverage are not final."] },
      { heading: "Report a barrier", paragraphs: ["An approved accessibility channel will describe how to report a barrier and what information is useful. The current placeholder is not monitored and no response time is promised."] },
      { heading: "Ongoing review", paragraphs: ["Accessibility work requires continued design, engineering, content, procurement, quality, and user feedback after launch. Final ownership and review cadence require operator approval."] },
    ],
  },
  {
    ...sharedDraftMetadata,
    pageId: "acceptable-use",
    documentTitle: "Acceptable Use Policy",
    navigationLabel: "Acceptable Use",
    slug: "acceptable-use-policy",
    path: "/acceptable-use",
    description: "Review the draft PrefabHome Acceptable Use Policy, pending operator and legal approval.",
    contactCategory: "legal",
    sections: [
      { heading: "Purpose and status", paragraphs: ["This draft identifies conduct the marketplace is expected to prohibit. Enforcement standards, notices, appeals, exceptions, and legal wording require approval before the policy is effective."] },
      {
        heading: "Prohibited activity",
        paragraphs: ["Users must not use PrefabHome to harm others, evade controls, or undermine marketplace integrity."],
        bullets: [
          "Unlawful activity, fraud, deceptive listings, impersonation, or false account information",
          "Unauthorized access, credential abuse, security testing without approval, malware, or service interference",
          "Abusive automation, denial of service, or scraping beyond approved use",
          "Privacy violations, harassment, threats, or disclosure of another person's private information",
          "Misleading product, performance, sustainability, safety, code, or certification claims",
          "Sanctions, customs, import, export, or export-control evasion",
          "Marketplace manipulation, collusion, fabricated reviews, or interference with fair transactions",
          "Unauthorized use of third-party copyrights, trademarks, designs, images, documents, or confidential material",
        ],
      },
      { heading: "Reporting and enforcement", paragraphs: ["Reporting channels, evidence handling, investigation, restrictions, preservation, appeals, and law-enforcement response are pending Security, Operations, and Legal review. The public legal contact is not active."] },
    ],
  },
  {
    ...sharedDraftMetadata,
    pageId: "copyright-trademark",
    documentTitle: "Copyright and Trademark Notice",
    navigationLabel: "Copyright/Trademark",
    slug: "copyright-trademark-notice",
    path: "/copyright-trademark",
    description: "Review the draft PrefabHome Copyright and Trademark Notice, pending operator and legal approval.",
    contactCategory: "legal",
    sections: [
      { heading: "Platform materials", paragraphs: ["The final operator may own or license portions of the platform interface, original text, code, and brand materials. The exact legal entity, ownership, license scope, and notices require verification."] },
      { heading: "Manufacturer and user content", paragraphs: ["Product listings, images, plans, specifications, certifications, documents, and marks may be supplied by Manufacturers, Buyers, licensors, or other third parties. This draft does not claim platform ownership of that content."] },
      { heading: "Names and marks", paragraphs: ["Use of a name, logo, or product mark does not establish that it is registered or owned by the future operator. Trademark status and attribution must be verified before publication."] },
      { heading: "Infringement concerns", paragraphs: ["A neutral, monitored infringement contact and reviewed notice process are pending legal and operator approval. The current placeholder is not a formal notice or takedown channel."] },
      { heading: "No formal statutory process yet", paragraphs: ["This draft does not implement or claim a formal DMCA, counter-notice, or other statutory procedure. Counsel must determine applicable law, agent registration, required statements, records, and workflow before any such process is published."] },
    ],
  },
];

const legalDocumentByPageId = new Map(legalDocuments.map((document) => [document.pageId, document]));

export function legalDocumentForPage(pageId: string): LegalDocumentDefinition | null {
  return legalDocumentByPageId.get(pageId as LegalPageId) ?? null;
}

export function legalPublicationLabel(): string {
  return legalDocuments.every((document) => document.reviewStatus === "approved-for-publication")
    ? "Approved for publication"
    : "Draft legal documents pending review";
}

export function unresolvedLegalDocuments(): string[] {
  return legalDocuments.flatMap((document) => {
    const reasons = [];
    if (document.reviewStatus !== "approved-for-publication") reasons.push(`${document.documentTitle} review status`);
    if (!document.effectiveDate) reasons.push(`${document.documentTitle} effective date`);
    if (!document.lastReviewedDate) reasons.push(`${document.documentTitle} last reviewed date`);
    if (/pending/i.test(document.approverPlaceholder)) reasons.push(`${document.documentTitle} approver`);
    if (/pending/i.test(document.jurisdictionPlaceholder)) reasons.push(`${document.documentTitle} jurisdiction`);
    return reasons;
  });
}
