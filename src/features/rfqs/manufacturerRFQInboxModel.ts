import { manufacturerRFQDashboardGroup, rfqSnapshotTitle, rfqStatusLabels, type ManufacturerRFQDashboardGroup } from "../../lib/rfq";
import type { RFQStatus, RFQWithDetails } from "../../types";

export type ManufacturerRFQFilter = ManufacturerRFQDashboardGroup | "all";
export type ManufacturerRFQSort = "updated" | "created" | "quantity";

export function selectManufacturerRFQs(rfqs: readonly RFQWithDetails[], filter: ManufacturerRFQFilter, search: string, sort: ManufacturerRFQSort): RFQWithDetails[] {
  const query = search.trim().toLocaleLowerCase();
  return [...rfqs]
    .filter((rfq) => filter === "all" || manufacturerRFQDashboardGroup(rfq.status) === filter)
    .filter((rfq) => !query || [rfqSnapshotTitle(rfq.product_snapshot), rfq.product_snapshot.category, rfq.destination_country, rfq.destination_port, rfqStatusLabels[rfq.status], rfq.id.slice(0, 8)].some((value) => value?.toLocaleLowerCase().includes(query)))
    .sort((left, right) => {
      if (sort === "quantity") return right.requested_quantity - left.requested_quantity || left.id.localeCompare(right.id);
      const leftDate = Date.parse(sort === "created" ? left.created_at : left.updated_at);
      const rightDate = Date.parse(sort === "created" ? right.created_at : right.updated_at);
      const difference = (Number.isNaN(rightDate) ? 0 : rightDate) - (Number.isNaN(leftDate) ? 0 : leftDate);
      return difference || left.id.localeCompare(right.id);
    });
}

export function manufacturerRFQActionLabel(status: RFQStatus): string {
  if (status === "submitted") return "Open and review";
  if (status === "manufacturer_review") return "Continue Quote";
  if (status === "revision_requested") return "Review revision request";
  if (status === "quoted" || status === "buyer_review") return "View Quote history";
  return "View RFQ";
}
