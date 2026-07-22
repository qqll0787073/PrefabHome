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
import { assertLiveRecordId } from "./rfqQuoteWorkflow";

export const rfqStatuses: RFQStatus[] = [
  "draft",
  "submitted",
  "manufacturer_review",
  "quoted",
  "buyer_review",
  "revision_requested",
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
  revision_requested: "Revision requested",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
  cancelled: "Cancelled",
};

export const buyerRFQDashboardStatuses: RFQStatus[] = [
  "draft",
  "submitted",
  "quoted",
  "revision_requested",
  "accepted",
  "declined",
  "cancelled",
];

export const rfqMessageMaxLength = 2000;
export const rfqCountryMaxLength = 120;
export const rfqPortMaxLength = 160;

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
  quoted: ["buyer_review", "accepted", "declined", "revision_requested", "expired"],
  buyer_review: ["accepted", "declined", "revision_requested", "expired"],
  revision_requested: ["quoted", "expired"],
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
  } else if (values.destinationCountry.trim().length > rfqCountryMaxLength) {
    errors.push(`Destination country must be ${rfqCountryMaxLength} characters or fewer.`);
  }

  if (!/^[A-Za-z]{3}$/.test(values.requestedCurrency.trim())) {
    errors.push("Currency must be a 3-letter code.");
  }

  if (values.incoterm.trim() && !rfqIncoterms.includes(values.incoterm.trim().toUpperCase() as RFQIncoterm)) {
    errors.push("Incoterm is not supported.");
  }

  if (values.destinationPort.trim().length > rfqPortMaxLength) {
    errors.push(`Destination port must be ${rfqPortMaxLength} characters or fewer.`);
  }

  if (values.targetDeliveryDate) {
    const targetDate = Date.parse(`${values.targetDeliveryDate}T00:00:00Z`);
    if (Number.isNaN(targetDate)) {
      errors.push("Target delivery date must be valid.");
    } else if (values.targetDeliveryDate < new Date().toISOString().slice(0, 10)) {
      errors.push("Target delivery date cannot be in the past.");
    }
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
  if (status === "revision_requested") return "waiting_manufacturer";
  return "closed";
}

export function manufacturerRFQDashboardGroup(status: RFQStatus): ManufacturerRFQDashboardGroup {
  if (status === "submitted") return "new";
  if (status === "manufacturer_review") return "waiting_reply";
  if (status === "quoted" || status === "buyer_review" || status === "revision_requested") return "quoted";
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

export function toReadableRFQError(error: { code?: string; message?: string }): Error {
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

  if (message.includes("duplicate") || error.code === "23505") {
    return new Error("This RFQ action conflicts with an existing record. Refresh and try again.");
  }

  return new Error("Unable to manage RFQ. Refresh and try again.");
}

export function rfqToFormValues(rfq: RFQRecord): RFQFormValues {
  return {
    requestedQuantity: String(rfq.requested_quantity),
    requestedCurrency: rfq.requested_currency,
    incoterm: rfq.incoterm ?? "",
    destinationCountry: rfq.destination_country,
    destinationPort: rfq.destination_port ?? "",
    targetDeliveryDate: rfq.target_delivery_date ?? "",
    buyerMessage: rfq.buyer_message ?? "",
  };
}

function toRFQUpdatePayload(values: RFQFormValues) {
  return {
    requested_quantity: quantityFromText(values.requestedQuantity) ?? 1,
    requested_currency: values.requestedCurrency.trim().toUpperCase(),
    incoterm: normalizeIncoterm(values.incoterm),
    destination_country: values.destinationCountry.trim(),
    destination_port: optionalText(values.destinationPort),
    target_delivery_date: optionalText(values.targetDeliveryDate),
    buyer_message: optionalText(values.buyerMessage),
  };
}

const participantRFQDetailSelect = "*, product:products(id,name,model_name,category)";
const adminRFQDetailSelect =
  "*, product:products(id,name,model_name,category), manufacturer:manufacturers(id,company_name,company_display_name,country), buyer:profiles(id,full_name,email)";

export async function createDraftRFQ(
  product: Pick<MarketplaceProduct, "id" | "manufacturer_id" | "currency">,
  values: RFQFormValues
): Promise<RFQRecord> {
  const client = ensureSupabase();
  assertLiveRecordId(product.id, "Product");
  assertLiveRecordId(product.manufacturer_id, "Manufacturer");
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) {
    throw new Error("Sign in with a Buyer account before creating an RFQ.");
  }
  const buyerId = authData.user.id;
  const payload = toRFQPayload(buyerId, product, values, "draft");
  const { data, error } = await client.from("rfqs").insert(payload).select("*").single();

  if (error) throw toReadableRFQError(error);
  return data as RFQRecord;
}

