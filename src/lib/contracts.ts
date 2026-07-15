import { formatMoney } from "./quotes";
import { supabase } from "./supabase";
import type {
  ContractDraftValues,
  ContractEventRecord,
  ContractRecord,
  ContractReviewDecisionRecord,
  ContractReviewDecisionValue,
  ContractStatus,
  PurchaseOrderRecord,
} from "../types";

export const contractStatusLabels: Record<ContractStatus, string> = {
  draft: "Draft",
  ready: "Ready",
  participant_review: "Participant review",
  revision_requested: "Revision requested",
  accepted: "Accepted by Manufacturer",
  rejected: "Rejected",
};

export const contractEventLabels: Record<ContractEventRecord["event_type"], string> = {
  contract_created: "Contract created",
  contract_updated: "Contract updated",
  contract_ready: "Contract ready",
  contract_participant_opened: "Participant opened",
  contract_revision_requested: "Revision requested",
  contract_resubmitted: "Contract resubmitted",
  contract_accepted: "Contract accepted",
  contract_rejected: "Contract rejected",
};

export const contractDecisionLabels: Record<ContractReviewDecisionValue, string> = {
  accepted: "Accepted by Manufacturer",
  rejected: "Rejected",
  revision_requested: "Revision requested",
};

export const contractTitleMaxLength = 200;
export const governingLawMaxLength = 120;
export const contractTermsMaxLength = 8000;
export const contractReviewReasonMaxLength = 4000;

function ensureSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

function toReadableContractError(error: { message?: string }): Error {
  const message = error.message?.toLowerCase() ?? "";

  if (message.includes("row-level security") || message.includes("permission denied")) {
    return new Error("You are not authorized to access this contract.");
  }
  if (message.includes("confirmed purchase orders")) {
    return new Error("Contracts can be created only from confirmed purchase orders.");
  }
  if (message.includes("already exists") || message.includes("contracts_purchase_order_unique")) {
    return new Error("A contract already exists for this purchase order.");
  }
  if (message.includes("draft")) {
    return new Error("Only draft contracts can be changed.");
  }
  if (message.includes("participant review")) {
    return new Error("Contract must be in participant review.");
  }
  if (message.includes("revision-requested") || message.includes("revision requested")) {
    return new Error("Only revision-requested contracts can be revised.");
  }
  if (message.includes("reason")) {
    return new Error(`A reason is required and must be ${contractReviewReasonMaxLength} characters or fewer.`);
  }
  if (message.includes("title")) {
    return new Error(`Contract title must be ${contractTitleMaxLength} characters or fewer.`);
  }
  if (message.includes("governing law")) {
    return new Error(`Governing law must be ${governingLawMaxLength} characters or fewer.`);
  }
  if (message.includes("terms")) {
    return new Error(`Contract terms must be ${contractTermsMaxLength} characters or fewer.`);
  }

  return new Error(error.message ?? "Unable to manage contract.");
}

export function emptyContractDraftValues(contract?: ContractRecord | null): ContractDraftValues {
  return {
    contractTitle: contract?.contract_title ?? "",
    governingLaw: contract?.governing_law ?? "",
    contractTerms: contract?.contract_terms ?? "",
  };
}

export function validateContractDraft(values: ContractDraftValues): string[] {
  const errors: string[] = [];

  if (values.contractTitle.length > contractTitleMaxLength) {
    errors.push(`Contract title must be ${contractTitleMaxLength} characters or fewer.`);
  }
  if (values.governingLaw.length > governingLawMaxLength) {
    errors.push(`Governing law must be ${governingLawMaxLength} characters or fewer.`);
  }
  if (values.contractTerms.length > contractTermsMaxLength) {
    errors.push(`Contract terms must be ${contractTermsMaxLength} characters or fewer.`);
  }

  return errors;
}

export function validateContractReady(values: ContractDraftValues): string[] {
  const errors = validateContractDraft(values);
  if (!values.contractTitle.trim()) errors.push("Contract title is required.");
  return errors;
}

export function isContractReadOnly(contract: Pick<ContractRecord, "status">): boolean {
  return contract.status !== "draft" && contract.status !== "revision_requested";
}

export function isContractTerminal(contract: Pick<ContractRecord, "status">): boolean {
  return contract.status === "accepted" || contract.status === "rejected";
}

export function canBuyerEditContractRevision(contract: Pick<ContractRecord, "status">): boolean {
  return contract.status === "revision_requested";
}

