import { supabase } from "./supabase";
import type {
  MarketplaceProduct,
  RFQEventRecord,
  RFQFormValues,
  RFQIncoterm,
  RFQMessageRecord,
  RFQProductSnapshot,
  RFQRecord,
  RFQStatus,
  RFQWithDetails,
} from "../types";

export const rfqStatuses: RFQStatus[] = [
  "draft",
  "submitted",
  "manufacturer_review",
  "quoted",
  "buyer_review",
  "accepted",
  "declined",
  "expired",
  "cancelled",
];

export const rfqStatusLabels: Record<RFQStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  manufacturer_review: "Manufacturer review",
  quoted: "Quoted",
  buyer_review: "Buyer review",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
  cancelled: "Cancelled",
};

export const buyerRFQDashboardStatuses: RFQStatus[] = [
  "draft",
  "submitted",
  "quoted",
  "accepted",
  "declined",
  "cancelled",
];

export const rfqMessageMaxLength = 2000;

export const rfqIncoterms: RFQIncoterm[] = ["FOB", "CIF", "EXW", "DDP", "DAP"];

export type BuyerRFQDashboardGroup =
  | "draft"
  | "submitted"
  | "waiting_manufacturer"
  | "waiting_buyer"
  | "closed";

export type ManufacturerRFQDashboardGroup =
  | "new"
  | "waiting_reply"
  | "quoted"
  | "closed";

export const rfqTransitionMatrix: Record<RFQStatus, RFQStatus[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["manufacturer_review", "cancelled", "expired"],
  manufacturer_review: ["quoted", "expired"],
  quoted: ["buyer_review", "expired"],
  buyer_review: ["accepted", "declined", "expired"],
  accepted: [],
  declined: [],
  expired: [],
  cancelled: [],
};

export function emptyRFQForm(currency = "USD"): RFQFormValues {
  return {
    requestedQuantity: "1",
    requestedCurrency: currency,
    incoterm: "",
    destinationCountry: "",
    destinationPort: "",
    targetDeliveryDate: "",
    buyerMessage: "",
  };
}

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeIncoterm(value: string): RFQIncoterm | null {
  const normalized = optionalText(value)?.toUpperCase();
  return normalized ? (normalized as RFQIncoterm) : null;
}

function quantityFromText(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const quantity = Number(trimmed);
  return Number.isFinite(quantity) ? quantity : Number.NaN;
}

export function isRFQStatus(value: unknown): value is RFQStatus {
  return typeof value === "string" && rfqStatuses.includes(value as RFQStatus);
}

export function validateRFQForm(values: RFQFormValues): string[] {
  const errors: string[] = [];
  const quantity = quantityFromText(values.requestedQuantity);

  if (!values.requestedQuantity.trim()) {
    errors.push("Quantity is required.");
  } else if (!Number.isFinite(quantity) || quantity === null || quantity < 1) {
    errors.push("Quantity must be at least 1.");
  }

  if (!values.destinationCountry.trim()) {
    errors.push("Destination country is required.");
  }

  if (!/^[A-Za-z]{3}$/.test(values.requestedCurrency.trim())) {
    errors.push("Currency must be a 3-letter code.");
  }

  if (values.incoterm.trim() && !rfqIncoterms.includes(values.incoterm.trim().toUpperCase() as RFQIncoterm)) {
    errors.push("Incoterm is not supported.");
  }

  if (values.buyerMessage.length > rfqMessageMaxLength) {
    errors.push(`Message must be ${rfqMessageMaxLength} characters or fewer.`);
  }

  return errors;
}

