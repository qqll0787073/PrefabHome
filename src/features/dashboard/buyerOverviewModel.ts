import type { ContractRecord, InvoiceRecord, PurchaseOrderWithItems, RFQQuoteWithItems, RFQStatus, RFQWithDetails, ShippingReadinessRecord } from "../../types";

const activeStatuses: RFQStatus[] = [
  "submitted", "manufacturer_review", "quoted", "buyer_review", "revision_requested",
];

export interface BuyerOverviewMetrics {
  active: number;
  drafts: number;
  open: number;
  total: number;
}

export interface BuyerJourneyMetrics {
  quotesAwaitingDecision: number;
  activeOrders: number;
  contractsNeedingAttention: number;
  openInvoices: number;
  shippingInProgress: number;
}

export function buyerJourneyMetrics(data: {
  quotes: readonly RFQQuoteWithItems[];
  orders: readonly PurchaseOrderWithItems[];
  contracts: readonly ContractRecord[];
  invoices: readonly InvoiceRecord[];
  shipping: readonly ShippingReadinessRecord[];
}): BuyerJourneyMetrics {
  return {
    quotesAwaitingDecision: data.quotes.filter((quote) => quote.status === "submitted").length,
    activeOrders: data.orders.filter((order) => !["rejected", "cancelled"].includes(order.status)).length,
    contractsNeedingAttention: data.contracts.filter((contract) => ["draft", "revision_requested"].includes(contract.status)).length,
    openInvoices: data.invoices.filter((invoice) => invoice.status === "issued").length,
    shippingInProgress: data.shipping.filter((record) => record.status !== "cancelled").length,
  };
}

export function buyerOverviewMetrics(rfqs: readonly RFQWithDetails[]): BuyerOverviewMetrics {
  return {
    active: rfqs.filter((rfq) => activeStatuses.includes(rfq.status)).length,
    drafts: rfqs.filter((rfq) => rfq.status === "draft").length,
    open: rfqs.filter((rfq) => ["submitted", "manufacturer_review"].includes(rfq.status)).length,
    total: rfqs.length,
  };
}

export function recentBuyerRFQs(rfqs: readonly RFQWithDetails[], limit = 5): RFQWithDetails[] {
  return [...rfqs]
    .sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at))
    .slice(0, limit);
}

export function buyerRFQTitle(rfq: RFQWithDetails): string {
  return rfq.product?.name
    ?? rfq.product?.model_name
    ?? rfq.product_snapshot.name
    ?? rfq.product_snapshot.model_name
    ?? "RFQ request";
}

export function buyerRFQContext(rfq: RFQWithDetails): string | null {
  return rfq.product_snapshot.manufacturer_display_name ?? null;
}
