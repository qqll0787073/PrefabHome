import type { RFQWithDetails } from "../../types";

export interface ManufacturerOverviewMetrics {
  newRequests: number;
  preparingQuotes: number;
  buyerReview: number;
  revisionsRequested: number;
}

export function manufacturerOverviewMetrics(rfqs: readonly RFQWithDetails[]): ManufacturerOverviewMetrics {
  return {
    newRequests: rfqs.filter((rfq) => rfq.status === "submitted").length,
    preparingQuotes: rfqs.filter((rfq) => rfq.status === "manufacturer_review").length,
    buyerReview: rfqs.filter((rfq) => ["quoted", "buyer_review"].includes(rfq.status)).length,
    revisionsRequested: rfqs.filter((rfq) => rfq.status === "revision_requested").length,
  };
}

export function recentManufacturerRFQs(rfqs: readonly RFQWithDetails[], limit = 5): RFQWithDetails[] {
  return [...rfqs]
    .sort((left, right) => {
      const updated = Date.parse(right.updated_at) - Date.parse(left.updated_at);
      return Number.isNaN(updated) || updated === 0 ? right.id.localeCompare(left.id) : updated;
    })
    .slice(0, limit);
}
