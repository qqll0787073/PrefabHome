import { useEffect, useMemo, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import { fetchBuyerContracts } from "../../lib/contracts";
import {
  canPrepareSignaturePackage,
  createSignaturePackage,
  emptySignatureParticipantValues,
  fetchBuyerSignaturePackages,
  fetchSignatureParticipants,
  findSignatureParticipant,
  isSignaturePackageReadyEligible,
  markSignaturePackageReady,
  signaturePackageReadyConfirmationText,
  signatureReadinessReason,
  updateBuyerSignatureParticipant,
  validateSignatureParticipant,
} from "../../lib/signaturePreparation";
import type {
  ContractRecord,
  SignaturePackageRecord,
  SignatureParticipantRecord,
  SignatureParticipantValues,
} from "../../types";
import { SignaturePackageSummary } from "./SignaturePackageSummary";

interface BuyerSignaturePreparationProps {
  authMode: "supabase" | "demo";
}

export function BuyerSignaturePreparation({ authMode }: BuyerSignaturePreparationProps) {
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [packages, setPackages] = useState<SignaturePackageRecord[]>([]);
  const [participantsByPackage, setParticipantsByPackage] = useState<Record<string, SignatureParticipantRecord[]>>({});
  const [selectedPackage, setSelectedPackage] = useState<SignaturePackageRecord | null>(null);
  const [values, setValues] = useState<SignatureParticipantValues>(() => emptySignatureParticipantValues());
  const [isLoading, setIsLoading] = useState(authMode === "supabase");
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  async function loadPackages() {
    setErrors([]);
    setIsLoading(true);
    try {
      if (authMode === "demo") {
        setContracts([]);
        setPackages([]);
        setParticipantsByPackage({});
      } else {
        const [contractRows, packageRows] = await Promise.all([
          fetchBuyerContracts(),
          fetchBuyerSignaturePackages(),
        ]);
        const participantEntries = await Promise.all(
          packageRows.map(async (item) => [item.id, await fetchSignatureParticipants(item.id)] as const)
        );
        setContracts(contractRows);
        setPackages(packageRows);
        setParticipantsByPackage(Object.fromEntries(participantEntries));
      }
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to load signature preparation."]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadPackages();
  }, [authMode]);

  const eligibleContracts = useMemo(
    () => contracts.filter((contract) => canPrepareSignaturePackage(contract, packages)),
    [contracts, packages]
  );

  function selectPackage(item: SignaturePackageRecord) {
    const participant = findSignatureParticipant(participantsByPackage[item.id] ?? [], "buyer_signer");
    setSelectedPackage(item);
    setValues(emptySignatureParticipantValues(participant));
    setErrors([]);
    setMessage(null);
  }

  async function preparePackage(contractId: string) {
    setIsSaving(true);
    setErrors([]);
    setMessage(null);
    try {
      const created = await createSignaturePackage(contractId);
      await loadPackages();
      setSelectedPackage(created);
      setValues(emptySignatureParticipantValues());
      setMessage("Signature package prepared.");
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to prepare signature package."]);
    } finally {
      setIsSaving(false);
    }
  }

  async function saveBuyerSigner() {
    if (!selectedPackage) return;
    const validationErrors = validateSignatureParticipant(values);
    setErrors(validationErrors);
    if (validationErrors.length > 0) return;

    setIsSaving(true);
    try {
      await updateBuyerSignatureParticipant(selectedPackage.id, values);
      await loadPackages();
      setMessage("Buyer signer saved.");
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to save Buyer signer."]);
    } finally {
      setIsSaving(false);
    }
  }

  async function markReady() {
    if (!selectedPackage) return;
    if (!window.confirm(signaturePackageReadyConfirmationText(selectedPackage))) return;

    setIsSaving(true);
    try {
      const updated = await markSignaturePackageReady(selectedPackage.id);
      await loadPackages();
      setSelectedPackage(updated);
      setMessage("Signature package marked ready to send.");
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to mark signature package ready."]);
    } finally {
      setIsSaving(false);
    }
  }

  const selectedParticipants = selectedPackage ? participantsByPackage[selectedPackage.id] ?? [] : [];
  const manufacturerSigner = findSignatureParticipant(selectedParticipants, "manufacturer_signer");
  const readyEligible = isSignaturePackageReadyEligible(selectedParticipants);

  return (
    <section className="quote-panel">
      <h4>Signature Preparation</h4>
      {isLoading && <LoadingState message="Loading signature preparation..." />}
      <ErrorList errors={errors} />
      {message && <p className="form-success">{message}</p>}
      {eligibleContracts.length > 0 && (
        <div className="actions">
          {eligibleContracts.map((contract) => (
            <button type="button" key={contract.id} disabled={isSaving} onClick={() => void preparePackage(contract.id)}>
              Prepare Signature Package
            </button>
          ))}
        </div>
      )}
      {packages.length === 0 && !isLoading && <p>No signature packages yet.</p>}
      <div className="review-list">
        {packages.map((item) => (
          <div key={item.id}>
            <SignaturePackageSummary signaturePackage={item} participants={participantsByPackage[item.id] ?? []} />
            <div className="actions">
              <button type="button" onClick={() => selectPackage(item)}>
                Open Signature Package
              </button>
            </div>
          </div>
        ))}
      </div>
      {selectedPackage && (
        <section className="quote-line-editor">
          <h4>{selectedPackage.package_number}</h4>
          <p className="form-notice">{selectedPackage.contract_number}</p>
          <p className="form-notice">{signatureReadinessReason(selectedParticipants)}</p>
          {selectedPackage.status === "ready_to_send" && <p>Prepared only - not sent or signed.</p>}
          <label>
            Buyer signer name
            <input
              value={values.fullName}
              disabled={selectedPackage.status !== "draft"}
              onChange={(event) => setValues((current) => ({ ...current, fullName: event.target.value }))}
            />
          </label>
          <label>
            Buyer signer email
            <input
              type="email"
              value={values.email}
              disabled={selectedPackage.status !== "draft"}
              onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))}
            />
          </label>
          <label>
            Buyer signer title
            <input
              value={values.title}
              disabled={selectedPackage.status !== "draft"}
              onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))}
            />
          </label>
          <div className="quote-line-items">
            <div className="meta-row">
              <span>Order 2: Manufacturer signer</span>
              <span>{manufacturerSigner?.full_name ?? "Waiting for Manufacturer signer details"}</span>
              <span>{manufacturerSigner?.email ?? "Email pending"}</span>
            </div>
          </div>
          <div className="actions">
            {selectedPackage.status === "draft" && (
              <>
                <button type="button" disabled={isSaving} onClick={() => void saveBuyerSigner()}>
                  Save Buyer Signer
                </button>
                {readyEligible && (
                  <button type="button" disabled={isSaving} onClick={() => void markReady()}>
                    Mark Ready to Send
                  </button>
                )}
              </>
            )}
            <button type="button" onClick={() => setSelectedPackage(null)}>
              Close
            </button>
          </div>
        </section>
      )}
    </section>
  );
}
