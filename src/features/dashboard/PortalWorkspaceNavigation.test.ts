import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PortalWorkspaceNavigation } from "./PortalWorkspaceNavigation";

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
    assert.doesNotMatch(markup, />Manufacturers<\/a>/);
  }
});
