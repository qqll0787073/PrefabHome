import { formatMoney } from "./quotes";
import { supabase } from "./supabase";
import type {
  ContractDraftValues,
  ContractEventRecord,
  ContractRecord,
  ContractStatus,
  PurchaseOrderRecord,
} from "../types";

export const contractStatusLabels: Record<ContractStatus, string> = {
  draft: "Draft",
  ready: "Ready",
};

export const contractEventLabels: Record<ContractEventRecord["event_type"], string> = {
  contract_created: "Contract created",
  contract_updated: "Contract updated",
  contract_ready: "Contract ready",
};

export const contractTitleMaxLength = 200;
export const governingLawMaxLength = 120;
export const contractTermsMaxLength = 8000;

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
  return contract.status !== "draft";
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
  if (contract.status !== "ready" || !contract.ready_at) return null;
  return `Ready ${new Date(contract.ready_at).toLocaleString()}`;
}

export function contractCreatedAtLabel(contract: Pick<ContractRecord, "created_at">): string {
  return `Created ${new Date(contract.created_at).toLocaleString()}`;
}

export function contractEventLabel(event: ContractEventRecord): string {
  return contractEventLabels[event.event_type];
}

export function contractReadyConfirmationText(contract: ContractRecord): string {
  return `Mark ${contract.contract_number} ready for participant review?`;
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
