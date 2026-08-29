import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PortalWorkspaceNavigation,
  shouldHandleWorkspaceNavigation,
} from "./PortalWorkspaceNavigation";

const adminRoutes = [
  ["Dashboard", "overview"],
  ["Users", "users"],
  ["Manufacturers", "manufacturers"],
  ["Products", "products"],
  ["RFQs", "rfqs"],
] as const;

test("renders Admin workspace controls as direct dashboard routes", () => {
  const markup = renderToStaticMarkup(createElement(PortalWorkspaceNavigation, {
    role: "admin",
    workspace: "overview",
    onWorkspaceChange: () => undefined,
  }));

  for (const [label, workspace] of adminRoutes) {
    assert.match(
      markup,
      new RegExp(`href="/marketplace\\?view=dashboard&amp;workspace=${workspace}"[^>]*>${label}</a>`),
    );
  }
  assert.match(markup, /aria-current="page"[^>]*>Dashboard<\/a>/);
});

test("keeps Admin-only workspace routes out of other portal navigation", () => {
  for (const role of ["buyer", "manufacturer"] as const) {
    const markup = renderToStaticMarkup(createElement(PortalWorkspaceNavigation, {
      role,
      workspace: "overview",
      onWorkspaceChange: () => undefined,
    }));

    assert.doesNotMatch(markup, />Users<\/a>/);
    if (role === "manufacturer") assert.doesNotMatch(markup, />Manufacturers<\/a>/);
  }
});

test("renders the canonical Buyer Manufacturers navigation entry", () => {
  const markup = renderToStaticMarkup(createElement(PortalWorkspaceNavigation, { role: "buyer", workspace: "manufacturers", onWorkspaceChange: () => undefined }));
  assert.match(markup, /href="\/marketplace\?view=dashboard&amp;workspace=manufacturers"/);
  assert.match(markup, /aria-current="page"[^>]*>Manufacturers<\/a>/);
});

test("exposes Marketplace only as a persistent Buyer destination", () => {
  const buyer = renderToStaticMarkup(createElement(PortalWorkspaceNavigation, { role: "buyer", workspace: "overview", onWorkspaceChange: () => undefined }));
  const manufacturer = renderToStaticMarkup(createElement(PortalWorkspaceNavigation, { role: "manufacturer", workspace: "overview", onWorkspaceChange: () => undefined }));
  const admin = renderToStaticMarkup(createElement(PortalWorkspaceNavigation, { role: "admin", workspace: "overview", onWorkspaceChange: () => undefined }));
  assert.match(buyer, /href="\/marketplace\?view=browse"[^>]*>Marketplace<\/a>/);
  assert.doesNotMatch(manufacturer, />Marketplace<\/a>/);
  assert.doesNotMatch(admin, />Marketplace<\/a>/);
});

function navigationEvent(overrides: Record<string, unknown> = {}) {
  return {
    button: 0,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    currentTarget: {
      target: "",
      hasAttribute: () => false,
    },
    ...overrides,
  } as unknown as Parameters<typeof shouldHandleWorkspaceNavigation>[0];
}

test("intercepts only an unmodified primary workspace click", () => {
  assert.equal(shouldHandleWorkspaceNavigation(navigationEvent()), true);
});

test("preserves native behavior for modified and non-primary workspace clicks", () => {
  for (const overrides of [
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
    { altKey: true },
    { button: 1 },
    { button: 2 },
  ]) {
    assert.equal(shouldHandleWorkspaceNavigation(navigationEvent(overrides)), false);
  }
});

test("preserves native behavior for new-tab and download links", () => {
  assert.equal(shouldHandleWorkspaceNavigation(navigationEvent({
    currentTarget: { target: "_blank", hasAttribute: () => false },
  })), false);
  assert.equal(shouldHandleWorkspaceNavigation(navigationEvent({
    currentTarget: { target: "", hasAttribute: (name: string) => name === "download" },
  })), false);
});