export function canBuyerResubmitContract(contract: Pick<ContractRecord, "status">): boolean {
  return contract.status === "revision_requested";
}

export function canManufacturerOpenContract(contract: Pick<ContractRecord, "status">): boolean {
  return contract.status === "ready";
}

export function getManufacturerContractActions(
  contract: Pick<ContractRecord, "status">
): ContractReviewDecisionValue[] {
  return contract.status === "participant_review" ? ["accepted", "rejected", "revision_requested"] : [];
}

export function canCreateContractForPurchaseOrder(
  purchaseOrder: Pick<PurchaseOrderRecord, "id" | "status">,
  contracts: Pick<ContractRecord, "purchase_order_id">[]
): boolean {
  return purchaseOrder.status === "confirmed" && !contracts.some((contract) => contract.purchase_order_id === purchaseOrder.id);
}

export function contractSubtotalLabel(contract: Pick<ContractRecord, "subtotal" | "currency">): string {
  return formatMoney(contract.subtotal, contract.currency);
}

export function contractReadyAtLabel(contract: Pick<ContractRecord, "status" | "ready_at">): string | null {
  if (!["ready", "participant_review", "revision_requested", "accepted", "rejected"].includes(contract.status) || !contract.ready_at) return null;
  return `Ready ${new Date(contract.ready_at).toLocaleString()}`;
}

export function contractCreatedAtLabel(contract: Pick<ContractRecord, "created_at">): string {
  return `Created ${new Date(contract.created_at).toLocaleString()}`;
}

export function contractFirstReadyAtLabel(
  contract: Pick<ContractRecord, "status" | "first_ready_at">
): string | null {
  if (contract.status === "draft" || !contract.first_ready_at) return null;
  return `First ready ${new Date(contract.first_ready_at).toLocaleString()}`;
}

export function contractLastReadyAtLabel(
  contract: Pick<ContractRecord, "review_round" | "first_ready_at" | "last_ready_at">
): string | null {
  if (!contract.last_ready_at) return null;
  if (contract.review_round <= 1) return null;
  if (
    contract.first_ready_at &&
    new Date(contract.first_ready_at).getTime() === new Date(contract.last_ready_at).getTime()
  ) {
    return null;
  }
  return `Last ready ${new Date(contract.last_ready_at).toLocaleString()}`;
}

export function contractAcceptedAtLabel(contract: Pick<ContractRecord, "status" | "accepted_at">): string | null {
  if (contract.status !== "accepted" || !contract.accepted_at) return null;
  return `Accepted ${new Date(contract.accepted_at).toLocaleString()}`;
}

export function contractRejectedAtLabel(contract: Pick<ContractRecord, "status" | "rejected_at">): string | null {
  if (contract.status !== "rejected" || !contract.rejected_at) return null;
  return `Rejected ${new Date(contract.rejected_at).toLocaleString()}`;
}

export function contractReviewRoundLabel(contract: Pick<ContractRecord, "review_round">): string {
  return contract.review_round > 0 ? `Review round ${contract.review_round}` : "Draft round";
}

export function contractEventLabel(event: ContractEventRecord): string {
  return contractEventLabels[event.event_type];
}

export function contractReadyConfirmationText(contract: ContractRecord): string {
  return `Mark ${contract.contract_number} ready for participant review?`;
}

export function contractResubmitConfirmationText(contract: ContractRecord): string {
  return `Resubmit ${contract.contract_number} for review round ${contract.review_round + 1}? PO pricing, line items, ownership, and snapshots remain unchanged.`;
}

export function manufacturerContractDecisionConfirmationText(
  contract: ContractRecord,
  decision: ContractReviewDecisionValue
): string {
  if (decision === "accepted") {
    return `Accept content for ${contract.contract_number}? This does not sign the Contract and does not make it executed or legally effective.`;
  }
  if (decision === "revision_requested") {
    return `Request revision for ${contract.contract_number}? Commercial snapshots remain immutable.`;
  }
  return `${contractDecisionLabels[decision]} ${contract.contract_number}?`;
}

export function validateContractReviewReason(
  decision: ContractReviewDecisionValue,
  reason: string
): string[] {
  const errors: string[] = [];
  const trimmed = reason.trim();
  if ((decision === "rejected" || decision === "revision_requested") && !trimmed) {
    errors.push("A reason is required.");
  }
  if (reason.length > contractReviewReasonMaxLength) {
    errors.push(`Reason must be ${contractReviewReasonMaxLength} characters or fewer.`);
  }
  return errors;
}

