import React from "react";
import type { LegalDocumentDefinition } from "../../lib/legalDocuments";
import { publicContactCategories } from "../../lib/publicOperator";

interface LegalDocumentPageProps {
  document: LegalDocumentDefinition;
}

export function LegalDocumentPage({ document }: LegalDocumentPageProps) {
  const contact = publicContactCategories.find((candidate) => candidate.category === document.contactCategory);
  return (
    <main id="public-content" className="public-main public-document-page legal-document-page" tabIndex={-1}>
      <p className="eyebrow">Public legal document</p>
      <h1>{document.documentTitle}</h1>
      <aside className="legal-draft-banner" role="status" aria-label="Document publication status">
        <strong>{document.draftWarning}</strong>
        <span>This document is not effective until approved and published by the operator.</span>
      </aside>
      <dl className="legal-document-metadata">
        <div><dt>Version</dt><dd>{document.version}</dd></div>
        <div><dt>Effective date</dt><dd>{document.effectiveDate ?? "Pending approval"}</dd></div>
        <div><dt>Last reviewed</dt><dd>{document.lastReviewedDate ?? "Pending legal review"}</dd></div>
        <div><dt>Review status</dt><dd>{document.reviewStatus.replaceAll("-", " ")}</dd></div>
        <div><dt>Approver</dt><dd>{document.approverPlaceholder}</dd></div>
        <div><dt>Jurisdiction</dt><dd>{document.jurisdictionPlaceholder}</dd></div>
      </dl>
      {document.sections.map((section, index) => {
        const headingId = `${document.slug}-section-${index + 1}`;
        return (
          <section key={section.heading} aria-labelledby={headingId}>
            <h2 id={headingId}>{section.heading}</h2>
            {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            {section.bullets && <ul>{section.bullets.map((item) => <li key={item}>{item}</li>)}</ul>}
          </section>
        );
      })}
      <section aria-labelledby={`${document.slug}-contact`}>
        <h2 id={`${document.slug}-contact`}>Document contact</h2>
        <p>{contact?.label ?? "Public contact"}: {contact?.displayValue ?? "Pending operator approval"}</p>
        <p>This placeholder is not a monitored or legally approved notice channel.</p>
      </section>
    </main>
  );
}