export async function submitRFQ(rfqId: string, values?: RFQFormValues): Promise<RFQRecord> {
  const client = ensureSupabase();
  assertLiveRecordId(rfqId, "RFQ");
  const payload = values
    ? { ...toRFQUpdatePayload(values), status: "submitted" as const }
    : { status: "submitted" as const };

  const { data, error } = await client
    .from("rfqs")
    .update(payload)
    .eq("id", rfqId)
    .select("*")
    .single();

  if (error) throw toReadableRFQError(error);
  return data as RFQRecord;
}

async function authenticatedProfileId(): Promise<string> {
  const client = ensureSupabase();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("Sign in to access RFQs.");
  return data.user.id;
}

export async function updateDraftRFQ(rfqId: string, values: RFQFormValues): Promise<RFQRecord> {
  const client = ensureSupabase();
  assertLiveRecordId(rfqId, "RFQ");
  const { data, error } = await client
    .from("rfqs")
    .update(toRFQUpdatePayload(values))
    .eq("id", rfqId)
    .eq("status", "draft")
    .select("*")
    .single();

  if (error) throw toReadableRFQError(error);
  return data as RFQRecord;
}

export async function fetchBuyerRFQs(): Promise<RFQWithDetails[]> {
  if (!supabase) return [];
  const buyerId = await authenticatedProfileId();

  const { data, error } = await supabase
    .from("rfqs")
    .select(participantRFQDetailSelect)
    .eq("buyer_id", buyerId)
    .order("created_at", { ascending: true });

  if (error) throw toReadableRFQError(error);
  return (data ?? []) as RFQWithDetails[];
}

export async function fetchManufacturerRFQs(): Promise<RFQWithDetails[]> {
  if (!supabase) return [];
  const ownerId = await authenticatedProfileId();

  const { data: manufacturers, error: manufacturerError } = await supabase
    .from("manufacturers")
    .select("id")
    .eq("owner_id", ownerId);

  if (manufacturerError) throw toReadableRFQError(manufacturerError);

  const manufacturerIds = (manufacturers ?? []).map((item) => item.id);
  if (manufacturerIds.length === 0) return [];

  const { data, error } = await supabase
    .from("rfqs")
    .select(participantRFQDetailSelect)
    .in("manufacturer_id", manufacturerIds)
    .order("created_at", { ascending: true });

  if (error) throw toReadableRFQError(error);
  return (data ?? []) as RFQWithDetails[];
}

export async function fetchAdminRFQs(): Promise<RFQWithDetails[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("rfqs")
    .select(adminRFQDetailSelect)
    .order("created_at", { ascending: true });

  if (error) throw toReadableRFQError(error);
  return (data ?? []) as RFQWithDetails[];
}

export async function fetchRFQ(rfqId: string): Promise<RFQWithDetails | null> {
  if (!supabase) return null;
  assertLiveRecordId(rfqId, "RFQ");

  const { data, error } = await supabase
    .from("rfqs")
    .select(participantRFQDetailSelect)
    .eq("id", rfqId)
    .maybeSingle();

  if (error) throw toReadableRFQError(error);
  return data as RFQWithDetails | null;
}

export async function postRFQMessage(
  rfqId: string,
  message: string
): Promise<RFQMessageRecord> {
  const client = ensureSupabase();
  assertLiveRecordId(rfqId, "RFQ");
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) throw new Error("Sign in before posting an RFQ message.");
  const { data, error } = await client
    .from("rfq_messages")
    .insert({
      rfq_id: rfqId,
      sender_profile_id: authData.user.id,
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
  assertLiveRecordId(rfqId, "RFQ");

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
  assertLiveRecordId(rfqId, "RFQ");

  const { data, error } = await supabase
    .from("rfq_events")
    .select("*")
    .eq("rfq_id", rfqId)
    .order("created_at", { ascending: true });

  if (error) throw toReadableRFQError(error);
  return (data ?? []) as RFQEventRecord[];
}

export async function markManufacturerRFQOpened(rfqId: string): Promise<void> {
  const client = ensureSupabase();
  assertLiveRecordId(rfqId, "RFQ");
  const { error } = await client.rpc("record_rfq_opened", { rfq_uuid: rfqId });
  if (error) throw toReadableRFQError(error);
}

export async function cancelRFQ(rfqId: string): Promise<RFQRecord> {
  const client = ensureSupabase();
  assertLiveRecordId(rfqId, "RFQ");
  const { data, error } = await client
    .from("rfqs")
    .update({ status: "cancelled" })
    .eq("id", rfqId)
    .select("*")
    .single();

  if (error) throw toReadableRFQError(error);
  return data as RFQRecord;
}

export const cancelDraftRFQ = cancelRFQ;

export async function deleteDraftRFQ(rfqId: string): Promise<void> {
  const client = ensureSupabase();
  assertLiveRecordId(rfqId, "RFQ");
  const { error } = await client.from("rfqs").delete().eq("id", rfqId);
  if (error) throw toReadableRFQError(error);
}
