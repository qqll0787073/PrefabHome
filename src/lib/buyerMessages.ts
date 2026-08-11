import type { RFQMessageRecord, RFQWithDetails } from "../types";
import { buildPortalSearch } from "./portalNavigation";
import { fetchBuyerRFQs, fetchRFQMessagesForRFQs, postRFQMessage, rfqSnapshotTitle } from "./rfq";

export interface BuyerConversation {
  rfq: RFQWithDetails;
  messages: RFQMessageRecord[];
  latestMessage: RFQMessageRecord | null;
}

export interface BuyerMessagesOperations {
  fetchRFQs: typeof fetchBuyerRFQs;
  fetchMessages: typeof fetchRFQMessagesForRFQs;
}

export async function fetchBuyerConversations(
  operations: BuyerMessagesOperations = { fetchRFQs: fetchBuyerRFQs, fetchMessages: fetchRFQMessagesForRFQs },
): Promise<BuyerConversation[]> {
  const rfqs = await operations.fetchRFQs();
  const authorizedIds = rfqs.map((rfq) => rfq.id);
  const allMessages = await operations.fetchMessages(authorizedIds);
  return rfqs.map((rfq) => {
    const messages = allMessages.filter((message) => message.rfq_id === rfq.id);
    return { rfq, messages, latestMessage: messages.at(-1) ?? null };
  });
}

export function buyerConversationManufacturer(conversation: BuyerConversation): string {
  return conversation.rfq.product_snapshot?.manufacturer_display_name?.trim() || "Manufacturer not named";
}

export function buyerConversationHref(rfqId: string): string {
  return `/marketplace${buildPortalSearch({ view: "dashboard", workspace: "messages", requestId: null, recordId: rfqId })}`;
}

export function buyerConversationProductHref(conversation: BuyerConversation): string {
  return conversation.rfq.product?.slug ? `/products/${conversation.rfq.product.slug}` : "/marketplace?view=browse";
}

export function filterBuyerConversations(records: readonly BuyerConversation[], search: string): BuyerConversation[] {
  const query = search.trim().toLocaleLowerCase();
  if (!query) return [...records];
  return records.filter((conversation) => [
    rfqSnapshotTitle(conversation.rfq.product_snapshot),
    conversation.rfq.product_snapshot?.model_name,
    buyerConversationManufacturer(conversation),
    conversation.latestMessage?.message,
  ].some((value) => value?.toLocaleLowerCase().includes(query)));
}

function safeTime(value: string | null | undefined): number {
  const time = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(time) ? time : 0;
}

export function sortBuyerConversations(records: readonly BuyerConversation[]): BuyerConversation[] {
  return records.map((record, index) => ({ record, index })).sort((left, right) =>
    safeTime(right.record.latestMessage?.created_at ?? right.record.rfq.updated_at)
      - safeTime(left.record.latestMessage?.created_at ?? left.record.rfq.updated_at)
    || left.record.rfq.id.localeCompare(right.record.rfq.id)
    || left.index - right.index
  ).map(({ record }) => record);
}

export function selectBuyerConversations(records: readonly BuyerConversation[], search: string): BuyerConversation[] {
  return sortBuyerConversations(filterBuyerConversations(records, search));
}

export async function sendBuyerMessage(rfqId: string, message: string): Promise<RFQMessageRecord> {
  return postRFQMessage(rfqId, message);
}
