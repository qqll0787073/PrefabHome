import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPortalSearch,
  defaultPortalWorkspace,
  isPortalWorkspaceForRole,
  normalizePortalWorkspace,
  portalWorkspaces,
  readPortalLocation,
} from "./portalNavigation";

test("provides focused role-aware portal navigation", () => {
  assert.equal(portalWorkspaces.buyer.some((item) => item.id === "favorites"), true);
  assert.equal(portalWorkspaces.buyer.some((item) => item.id === "logistics"), true);
  assert.equal(portalWorkspaces.buyer.some((item) => item.id === "profile"), true);
  assert.equal(portalWorkspaces.buyer.some((item) => item.id === "manufacturers"), true);
  assert.equal(portalWorkspaces.manufacturer.some((item) => item.id === "products"), true);
  assert.equal(portalWorkspaces.admin.some((item) => item.id === "users"), true);
  assert.equal(portalWorkspaces.buyer.some((item) => item.id === "users"), false);
});

test("builds and restores canonical Manufacturer directory and detail routes", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  assert.equal(buildPortalSearch({ view: "dashboard", workspace: "manufacturers", requestId: null, recordId: id }), `?view=dashboard&workspace=manufacturers&record=${id}`);
  assert.equal(readPortalLocation(`?view=dashboard&workspace=manufacturers&record=${id}`).recordId, id);
  assert.equal(readPortalLocation("?view=dashboard&workspace=manufacturers&record=not-a-uuid").recordId, null);
  assert.equal(normalizePortalWorkspace("buyer", "manufacturers"), "manufacturers");
  assert.equal(normalizePortalWorkspace("manufacturer", "manufacturers"), "overview");
});

test("builds and restores the canonical Buyer Favorites workspace route", () => {
  assert.deepEqual(readPortalLocation("?view=dashboard&workspace=favorites"), { view: "dashboard", workspace: "favorites", requestId: null, recordId: null });
  assert.equal(buildPortalSearch({ view: "dashboard", workspace: "favorites", requestId: null, recordId: null }), "?view=dashboard&workspace=favorites");
  assert.equal(normalizePortalWorkspace("buyer", "favorites"), "favorites");
  assert.deepEqual(readPortalLocation("?view=dashboard&workspace=messages&record=11111111-1111-4111-8111-111111111111"), { view: "dashboard", workspace: "messages", requestId: null, recordId: "11111111-1111-4111-8111-111111111111" });
  assert.equal(buildPortalSearch({ view: "dashboard", workspace: "messages", requestId: null, recordId: "11111111-1111-4111-8111-111111111111" }), "?view=dashboard&workspace=messages&record=11111111-1111-4111-8111-111111111111");
  assert.equal(normalizePortalWorkspace("buyer", "messages"), "messages");
  assert.equal(normalizePortalWorkspace("manufacturer", "messages"), "overview");
  assert.equal(normalizePortalWorkspace("manufacturer", "favorites"), "overview");
  assert.deepEqual(readPortalLocation("?view=dashboard&workspace=profile"), { view: "dashboard", workspace: "profile", requestId: null, recordId: null });
  assert.equal(buildPortalSearch({ view: "dashboard", workspace: "profile", requestId: null, recordId: null }), "?view=dashboard&workspace=profile");
  assert.equal(normalizePortalWorkspace("buyer", "profile"), "profile");
  assert.equal(normalizePortalWorkspace("manufacturer", "profile"), "overview");
  assert.equal(normalizePortalWorkspace("admin", "profile"), "overview");
});

test("normalizes workspaces to the signed-in role", () => {
  assert.equal(defaultPortalWorkspace("buyer"), "overview");
  assert.equal(isPortalWorkspaceForRole("manufacturer", "company"), true);
  assert.equal(isPortalWorkspaceForRole("buyer", "company"), false);
  assert.equal(normalizePortalWorkspace("buyer", "company"), "overview");
});

test("restores portal workspace and selected logistics request from query state", () => {
  assert.deepEqual(readPortalLocation("?view=dashboard&workspace=logistics&request=request-1"), {
    view: "dashboard",
    workspace: "logistics",
    requestId: "request-1",
    recordId: null,
  });
  assert.equal(buildPortalSearch({ view: "dashboard", workspace: "logistics", requestId: "request-1", recordId: null }), "?view=dashboard&workspace=logistics&request=request-1");
  const manufacturerLocation = readPortalLocation("?view=dashboard&workspace=products");
  assert.equal(normalizePortalWorkspace("manufacturer", manufacturerLocation.workspace), "products");
  assert.equal(normalizePortalWorkspace("buyer", manufacturerLocation.workspace), "overview");
});

test("keeps request identifiers out of unrelated URLs", () => {
  assert.equal(buildPortalSearch({ view: "dashboard", workspace: "rfqs", requestId: "request-1", recordId: null }), "?view=dashboard&workspace=rfqs");
  assert.equal(buildPortalSearch({ view: "browse", workspace: "logistics", requestId: "request-1", recordId: null }), "");
  assert.equal(readPortalLocation("?view=unknown").view, "browse");
});

test("restores only UUID-shaped RFQ and quote record identifiers", () => {
  const recordId = "11111111-1111-4111-8111-111111111111";
  assert.equal(readPortalLocation(`?view=dashboard&workspace=rfqs&record=${recordId}`).recordId, recordId);
  assert.equal(buildPortalSearch({ view: "dashboard", workspace: "quotes", requestId: null, recordId }), `?view=dashboard&workspace=quotes&record=${recordId}`);
  assert.equal(readPortalLocation("?view=dashboard&workspace=rfqs&record=demo-rfq-1").recordId, null);
  assert.equal(readPortalLocation(`?view=dashboard&workspace=logistics&record=${recordId}`).recordId, null);
});
