import type { RFQStatus, RFQWithDetails } from "../types";
import { buildPortalSearch } from "./portalNavigation";
import { rfqSnapshotTitle } from "./rfq";

export type BuyerRFQFilter = "all" | "draft" | "active" | "buyer_review" | "closed";
export type BuyerRFQSort = "updated" | "created" | "status";

export const buyerRFQFilters: readonly BuyerRFQFilter[] = ["all", "draft", "active", "buyer_review", "closed"];
export const buyerRFQFilterLabels: Record<BuyerRFQFilter, string> = {
  all: "All", draft: "Draft", active: "Open / Active", buyer_review: "Quoted / Buyer review", closed: "Accepted / Closed",
};

export const buyerRFQStatusFilter: Record<RFQStatus, Exclude<BuyerRFQFilter, "all">> = {
  draft: "draft",
  submitted: "active",
  manufacturer_review: "active",
  revision_requested: "active",
  quoted: "buyer_review",
  buyer_review: "buyer_review",
  accepted: "closed",
  declined: "closed",
  expired: "closed",
  cancelled: "closed",
};

const safeTime = (value: string | null | undefined) => { const time = value ? Date.parse(value) : Number.NaN; return Number.isFinite(time) ? time : 0; };
export const shortRFQReference = (id: string) => `RFQ-${id.slice(0, 8).toUpperCase()}`;
export const buyerRFQManufacturer = (rfq: RFQWithDetails) => rfq.product_snapshot?.manufacturer_display_name?.trim() || "Manufacturer not named";

export function buyerRFQHref(id: string): string {
  return `/marketplace${buildPortalSearch({ view: "dashboard", workspace: "rfqs", requestId: null, recordId: id })}`;
}

export function filterBuyerRFQs(records: readonly RFQWithDetails[], filter: BuyerRFQFilter, search: string): RFQWithDetails[] {
  const query = search.trim().toLocaleLowerCase();
  return records.filter((rfq) => {
    if (filter !== "all" && buyerRFQStatusFilter[rfq.status] !== filter) return false;
    if (!query) return true;
    return [rfq.id, shortRFQReference(rfq.id), rfqSnapshotTitle(rfq.product_snapshot), rfq.product_snapshot?.name, rfq.product_snapshot?.model_name, buyerRFQManufacturer(rfq)]
      .some((value) => value?.toLocaleLowerCase().includes(query));
  });
}

export function sortBuyerRFQs(records: readonly RFQWithDetails[], sort: BuyerRFQSort): RFQWithDetails[] {
  const groupOrder: Record<Exclude<BuyerRFQFilter, "all">, number> = { draft: 0, active: 1, buyer_review: 2, closed: 3 };
  return records.map((record, index) => ({ record, index })).sort((left, right) => {
    let result = 0;
    if (sort === "updated") result = safeTime(right.record.updated_at) - safeTime(left.record.updated_at);
    else if (sort === "created") result = safeTime(right.record.created_at) - safeTime(left.record.created_at);
    else result = groupOrder[buyerRFQStatusFilter[left.record.status]] - groupOrder[buyerRFQStatusFilter[right.record.status]] || left.record.status.localeCompare(right.record.status);
    return result || left.record.id.localeCompare(right.record.id) || left.index - right.index;
  }).map(({ record }) => record);
}

export function selectBuyerRFQs(records: readonly RFQWithDetails[], filter: BuyerRFQFilter, search: string, sort: BuyerRFQSort): RFQWithDetails[] {
  return sortBuyerRFQs(filterBuyerRFQs(records, filter, search), sort);
}
