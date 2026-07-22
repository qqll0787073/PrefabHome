import type { Role, View } from "../types";
import { isLiveRecordId } from "./rfqQuoteWorkflow";

export type PortalWorkspace =
  | "overview"
  | "users"
  | "company"
  | "manufacturers"
  | "products"
  | "rfqs"
  | "quotes"
  | "purchase-orders"
  | "contracts"
  | "invoices"
  | "shipping"
  | "logistics";

export interface PortalWorkspaceDefinition {
  id: PortalWorkspace;
  label: string;
  description: string;
}

const sharedTransactionWorkspaces: PortalWorkspaceDefinition[] = [
  { id: "rfqs", label: "RFQs", description: "Requests, conversations, and transaction context." },
  { id: "quotes", label: "Quotes", description: "Quote versions and decisions within each RFQ." },
  { id: "purchase-orders", label: "Purchase Orders", description: "Purchase order lifecycle and history." },
  { id: "contracts", label: "Contracts", description: "Contracts and signature preparation status." },
  { id: "invoices", label: "Invoices", description: "Invoices and externally recorded payment activity." },
  { id: "shipping", label: "Shipping", description: "Shipping readiness and internal planning status." },
  { id: "logistics", label: "Logistics", description: "Booking requests, provider options, and arrangement status." },
];

export const portalWorkspaces: Record<Role, PortalWorkspaceDefinition[]> = {
  buyer: [
    { id: "overview", label: "Dashboard", description: "Buyer activity and next steps." },
    ...sharedTransactionWorkspaces,
  ],
  manufacturer: [
    { id: "overview", label: "Dashboard", description: "Manufacturer activity and next steps." },
    { id: "company", label: "Company", description: "Manufacturer application and approval status." },
    { id: "products", label: "Products", description: "Product drafts, submissions, and media." },
    ...sharedTransactionWorkspaces,
  ],
  admin: [
    { id: "overview", label: "Dashboard", description: "Operational queues and Beta status." },
    { id: "users", label: "Users", description: "Current user-management capability and limitations." },
    { id: "manufacturers", label: "Manufacturers", description: "Manufacturer application review." },
    { id: "products", label: "Products", description: "Product lifecycle review." },
    ...sharedTransactionWorkspaces.filter((workspace) => workspace.id !== "quotes"),
  ],
};

const validViews: View[] = ["browse", "compare", "advisor", "import-center", "dashboard"];

export interface PortalLocationState {
  view: View;
  workspace: string | null;
  requestId: string | null;
  recordId: string | null;
}

export function defaultPortalWorkspace(role: Role): PortalWorkspace {
  return portalWorkspaces[role][0].id;
}

export function isPortalWorkspaceForRole(role: Role, value: string | null | undefined): value is PortalWorkspace {
  return Boolean(value && portalWorkspaces[role].some((workspace) => workspace.id === value));
}

export function normalizePortalWorkspace(role: Role, value: string | null | undefined): PortalWorkspace {
  return isPortalWorkspaceForRole(role, value) ? value : defaultPortalWorkspace(role);
}

export function readPortalLocation(search: string): PortalLocationState {
  const params = new URLSearchParams(search);
  const requestedView = params.get("view") as View | null;
  const workspace = params.get("workspace");
  const recordId = params.get("record");
  return {
    view: requestedView && validViews.includes(requestedView) ? requestedView : "browse",
    workspace,
    requestId: params.get("request"),
    recordId:
      ["rfqs", "quotes"].includes(workspace ?? "") && recordId && isLiveRecordId(recordId)
        ? recordId
        : null,
  };
}

export function buildPortalSearch(state: PortalLocationState): string {
  const params = new URLSearchParams();
  if (state.view !== "browse") params.set("view", state.view);
  if (state.view === "dashboard" && state.workspace) params.set("workspace", state.workspace);
  if (state.view === "dashboard" && state.workspace === "logistics" && state.requestId) {
    params.set("request", state.requestId);
  }
  if (
    state.view === "dashboard" &&
    ["rfqs", "quotes"].includes(state.workspace ?? "") &&
    state.recordId &&
    isLiveRecordId(state.recordId)
  ) {
    params.set("record", state.recordId);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function portalWorkspaceDefinition(role: Role, workspace: PortalWorkspace): PortalWorkspaceDefinition {
  return portalWorkspaces[role].find((item) => item.id === workspace) ?? portalWorkspaces[role][0];
}
