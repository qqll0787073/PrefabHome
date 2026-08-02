import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConfirmationDialog } from "./ConfirmationDialog";

test("renders an accessible repository-owned destructive confirmation", () => {
  const html = renderToStaticMarkup(
    React.createElement(ConfirmationDialog, {
      open: true,
      title: "Cancel RFQ?",
      description: "Cancellation cannot be undone.",
      confirmLabel: "Cancel RFQ",
      onConfirm() {},
      onClose() {},
    }),
  );
  assert.match(html, /role="alertdialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /Cancel RFQ/);
  assert.match(html, /Keep Record/);
  assert.doesNotMatch(html, /window\.confirm/);
});
