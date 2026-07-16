import { supabase } from "./supabase";
import type {
  SignatureDeliveryEventRecord,
  SignatureDeliveryProviderKey,
  SignatureDeliveryRecipientRecord,
  SignatureDeliveryRequestRecord,
  SignatureDeliveryStatus,
  SignaturePackageRecord,
} from "../types";

export const signatureDeliveryStatusLabels: Record<SignatureDeliveryStatus, string> = {
  delivery_draft: "Delivery Draft",
  queued: "Queued Internally",
  cancelled: "Cancelled",
};

export const signatureDeliveryEventLabels: Record<SignatureDeliveryEventRecord["event_type"], string> = {
  signature_delivery_created: "Signature delivery request created",
  signature_delivery_queued: "Signature delivery request queued internally",
  signature_delivery_cancelled: "Signature delivery request cancelled",
};

export const signatureDeliveryProviderLabels: Record<SignatureDeliveryProviderKey, string> = {
  unconfigured: "Provider: Not configured",
};

export const signatureDeliveryCancelReasonMaxLength = 2000;

export interface SignatureDeliveryProviderAdapter {
  providerKey: SignatureDeliveryProviderKey;
  displayName: string;
  queue(): Promise<never>;
}

export const unconfiguredSignatureDeliveryProvider: SignatureDeliveryProviderAdapter = {
  providerKey: "unconfigured",
  displayName: "Provider: Not configured",
  async queue() {
    throw new Error("Signature provider is not configured. PH-008D queues requests internally only.");
  },
};

function ensureSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

function toReadableDeliveryError(error: { message?: string }): Error {
  const message = error.message?.toLowerCase() ?? "";

  if (message.includes("row-level security") || message.includes("permission denied")) {
    return new Error("You are not authorized to access this signature delivery request.");
  }
  if (message.includes("ready-to-send")) {
    return new Error("Signature delivery requests require a ready-to-send signature package.");
  }
  if (message.includes("already exists") || message.includes("signature_delivery_requests_signature_package_id_key")) {
    return new Error("A signature delivery request already exists for this package.");
  }
  if (message.includes("buyer signer")) {
    return new Error("Buyer signer must be complete before preparing delivery.");
  }
  if (message.includes("manufacturer signer")) {
    return new Error("Manufacturer signer must be complete before preparing delivery.");
  }
  if (message.includes("exactly two")) {
    return new Error("Signature delivery requires exactly two recipients.");
  }
  if (message.includes("draft")) {
    return new Error("Only draft signature delivery requests can be queued.");
  }
  if (message.includes("reason")) {
    return new Error(`Cancellation reason is required and must be ${signatureDeliveryCancelReasonMaxLength} characters or fewer.`);
  }

  return new Error(error.message ?? "Unable to manage signature delivery.");
}

export function canPrepareSignatureDelivery(
  signaturePackage: Pick<SignaturePackageRecord, "id" | "status">,
  deliveries: Pick<SignatureDeliveryRequestRecord, "signature_package_id">[]
): boolean {
  return (
    signaturePackage.status === "ready_to_send" &&
    !deliveries.some((delivery) => delivery.signature_package_id === signaturePackage.id)
  );
}

export function isSignatureDeliveryReadOnly(
  delivery: Pick<SignatureDeliveryRequestRecord, "status">
): boolean {
  return delivery.status !== "delivery_draft";
}

export function canQueueSignatureDelivery(
  delivery: Pick<SignatureDeliveryRequestRecord, "status">
): boolean {
  return delivery.status === "delivery_draft";
}

export function canCancelSignatureDelivery(
  delivery: Pick<SignatureDeliveryRequestRecord, "status">
): boolean {
  return delivery.status === "delivery_draft" || delivery.status === "queued";
}

export function validateSignatureDeliveryCancelReason(reason: string): string[] {
  const trimmed = reason.trim();
  const errors: string[] = [];

  if (!trimmed) {
    errors.push("Cancellation reason is required.");
  }
  if (reason.length > signatureDeliveryCancelReasonMaxLength) {
    errors.push(`Cancellation reason must be ${signatureDeliveryCancelReasonMaxLength} characters or fewer.`);
  }

  return errors;
}

