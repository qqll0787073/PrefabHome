import { supabase } from "./supabase";
import type {
  ContractRecord,
  SignaturePackageEventRecord,
  SignaturePackageRecord,
  SignaturePackageStatus,
  SignatureParticipantRecord,
  SignatureParticipantRole,
  SignatureParticipantValues,
} from "../types";

export const signaturePackageStatusLabels: Record<SignaturePackageStatus, string> = {
  draft: "Draft",
  ready_to_send: "Ready to Send",
};

export const signatureParticipantLabels: Record<SignatureParticipantRole, string> = {
  buyer_signer: "Buyer signer",
  manufacturer_signer: "Manufacturer signer",
};

export const signaturePackageEventLabels: Record<SignaturePackageEventRecord["event_type"], string> = {
  signature_package_created: "Signature package created",
  signature_participant_updated: "Signature participant updated",
  signature_package_ready: "Signature package ready to send",
};

export const signerNameMaxLength = 160;
export const signerEmailMaxLength = 254;
export const signerTitleMaxLength = 120;

const signerEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ensureSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

function toReadableSignatureError(error: { message?: string }): Error {
  const message = error.message?.toLowerCase() ?? "";

  if (message.includes("row-level security") || message.includes("permission denied")) {
    return new Error("You are not authorized to access this signature package.");
  }
  if (message.includes("accepted contracts")) {
    return new Error("Signature packages can be created only from accepted contracts.");
  }
  if (message.includes("accepted contract decision")) {
    return new Error("Accepted contract decision is required before signature preparation.");
  }
  if (message.includes("already exists") || message.includes("signature_packages_contract_unique")) {
    return new Error("A signature package already exists for this contract.");
  }
  if (message.includes("draft signature packages")) {
    return new Error("Only draft signature packages can be changed.");
  }
  if (message.includes("name")) {
    return new Error("Signer name is required and must be 160 characters or fewer.");
  }
  if (message.includes("email")) {
    return new Error("Signer email must be valid.");
  }
  if (message.includes("title")) {
    return new Error("Signer title must be 120 characters or fewer.");
  }
  if (message.includes("buyer signer")) {
    return new Error("Buyer signer must be complete before marking ready to send.");
  }
  if (message.includes("manufacturer signer")) {
    return new Error("Manufacturer signer must be complete before marking ready to send.");
  }

  return new Error(error.message ?? "Unable to manage signature preparation.");
}

export function emptySignatureParticipantValues(
  participant?: SignatureParticipantRecord | null
): SignatureParticipantValues {
  return {
    fullName: participant?.full_name ?? "",
    email: participant?.email ?? "",
    title: participant?.title ?? "",
  };
}

export function validateSignatureParticipant(values: SignatureParticipantValues): string[] {
  const errors: string[] = [];
  const fullName = values.fullName.trim();
  const email = values.email.trim();

  if (!fullName) {
    errors.push("Signer name is required.");
  } else if (fullName.length > signerNameMaxLength) {
    errors.push(`Signer name must be ${signerNameMaxLength} characters or fewer.`);
  }

  if (!email) {
    errors.push("Signer email is required.");
  } else if (email.length > signerEmailMaxLength || !signerEmailPattern.test(email)) {
    errors.push("Signer email must be valid.");
  }

  if (values.title.length > signerTitleMaxLength) {
    errors.push(`Signer title must be ${signerTitleMaxLength} characters or fewer.`);
  }

  return errors;
}

export function canPrepareSignaturePackage(
  contract: Pick<ContractRecord, "id" | "status">,
  packages: Pick<SignaturePackageRecord, "contract_id">[]
): boolean {
  return contract.status === "accepted" && !packages.some((item) => item.contract_id === contract.id);
}

export function isSignaturePackageReadOnly(
  signaturePackage: Pick<SignaturePackageRecord, "status">
): boolean {
  return signaturePackage.status !== "draft";
}

export function isSignatureParticipantComplete(
  participant: Pick<SignatureParticipantRecord, "full_name" | "email"> | null | undefined
): boolean {
  return Boolean(
    participant?.full_name?.trim() &&
      participant.email?.trim() &&
      signerEmailPattern.test(participant.email.trim())
  );
}

export function findSignatureParticipant(
  participants: SignatureParticipantRecord[],
  role: SignatureParticipantRole
): SignatureParticipantRecord | null {
  return participants.find((participant) => participant.participant_role === role) ?? null;
}

export function sortSignatureParticipants(
  participants: SignatureParticipantRecord[] = []
): SignatureParticipantRecord[] {
  return [...participants].sort((a, b) => a.signing_order - b.signing_order);
}