export function toRFQPayload(
  buyerId: string,
  product: Pick<MarketplaceProduct, "id" | "manufacturer_id" | "currency">,
  values: RFQFormValues,
  status: Extract<RFQStatus, "draft" | "submitted"> = "draft"
): Omit<RFQRecord, "id" | "created_at" | "updated_at" | "product_snapshot"> {
  return {
    buyer_id: buyerId,
    manufacturer_id: product.manufacturer_id,
    product_id: product.id,
    status,
    requested_quantity: quantityFromText(values.requestedQuantity) ?? 1,
    requested_currency: values.requestedCurrency.trim().toUpperCase() || product.currency || "USD",
    incoterm: normalizeIncoterm(values.incoterm),
    destination_country: values.destinationCountry.trim(),
    destination_port: optionalText(values.destinationPort),
    target_delivery_date: optionalText(values.targetDeliveryDate),
    buyer_message: optionalText(values.buyerMessage),
  };
}

export function canTransitionRFQ(from: RFQStatus, to: RFQStatus): boolean {
  return from === to || rfqTransitionMatrix[from].includes(to);
}

export function buyerRFQDashboardGroup(status: RFQStatus): BuyerRFQDashboardGroup {
  if (status === "draft") return "draft";
  if (status === "submitted") return "submitted";
  if (status === "manufacturer_review") return "waiting_manufacturer";
  if (status === "quoted" || status === "buyer_review") return "waiting_buyer";
  return "closed";
}

export function manufacturerRFQDashboardGroup(status: RFQStatus): ManufacturerRFQDashboardGroup {
  if (status === "submitted") return "new";
  if (status === "manufacturer_review") return "waiting_reply";
  if (status === "quoted" || status === "buyer_review") return "quoted";
  return "closed";
}

export function rfqSnapshotTitle(snapshot: RFQProductSnapshot | null | undefined): string {
  return snapshot?.model_name || snapshot?.name || "Product RFQ";
}

export function rfqTimeline(
  events: RFQEventRecord[],
  messages: RFQMessageRecord[]
): Array<RFQEventRecord | RFQMessageRecord> {
  return [...events, ...messages].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

function ensureSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

function toReadableRFQError(error: { code?: string; message?: string }): Error {
  const message = error.message?.toLowerCase() ?? "";

  if (message.includes("row-level security") || message.includes("permission denied")) {
    return new Error("You are not authorized to access this RFQ.");
  }

  if (message.includes("only draft rfqs")) {
    return new Error("Only draft RFQs can be changed.");
  }

  if (message.includes("invalid") && message.includes("rfq") && message.includes("transition")) {
    return new Error("Invalid RFQ status transition.");
  }

  return new Error(error.message ?? "Unable to manage RFQ.");
}

async function recordRFQEvent(
  rfqId: string,
  eventType: string,
  metadata: Record<string, unknown> = {}
) {
  const client = ensureSupabase();
  const { error } = await client.rpc("record_rfq_event", {
    rfq_uuid: rfqId,
    event_name: eventType,
    event_metadata: metadata,
  });
  if (error) throw toReadableRFQError(error);
}

const rfqDetailSelect =
  "*, product:products(id,name,model_name,category), manufacturer:manufacturers(id,company_name,company_display_name,country), buyer:profiles(id,full_name,email)";

export async function createDraftRFQ(
  buyerId: string,
  product: Pick<MarketplaceProduct, "id" | "manufacturer_id" | "currency">,
  values: RFQFormValues
): Promise<RFQRecord> {
  const client = ensureSupabase();
  const payload = toRFQPayload(buyerId, product, values, "draft");
  const { data, error } = await client.from("rfqs").insert(payload).select("*").single();

  if (error) throw toReadableRFQError(error);
  await recordRFQEvent(data.id, "draft_created");
  return data as RFQRecord;
}

export async function submitRFQ(rfqId: string, values?: RFQFormValues): Promise<RFQRecord> {
  const client = ensureSupabase();
  const payload = values
    ? {
        requested_quantity: quantityFromText(values.requestedQuantity) ?? 1,
        requested_currency: values.requestedCurrency.trim().toUpperCase(),
        incoterm: normalizeIncoterm(values.incoterm),
        destination_country: values.destinationCountry.trim(),
        destination_port: optionalText(values.destinationPort),
        target_delivery_date: optionalText(values.targetDeliveryDate),
        buyer_message: optionalText(values.buyerMessage),
        status: "submitted" as const,
      }
    : { status: "submitted" as const };

  const { data, error } = await client
    .from("rfqs")
    .update(payload)
    .eq("id", rfqId)
    .select("*")
    .single();

  if (error) throw toReadableRFQError(error);
  await recordRFQEvent(rfqId, "submitted");
  return data as RFQRecord;
}

export async function fetchBuyerRFQs(buyerId: string): Promise<RFQWithDetails[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("rfqs")
    .select(rfqDetailSelect)
    .eq("buyer_id", buyerId)
    .order("created_at", { ascending: true });

  if (error) throw toReadableRFQError(error);
  return (data ?? []) as RFQWithDetails[];
}

export async function fetchManufacturerRFQs(ownerId: string): Promise<RFQWithDetails[]> {
  if (!supabase) return [];

  const { data: manufacturers, error: manufacturerError } = await supabase
    .from("manufacturers")
    .select("id")
    .eq("owner_id", ownerId);

  if (manufacturerError) throw toReadableRFQError(manufacturerError);

  const manufacturerIds = (manufacturers ?? []).map((item) => item.id);
  if (manufacturerIds.length === 0) return [];

  const { data, error } = await supabase
    .from("rfqs")
    .select(rfqDetailSelect)
    .in("manufacturer_id", manufacturerIds)
    .order("created_at", { ascending: true });

  if (error) throw toReadableRFQError(error);
  return (data ?? []) as RFQWithDetails[];
}

export async function fetchAdminRFQs(): Promise<RFQWithDetails[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("rfqs")
    .select(rfqDetailSelect)
    .order("created_at", { ascending: true });

  if (error) throw toReadableRFQError(error);
  return (data ?? []) as RFQWithDetails[];
}

export async function fetchRFQ(rfqId: string): Promise<RFQWithDetails | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("rfqs")
    .select(rfqDetailSelect)
    .eq("id", rfqId)
    .maybeSingle();

  if (error) throw toReadableRFQError(error);
  return data as RFQWithDetails | null;
}