export function signatureDeliveryProviderLabel(
  delivery: Pick<SignatureDeliveryRequestRecord, "provider_key">
): string {
  return signatureDeliveryProviderLabels[delivery.provider_key];
}

export function signatureDeliveryQueuedAtLabel(
  delivery: Pick<SignatureDeliveryRequestRecord, "status" | "queued_at">
): string | null {
  if (delivery.status !== "queued" || !delivery.queued_at) return null;
  return `Queued internally ${new Date(delivery.queued_at).toLocaleString()}`;
}

export function signatureDeliveryCancelledAtLabel(
  delivery: Pick<SignatureDeliveryRequestRecord, "status" | "cancelled_at">
): string | null {
  if (delivery.status !== "cancelled" || !delivery.cancelled_at) return null;
  return `Cancelled ${new Date(delivery.cancelled_at).toLocaleString()}`;
}

export function signatureDeliveryQueueConfirmationText(
  delivery: Pick<SignatureDeliveryRequestRecord, "delivery_number" | "contract_number">
): string {
  return `Queue ${delivery.delivery_number} internally for ${delivery.contract_number}? No provider will be contacted, no email will be sent, no signing link will be created, and the Contract will not be signed.`;
}

export function signatureDeliveryQueuedNotice(): string {
  return "Queued internally. Not sent to a signature provider.";
}

export function signatureDeliveryManufacturerNotice(): string {
  return "No signature invitation has been sent.";
}

export function sortSignatureDeliveryRecipients(
  recipients: SignatureDeliveryRecipientRecord[] = []
): SignatureDeliveryRecipientRecord[] {
  return [...recipients].sort((a, b) => a.signing_order - b.signing_order);
}

export function signatureDeliveryEventLabel(event: SignatureDeliveryEventRecord): string {
  return signatureDeliveryEventLabels[event.event_type];
}

export async function createSignatureDeliveryRequest(
  packageId: string
): Promise<SignatureDeliveryRequestRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("create_signature_delivery_request", { package_uuid: packageId });
  if (error) throw toReadableDeliveryError(error);
  return data as SignatureDeliveryRequestRecord;
}

export async function queueSignatureDeliveryRequest(
  deliveryId: string
): Promise<SignatureDeliveryRequestRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("queue_signature_delivery_request", { delivery_uuid: deliveryId });
  if (error) throw toReadableDeliveryError(error);
  return data as SignatureDeliveryRequestRecord;
}

export async function cancelSignatureDeliveryRequest(
  deliveryId: string,
  reason: string
): Promise<SignatureDeliveryRequestRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("cancel_signature_delivery_request", {
    delivery_uuid: deliveryId,
    reason_text: reason.trim(),
  });
  if (error) throw toReadableDeliveryError(error);
  return data as SignatureDeliveryRequestRecord;
}

async function fetchSignatureDeliveries(): Promise<SignatureDeliveryRequestRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("signature_delivery_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw toReadableDeliveryError(error);
  return (data ?? []) as SignatureDeliveryRequestRecord[];
}

export async function fetchBuyerSignatureDeliveries(): Promise<SignatureDeliveryRequestRecord[]> {
  return fetchSignatureDeliveries();
}

export async function fetchManufacturerSignatureDeliveries(): Promise<SignatureDeliveryRequestRecord[]> {
  return fetchSignatureDeliveries();
}

export async function fetchAdminSignatureDeliveries(): Promise<SignatureDeliveryRequestRecord[]> {
  return fetchSignatureDeliveries();
}

export async function fetchSignatureDeliveryRecipients(
  deliveryId: string
): Promise<SignatureDeliveryRecipientRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("signature_delivery_recipients")
    .select("*")
    .eq("delivery_request_id", deliveryId)
    .order("signing_order", { ascending: true });
  if (error) throw toReadableDeliveryError(error);
  return sortSignatureDeliveryRecipients((data ?? []) as SignatureDeliveryRecipientRecord[]);
}

export async function fetchSignatureDeliveryEvents(
  deliveryId: string
): Promise<SignatureDeliveryEventRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("signature_delivery_events")
    .select("*")
    .eq("delivery_request_id", deliveryId)
    .order("created_at", { ascending: true });
  if (error) throw toReadableDeliveryError(error);
  return (data ?? []) as SignatureDeliveryEventRecord[];
}