export function sortContractReviewDecisions(
  decisions: ContractReviewDecisionRecord[] = []
): ContractReviewDecisionRecord[] {
  return [...decisions].sort((a, b) => {
    if (a.review_round !== b.review_round) return a.review_round - b.review_round;
    return a.created_at.localeCompare(b.created_at);
  });
}

export function contractParticipantName(snapshot: Record<string, unknown>, fallback: string): string {
  const displayName = snapshot.company_display_name ?? snapshot.full_name ?? snapshot.company_name ?? snapshot.email;
  return typeof displayName === "string" && displayName.trim() ? displayName : fallback;
}

export async function createContractFromPurchaseOrder(poId: string): Promise<ContractRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("create_contract_from_po", { po_uuid: poId });
  if (error) throw toReadableContractError(error);
  return data as ContractRecord;
}

export async function updateContractDraft(
  contractId: string,
  values: ContractDraftValues
): Promise<ContractRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("update_contract_draft", {
    contract_uuid: contractId,
    contract_title_text: values.contractTitle.trim() || null,
    governing_law_text: values.governingLaw.trim() || null,
    contract_terms_text: values.contractTerms.trim() || null,
  });
  if (error) throw toReadableContractError(error);
  return data as ContractRecord;
}

export async function markContractReady(contractId: string): Promise<ContractRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("mark_contract_ready", { contract_uuid: contractId });
  if (error) throw toReadableContractError(error);
  return data as ContractRecord;
}

export async function recordContractOpened(contractId: string): Promise<void> {
  const client = ensureSupabase();
  const { error } = await client.rpc("record_contract_opened", { contract_uuid: contractId });
  if (error) throw toReadableContractError(error);
}

export async function acceptContract(
  contractId: string,
  note = ""
): Promise<ContractReviewDecisionRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("accept_contract", {
    contract_uuid: contractId,
    note_text: note.trim() || null,
  });
  if (error) throw toReadableContractError(error);
  return data as ContractReviewDecisionRecord;
}

export async function rejectContract(
  contractId: string,
  reason: string
): Promise<ContractReviewDecisionRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("reject_contract", {
    contract_uuid: contractId,
    reason_text: reason.trim(),
  });
  if (error) throw toReadableContractError(error);
  return data as ContractReviewDecisionRecord;
}

export async function requestContractRevision(
  contractId: string,
  reason: string
): Promise<ContractReviewDecisionRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("request_contract_revision", {
    contract_uuid: contractId,
    reason_text: reason.trim(),
  });
  if (error) throw toReadableContractError(error);
  return data as ContractReviewDecisionRecord;
}

export async function updateContractRevision(
  contractId: string,
  values: ContractDraftValues
): Promise<ContractRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("update_contract_revision", {
    contract_uuid: contractId,
    contract_title_text: values.contractTitle.trim() || null,
    governing_law_text: values.governingLaw.trim() || null,
    contract_terms_text: values.contractTerms.trim() || null,
  });
  if (error) throw toReadableContractError(error);
  return data as ContractRecord;
}

export async function resubmitContract(contractId: string): Promise<ContractRecord> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("resubmit_contract", { contract_uuid: contractId });
  if (error) throw toReadableContractError(error);
  return data as ContractRecord;
}

async function fetchContracts(): Promise<ContractRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("contracts")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw toReadableContractError(error);
  return (data ?? []) as ContractRecord[];
}

export async function fetchBuyerContracts(): Promise<ContractRecord[]> {
  return fetchContracts();
}

export async function fetchManufacturerContracts(): Promise<ContractRecord[]> {
  return fetchContracts();
}

export async function fetchAdminContracts(): Promise<ContractRecord[]> {
  return fetchContracts();
}

export async function fetchContractEvents(contractId: string): Promise<ContractEventRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("contract_events")
    .select("*")
    .eq("contract_id", contractId)
    .order("created_at", { ascending: true });
  if (error) throw toReadableContractError(error);
  return (data ?? []) as ContractEventRecord[];
}

export async function fetchContractReviewDecisions(
  contractId: string
): Promise<ContractReviewDecisionRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("contract_review_decisions")
    .select("*")
    .eq("contract_id", contractId)
    .order("review_round", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw toReadableContractError(error);
  return sortContractReviewDecisions((data ?? []) as ContractReviewDecisionRecord[]);
}
