import assert from "node:assert/strict";
import test from "node:test";
import {
  PUBLIC_OPERATOR_PLACEHOLDER,
  publicContactCategories,
  publicOperator,
  unresolvedPublicOperatorFields,
} from "./publicOperator";

test("public operator defaults contain nine non-interactive approval placeholders", () => {
  assert.equal(publicContactCategories.length, 9);
  assert.ok(publicContactCategories.every((contact) => contact.href === null));
  assert.ok(publicContactCategories.every((contact) => contact.displayValue === PUBLIC_OPERATOR_PLACEHOLDER));
  assert.equal(publicOperator.publicationStatus, "pending-operator-approval");
  assert.ok(unresolvedPublicOperatorFields().length > 0);
});

test("public operator configuration contains no contact value or credential", () => {
  const serialized = JSON.stringify(publicOperator);
  assert.doesNotMatch(serialized, /mailto:|tel:|access[_-]?token|refresh[_-]?token|password/i);
  assert.doesNotMatch(serialized, /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/);
  assert.doesNotMatch(serialized, /\b(?:\+?\d[\d(). -]{7,}\d)\b/);
});