export async function postRFQMessage(
  rfqId: string,
  senderProfileId: string,
  message: string
): Promise<RFQMessageRecord> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from("rfq_messages")
    .insert({
      rfq_id: rfqId,
      sender_profile_id: senderProfileId,
      message: message.trim(),
      attachment_path: null,
    })
    .select("*")
    .single();

  if (error) throw toReadableRFQError(error);
  return data as RFQMessageRecord;
}

export async function fetchRFQMessages(rfqId: string): Promise<RFQMessageRecord[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("rfq_messages")
    .select("*")
    .eq("rfq_id", rfqId)
    .order("created_at", { ascending: true });

  if (error) throw toReadableRFQError(error);
  return (data ?? []) as RFQMessageRecord[];
}

export async function fetchRFQEvents(rfqId: string): Promise<RFQEventRecord[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("rfq_events")
    .select("*")
    .eq("rfq_id", rfqId)
    .order("created_at", { ascending: true });

  if (error) throw toReadableRFQError(error);
  return (data ?? []) as RFQEventRecord[];
}

export async function cancelDraftRFQ(rfqId: string): Promise<RFQRecord> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from("rfqs")
    .update({ status: "cancelled" })
    .eq("id", rfqId)
    .select("*")
    .single();

  if (error) throw toReadableRFQError(error);
  await recordRFQEvent(rfqId, "cancelled");
  return data as RFQRecord;
}

export async function deleteDraftRFQ(rfqId: string): Promise<void> {
  const client = ensureSupabase();
  const { error } = await client.from("rfqs").delete().eq("id", rfqId);
  if (error) throw toReadableRFQError(error);
}
