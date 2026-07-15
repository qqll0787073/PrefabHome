import { useEffect, useMemo, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import {
  canCreateContractForPurchaseOrder,
  canBuyerEditContractRevision,
  canBuyerResubmitContract,
  contractReadyConfirmationText,
  contractResubmitConfirmationText,
  createContractFromPurchaseOrder,
  emptyContractDraftValues,
  fetchBuyerContracts,
  fetchContractReviewDecisions,
  isContractReadOnly,
  markContractReady,
  resubmitContract,
  updateContractDraft,
  updateContractRevision,
  validateContractDraft,
  validateContractReady,
} from "../../lib/contracts";
import { fetchBuyerPurchaseOrders } from "../../lib/purchaseOrders";
import type {
  ContractDraftValues,
  ContractReviewDecisionRecord,
  ContractRecord,
  PurchaseOrderWithItems,
} from "../../types";
import { ContractSummary } from "./ContractSummary";

interface BuyerContractsProps {
  authMode: "supabase" | "demo";
}

export function BuyerContracts({ authMode }: BuyerContractsProps) {
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [decisionsByContract, setDecisionsByContract] = useState<Record<string, ContractReviewDecisionRecord[]>>({});
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderWithItems[]>([]);
  const [selectedContract, setSelectedContract] = useState<ContractRecord | null>(null);
  const [values, setValues] = useState<ContractDraftValues>(() => emptyContractDraftValues());
  const [isLoading, setIsLoading] = useState(authMode === "supabase");
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  async function loadContracts() {
    setErrors([]);
    setIsLoading(true);
    try {
      if (authMode === "demo") {
        setContracts([]);
        setPurchaseOrders([]);
      } else {
        const [contractRows, purchaseOrderRows] = await Promise.all([
          fetchBuyerContracts(),
          fetchBuyerPurchaseOrders(),
        ]);
        const decisionEntries = await Promise.all(
          contractRows.map(async (contract) => [contract.id, await fetchContractReviewDecisions(contract.id)] as const)
        );
        setContracts(contractRows);
        setDecisionsByContract(Object.fromEntries(decisionEntries));
        setPurchaseOrders(purchaseOrderRows);
      }
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to load contracts."]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadContracts();
  }, [authMode]);

  const eligiblePurchaseOrders = useMemo(
    () => purchaseOrders.filter((po) => canCreateContractForPurchaseOrder(po, contracts)),
    [contracts, purchaseOrders]
  );

  function selectContract(contract: ContractRecord) {
    setSelectedContract(contract);
    setValues(emptyContractDraftValues(contract));
    setErrors([]);
    setMessage(null);
  }

  async function createContract(poId: string) {
    setIsSaving(true);
    setErrors([]);
    setMessage(null);
    try {
      const created = await createContractFromPurchaseOrder(poId);
      await loadContracts();
      setSelectedContract(created);
      setValues(emptyContractDraftValues(created));
      setMessage("Contract draft created.");
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to create contract."]);
    } finally {
      setIsSaving(false);
    }
  }

  async function saveDraft() {
    if (!selectedContract) return;
    const validationErrors = validateContractDraft(values);
    setErrors(validationErrors);
    if (validationErrors.length > 0) return;

    setIsSaving(true);
    try {
      const updated = await updateContractDraft(selectedContract.id, values);
      await loadContracts();
      setSelectedContract(updated);
      setValues(emptyContractDraftValues(updated));
      setMessage("Contract draft saved.");
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to save contract."]);
    } finally {
      setIsSaving(false);
    }
  }

  async function saveRevision() {
    if (!selectedContract) return;
    const validationErrors = validateContractDraft(values);
    setErrors(validationErrors);
    if (validationErrors.length > 0) return;

    setIsSaving(true);
    try {
      const updated = await updateContractRevision(selectedContract.id, values);
      await loadContracts();
      setSelectedContract(updated);
      setValues(emptyContractDraftValues(updated));
      setMessage("Contract revision saved.");
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to save contract revision."]);
    } finally {
      setIsSaving(false);
    }
  }

  async function markReady() {
    if (!selectedContract) return;
    const validationErrors = validateContractReady(values);
    setErrors(validationErrors);
    if (validationErrors.length > 0) return;
    if (!window.confirm(contractReadyConfirmationText(selectedContract))) return;

    setIsSaving(true);
    try {
      await updateContractDraft(selectedContract.id, values);
      const updated = await markContractReady(selectedContract.id);
      await loadContracts();
      setSelectedContract(updated);
      setValues(emptyContractDraftValues(updated));
      setMessage("Contract marked ready.");
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to mark contract ready."]);
    } finally {
      setIsSaving(false);
    }
  }

  async function resubmitRevision() {
    if (!selectedContract) return;
    const validationErrors = validateContractReady(values);
    setErrors(validationErrors);
    if (validationErrors.length > 0) return;
    if (!window.confirm(contractResubmitConfirmationText(selectedContract))) return;

    setIsSaving(true);
    try {
      await updateContractRevision(selectedContract.id, values);
      const updated = await resubmitContract(selectedContract.id);
      await loadContracts();
      setSelectedContract(updated);
      setValues(emptyContractDraftValues(updated));
      setMessage("Contract resubmitted for participant review.");
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to resubmit contract."]);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="quote-panel">
      <h4>Contracts</h4>
      {isLoading && <LoadingState message="Loading contracts..." />}
      <ErrorList errors={errors} />
      {message && <p className="form-success">{message}</p>}
      {eligiblePurchaseOrders.length > 0 && (
        <div className="actions">
          {eligiblePurchaseOrders.map((po) => (
            <button type="button" key={po.id} disabled={isSaving} onClick={() => void createContract(po.id)}>
              Create Contract
            </button>
          ))}
        </div>
      )}
      {contracts.length === 0 && !isLoading && <p>No contracts yet.</p>}
      <div className="review-list">
        {contracts.map((contract) => (
          <div key={contract.id}>
            <ContractSummary contract={contract} decisions={decisionsByContract[contract.id] ?? []} />
            <div className="actions">
              <button type="button" onClick={() => selectContract(contract)}>
                Open Contract
              </button>
            </div>
          </div>
        ))}
      </div>
      {selectedContract && (
        <section className="quote-line-editor">
          <h4>{selectedContract.contract_number}</h4>
          {canBuyerEditContractRevision(selectedContract) && (
            <p className="form-notice">
              Manufacturer requested revision. Only title, governing law, and terms can be changed.
            </p>
          )}
          <label>
            Contract title
            <input
              value={values.contractTitle}
              disabled={isContractReadOnly(selectedContract)}
              onChange={(event) => setValues((current) => ({ ...current, contractTitle: event.target.value }))}
            />
          </label>
          <label>
            Governing law
            <input
              value={values.governingLaw}
              disabled={isContractReadOnly(selectedContract)}
              onChange={(event) => setValues((current) => ({ ...current, governingLaw: event.target.value }))}
            />
          </label>
          <label>
            Contract terms
            <textarea
              value={values.contractTerms}
              disabled={isContractReadOnly(selectedContract)}
              onChange={(event) => setValues((current) => ({ ...current, contractTerms: event.target.value }))}
            />
          </label>
          <div className="actions">
            {selectedContract.status === "draft" && (
              <>
                <button type="button" disabled={isSaving} onClick={() => void saveDraft()}>
                  Save Draft
                </button>
                <button type="button" disabled={isSaving} onClick={() => void markReady()}>
                  Mark Ready
                </button>
              </>
            )}
            {canBuyerEditContractRevision(selectedContract) && (
              <>
                <button type="button" disabled={isSaving} onClick={() => void saveRevision()}>
                  Save Revision
                </button>
                {canBuyerResubmitContract(selectedContract) && (
                  <button type="button" disabled={isSaving} onClick={() => void resubmitRevision()}>
                    Resubmit Contract
                  </button>
                )}
              </>
            )}
            <button type="button" onClick={() => setSelectedContract(null)}>
              Close
            </button>
          </div>
          {isContractReadOnly(selectedContract) && (
            <p className="form-notice">This Contract is read-only for the Buyer in its current status.</p>
          )}
        </section>
      )}
    </section>
  );
}
