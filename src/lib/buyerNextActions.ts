import type { ContractStatus, InvoiceStatus, PurchaseOrderStatus, RFQQuoteStatus, RFQStatus, ShippingReadinessStatus } from "../types";

export interface BuyerNextAction {
  label: string;
  description: string;
  href: string | null;
  actionNeeded: boolean;
}

const workspace = (name: string, recordId?: string) => `/marketplace?view=dashboard&workspace=${name}${recordId ? `&record=${encodeURIComponent(recordId)}` : ""}`;

export function buyerRFQNextAction(status: RFQStatus, id: string): BuyerNextAction | null {
  if (status === "draft") return { label: "Complete this RFQ", description: "Finish the request details and submit when you are ready.", href: workspace("rfqs", id), actionNeeded: true };
  if (status === "submitted" || status === "manufacturer_review") return { label: "Waiting for Manufacturer review", description: "No Buyer action is required while the Manufacturer reviews this request.", href: workspace("rfqs", id), actionNeeded: false };
  if (status === "quoted" || status === "buyer_review") return { label: "Review the current Quote", description: "Review the current version and accept, reject, or request a revision if those actions remain available.", href: workspace("rfqs", id), actionNeeded: true };
  if (status === "revision_requested") return { label: "Waiting for a revised Quote", description: "The Manufacturer can prepare a same-RFQ revision.", href: workspace("rfqs", id), actionNeeded: false };
  if (status === "accepted") return { label: "Continue to Orders", description: "Use the accepted Quote to continue through the existing Purchase Order flow.", href: workspace("orders"), actionNeeded: true };
  return null;
}

export function buyerQuoteNextAction(status: RFQQuoteStatus, rfqId: string): BuyerNextAction | null {
  if (status === "submitted") return { label: "Review this Quote", description: "Accept, reject, or request revision from its RFQ when currently eligible.", href: workspace("rfqs", rfqId), actionNeeded: true };
  if (status === "accepted") return { label: "Continue to Orders", description: "An accepted Quote can continue to the Purchase Order workspace.", href: workspace("orders"), actionNeeded: true };
  if (status === "revision_requested") return { label: "Waiting for a revised Quote", description: "No Buyer action is required while a new same-RFQ version is prepared.", href: workspace("rfqs", rfqId), actionNeeded: false };
  return null;
}

export function buyerPurchaseOrderNextAction(status: PurchaseOrderStatus, id: string): BuyerNextAction | null {
  if (status === "draft" || status === "revision_requested") return { label: status === "draft" ? "Complete this Purchase Order" : "Revise this Purchase Order", description: "Review the Order details and submit through the existing Order controls.", href: workspace("orders", id), actionNeeded: true };
  if (status === "submitted" || status === "manufacturer_review") return { label: "Waiting for Manufacturer response", description: "No Buyer action is required during Manufacturer review.", href: workspace("orders", id), actionNeeded: false };
  if (status === "confirmed") return { label: "Continue to Contracts", description: "Continue with the Contract workspace when a related Contract is available or eligible to create.", href: workspace("contracts"), actionNeeded: true };
  return null;
}

export function buyerContractNextAction(status: ContractStatus, id: string): BuyerNextAction | null {
  if (status === "draft") return { label: "Complete this Contract draft", description: "Review the draft and mark it ready using the existing Contract controls.", href: workspace("contracts", id), actionNeeded: true };
  if (status === "revision_requested") return { label: "Review requested Contract changes", description: "Update the permitted fields and resubmit through the existing Contract controls.", href: workspace("contracts", id), actionNeeded: true };
  if (status === "ready" || status === "participant_review") return { label: "Waiting for Manufacturer review", description: "The Contract is under participant review; this does not mean it is legally executed.", href: workspace("contracts", id), actionNeeded: false };
  if (status === "accepted") return { label: "Review Invoices", description: "Continue to any related Invoice. Contract acceptance here is not an electronic signature.", href: workspace("invoices"), actionNeeded: false };
  return null;
}

export function buyerInvoiceNextAction(status: InvoiceStatus, id: string): BuyerNextAction | null {
  if (status === "draft") return { label: "Waiting for Invoice issue", description: "The draft is read-only for Buyers and does not record payment.", href: workspace("invoices", id), actionNeeded: false };
  if (status === "issued") return { label: "Review this Invoice", description: "Review the Invoice and externally recorded payment activity. The platform does not process or verify payment.", href: workspace("invoices", id), actionNeeded: true };
  return null;
}

export function buyerShippingNextAction(status: ShippingReadinessStatus, id: string): BuyerNextAction | null {
  if (status === "shipping_draft") return { label: "Review shipping readiness", description: "Review the current planning information; it is not a carrier booking or live tracking status.", href: workspace("shipping", id), actionNeeded: false };
  if (status === "ready_for_logistics") return { label: "Continue to Logistics planning", description: "Review logistics planning options. No carrier booking or customs clearance is guaranteed.", href: workspace("logistics"), actionNeeded: true };
  return null;
}