export function isSignaturePackageReadyEligible(
  participants: SignatureParticipantRecord[]
): boolean {
  return (
    isSignatureParticipantComplete(findSignatureParticipant(participants, "buyer_signer")) &&
    isSignatureParticipantComplete(findSignatureParticipant(participants, "manufacturer_signer"))
  );
}

export function signatureReadinessReason(
  participants: SignatureParticipantRecord[]
): string {
  const buyerComplete = isSignatureParticipantComplete(findSignatureParticipant(participants, "buyer_signer"));
  const manufacturerComplete = isSignatureParticipantComplete(
    findSignatureParticipant(participants, "manufacturer_signer")
  );

  if (buyerComplete && manufacturerComplete) return "Both signers are complete.";
  if (!buyerComplete && !manufacturerComplete) return "Waiting for Buyer and Manufacturer signer details.";
  if (!buyerComplete) return "Waiting for Buyer signer details.";
  return "Waiting for Manufacturer signer details.";
}

export function signaturePackageReadyConfirmationText(
  signaturePackage: Pick<SignaturePackageRecord, "package_number" | "contract_number">
): string {
  return `Mark ${signaturePackage.package_number} ready to send for ${signaturePackage.contract_number}? This does not send the package, does not sign the Contract, does not execute the Contract, and does not make it legally effective.`;
}

export function signaturePackageReadyAtLabel(
  signaturePackage: Pick<SignaturePackageRecord, "status" | "ready_at">
): string | null {
  if (signaturePackage.status !== "ready_to_send" || !signaturePackage.ready_at) return null;
  return `Ready ${new Date(signaturePackage.ready_at).toLocaleString()}`;
}

export function signatureParticipantOrderLabel(
  participant: Pick<SignatureParticipantRecord, "signing_order" | "participant_role">
): string {
  return `Order ${participant.signing_order}: ${signatureParticipantLabels[participant.participant_role]}`;
}

export function signaturePackageEventLabel(event: SignaturePackageEventRecord): string {
  return signaturePackageEventLabels[event.event_type];
}

export async function createSignaturePackage(contractId: string): Promise<SignaturePackageRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("create_signature_package", { contract_uuid: contractId });
  if (error) throw toReadableSignatureError(error);
  return data as SignaturePackageRecord;
}

async function fetchSignaturePackages(): Promise<SignaturePackageRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("signature_packages")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw toReadableSignatureError(error);
  return (data ?? []) as SignaturePackageRecord[];
}

export async function fetchBuyerSignaturePackages(): Promise<SignaturePackageRecord[]> {
  return fetchSignaturePackages();
}

export async function fetchManufacturerSignaturePackages(): Promise<SignaturePackageRecord[]> {
  return fetchSignaturePackages();
}

export async function fetchAdminSignaturePackages(): Promise<SignaturePackageRecord[]> {
  return fetchSignaturePackages();
}

export async function fetchSignatureParticipants(
  packageId: string
): Promise<SignatureParticipantRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("signature_participants")
    .select("*")
    .eq("signature_package_id", packageId)
    .order("signing_order", { ascending: true });
  if (error) throw toReadableSignatureError(error);
  return sortSignatureParticipants((data ?? []) as SignatureParticipantRecord[]);
}

export async function fetchSignaturePackageEvents(
  packageId: string
): Promise<SignaturePackageEventRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("signature_package_events")
    .select("*")
    .eq("signature_package_id", packageId)
    .order("created_at", { ascending: true });
  if (error) throw toReadableSignatureError(error);
  return (data ?? []) as SignaturePackageEventRecord[];
}

export async function updateBuyerSignatureParticipant(
  packageId: string,
  values: SignatureParticipantValues
): Promise<SignatureParticipantRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("update_buyer_signature_participant", {
    package_uuid: packageId,
    full_name_text: values.fullName.trim(),
    email_text: values.email.trim(),
    title_text: values.title.trim() || null,
  });
  if (error) throw toReadableSignatureError(error);
  return data as SignatureParticipantRecord;
}

export async function updateManufacturerSignatureParticipant(
  packageId: string,
  values: SignatureParticipantValues
): Promise<SignatureParticipantRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("update_manufacturer_signature_participant", {
    package_uuid: packageId,
    full_name_text: values.fullName.trim(),
    email_text: values.email.trim(),
    title_text: values.title.trim() || null,
  });
  if (error) throw toReadableSignatureError(error);
  return data as SignatureParticipantRecord;
}

export async function markSignaturePackageReady(
  packageId: string
): Promise<SignaturePackageRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("mark_signature_package_ready", { package_uuid: packageId });
  if (error) throw toReadableSignatureError(error);
  return data as SignaturePackageRecord;
}
