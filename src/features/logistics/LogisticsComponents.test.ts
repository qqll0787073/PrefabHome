import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PortalWorkspaceNavigation } from "../dashboard/PortalWorkspaceNavigation";
import { AdminLogisticsWorkspace } from "./AdminLogisticsWorkspace";
import { LogisticsActionDialog } from "./LogisticsActionDialog";
import { ParticipantLogisticsWorkspace } from "./ParticipantLogisticsWorkspace";

test("renders role-aware workspace navigation with current-page semantics", () => {
  const markup = renderToStaticMarkup(createElement(PortalWorkspaceNavigation, {
    role: "buyer",
    workspace: "logistics",
    onWorkspaceChange: () => undefined,
  }));
  assert.match(markup, /aria-label="buyer portal workspaces"/);
  assert.match(markup, /aria-current="page"[^>]*>Logistics/);
  assert.doesNotMatch(markup, />Users</);
});

test("renders accessible logistics confirmation dialog labels", () => {
  const markup = renderToStaticMarkup(createElement(LogisticsActionDialog, {
    open: true,
    title: "Cancel provider selection",
    description: "Return the request to provider options.",
    confirmLabel: "Cancel selection",
    reasonLabel: "Cancellation reason",
    reasonRequired: true,
    reason: "",
    isSaving: false,
    returnFocusTo: null,
    onReasonChange: () => undefined,
    onConfirm: () => undefined,
    onClose: () => undefined,
  }));
  assert.match(markup, /role="dialog"/);
  assert.match(markup, /aria-modal="true"/);
  assert.match(markup, /Cancellation reason \(required\)/);
  assert.match(markup, /required=""/);
});

test("shows truthful participant and Admin demo states without synthetic logistics data", () => {
  const participant = renderToStaticMarkup(createElement(ParticipantLogisticsWorkspace, {
    authMode: "demo",
    role: "buyer",
    selectedRequestId: null,
    onSelectedRequestChange: () => undefined,
  }));
  const admin = renderToStaticMarkup(createElement(AdminLogisticsWorkspace, {
    authMode: "demo",
    selectedRequestId: null,
    onSelectedRequestChange: () => undefined,
  }));
  assert.match(participant, /does not create synthetic booking requests/i);
  assert.match(admin, /No synthetic request queue/i);
  assert.doesNotMatch(`${participant}${admin}`, /BKR-\d/);
});
