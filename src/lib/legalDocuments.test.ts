import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LegalDocumentPage } from "../components/public/LegalDocumentPage";
import { legalDocuments, unresolvedLegalDocuments } from "./legalDocuments";

const expectedPaths = [
  "/privacy",
  "/terms",
  "/cookies",
  "/accessibility",
  "/acceptable-use",
  "/copyright-trademark",
];

test("required legal documents remain draft, versioned, and pending review", () => {
  assert.deepEqual(legalDocuments.map((document) => document.path), expectedPaths);
  assert.ok(legalDocuments.every((document) => document.version === "0.1-draft"));
  assert.ok(legalDocuments.every((document) => document.reviewStatus === "pending-legal-review"));
  assert.ok(legalDocuments.every((document) => document.effectiveDate === null));
  assert.ok(unresolvedLegalDocuments().length > 0);
});

test("every legal page renders its warning, metadata, one heading, and no interactive consent", () => {
  for (const document of legalDocuments) {
    const markup = renderToStaticMarkup(createElement(LegalDocumentPage, { document }));
    assert.equal((markup.match(/<h1(?:\s|>)/g) ?? []).length, 1);
    assert.match(markup, /Draft - Pending legal review/);
    assert.match(markup, /not effective until approved and published/i);
    assert.match(markup, /0\.1-draft/);
    assert.doesNotMatch(markup, /<form|type="checkbox"|I accept/i);
  }
});
