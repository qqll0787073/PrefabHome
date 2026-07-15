import { useEffect, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import { fetchAdminContracts, fetchContractEvents, fetchContractReviewDecisions } from "../../lib/contracts";
import type { ContractEventRecord, ContractRecord, ContractReviewDecisionRecord } from "../../types";
import { ContractSummary } from "./ContractSummary";

interface AdminContractManagementProps {
  authMode: "supabase" | "demo";
}

export function AdminContractManagement({ authMode }: AdminContractManagementProps) {
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [eventsByContract, setEventsByContract] = useState<Record<string, ContractEventRecord[]>>({});
  const [decisionsByContract, setDecisionsByContract] = useState<Record<string, ContractReviewDecisionRecord[]>>({});
  const [isLoading, setIsLoading] = useState(authMode === "supabase");
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    async function loadContracts() {
      setErrors([]);
      setIsLoading(true);
      try {
        if (authMode === "demo") {
          setContracts([]);
          setEventsByContract({});
          setDecisionsByContract({});
        } else {
          const rows = await fetchAdminContracts();
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

    void loadContracts();
  }, [authMode]);

  return (
    <section className="quote-panel">
      <h4>Contract Management</h4>
      {isLoading && <LoadingState message="Loading contracts..." />}
      <ErrorList errors={errors} />
      {contracts.length === 0 && !isLoading && <p>No contracts yet.</p>}
      <div className="review-list">
        {contracts.map((contract) => (
          <ContractSummary
            key={contract.id}
            contract={contract}
            decisions={decisionsByContract[contract.id] ?? []}
            events={eventsByContract[contract.id] ?? []}
            showSnapshots
          />
        ))}
      </div>
      <p className="form-notice">Admin contract access is read-only in PH-008A.</p>
    </section>
  );
}
