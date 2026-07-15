import { useEffect, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import {
  acceptContract,
  canManufacturerOpenContract,
  fetchContractEvents,
  fetchContractReviewDecisions,
  fetchManufacturerContracts,
  getManufacturerContractActions,
  manufacturerContractDecisionConfirmationText,
  recordContractOpened,
  rejectContract,
  requestContractRevision,
  validateContractReviewReason,
} from "../../lib/contracts";
import type {
  ContractEventRecord,
  ContractRecord,
  ContractReviewDecisionRecord,
  ContractReviewDecisionValue,
} from "../../types";
import { ContractSummary } from "./ContractSummary";

interface ManufacturerContractsProps {
  authMode: "supabase" | "demo";
}

export function ManufacturerContracts({ authMode }: ManufacturerContractsProps) {
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [eventsByContract, setEventsByContract] = useState<Record<string, ContractEventRecord[]>>({});
  const [decisionsByContract, setDecisionsByContract] = useState<Record<string, ContractReviewDecisionRecord[]>>({});
  const [selectedContract, setSelectedContract] = useState<ContractRecord | null>(null);
  const [reason, setReason] = useState("");
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
          setEventsByContract({});
          setDecisionsByContract({});
        } else {
          const rows = await fetchManufacturerContracts();
          const [eventEntries, decisionEntries] = await Promise.all([
            Promise.all(rows.map(async (contract) => [contract.id, await fetchContractEvents(contract.id)] as const)),
            Promise.all(rows.map(async (contract) => [contract.id, await fetchContractReviewDecisions(contract.id)] as const)),
          ]);
          setContracts(rows);
          setEventsByContract(Object.fromEntries(eventEntries));
          setDecisionsByContract(Object.fromEntries(decisionEntries));
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

  function selectContract(contract: ContractRecord) {
    setSelectedContract(contract);
    setReason("");
    setErrors([]);
    setMessage(null);
  }

  async function openForReview(contract: ContractRecord) {
    setIsSaving(true);
    setErrors([]);
    setMessage(null);
    try {
      await recordContractOpened(contract.id);
      await loadContracts();
      setMessage("Contract opened for participant review.");
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to open contract."]);
    } finally {
      setIsSaving(false);
    }
  }

  async function decide(contract: ContractRecord, decision: ContractReviewDecisionValue) {
    const validationErrors = validateContractReviewReason(decision, reason);
    setErrors(validationErrors);
    if (validationErrors.length > 0) return;
    if (!window.confirm(manufacturerContractDecisionConfirmationText(contract, decision))) return;

    setIsSaving(true);
    try {
      if (decision === "accepted") {
        await acceptContract(contract.id, reason);
      } else if (decision === "rejected") {
        await rejectContract(contract.id, reason);
      } else {
        await requestContractRevision(contract.id, reason);
      }
      await loadContracts();
      setSelectedContract(null);
      setReason("");
      setMessage("Contract review decision recorded.");
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to record contract decision."]);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="quote-panel">
      <h4>Contract Inbox</h4>
      {isLoading && <LoadingState message="Loading contracts..." />}
      <ErrorList errors={errors} />
      {message && <p className="form-success">{message}</p>}
      {contracts.length === 0 && !isLoading && <p>No contracts assigned yet.</p>}
      <div className="review-list">
        {contracts.map((contract) => (
          <div key={contract.id}>
            <ContractSummary
              contract={contract}
              decisions={decisionsByContract[contract.id] ?? []}
              events={eventsByContract[contract.id] ?? []}
            />
            <div className="actions">
              {canManufacturerOpenContract(contract) && (
                <button type="button" disabled={isSaving} onClick={() => void openForReview(contract)}>
                  Open for Review
                </button>
              )}
              {getManufacturerContractActions(contract).length > 0 && (
                <button type="button" onClick={() => selectContract(contract)}>
                  Review Contract
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {selectedContract && (
        <section className="quote-line-editor">
          <h4>{selectedContract.contract_number}</h4>
          <p className="form-notice">
            Acceptance is content acceptance only. It does not sign the Contract and does not make it executed or legally effective.
          </p>
          <label>
            Review note or reason
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Required for reject or revision request"
            />
          </label>
          <div className="actions">
            {getManufacturerContractActions(selectedContract).map((action) => (
              <button
                type="button"
                key={action}
                disabled={isSaving}
                onClick={() => void decide(selectedContract, action)}
              >
                {action === "accepted"
                  ? "Accept Contract"
                  : action === "rejected"
                    ? "Reject Contract"
                    : "Request Revision"}
              </button>
            ))}
            <button type="button" onClick={() => setSelectedContract(null)}>
              Close
            </button>
          </div>
        </section>
      )}
    </section>
  );
}
