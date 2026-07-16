import { useEffect, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import {
  emptySignatureParticipantValues,
  fetchManufacturerSignaturePackages,
  fetchSignatureParticipants,
  findSignatureParticipant,
  updateManufacturerSignatureParticipant,
  validateSignatureParticipant,
} from "../../lib/signaturePreparation";
import type {
  SignaturePackageRecord,
  SignatureParticipantRecord,
  SignatureParticipantValues,
} from "../../types";
import { SignaturePackageSummary } from "./SignaturePackageSummary";

interface ManufacturerSignaturePreparationProps {
  authMode: "supabase" | "demo";
}

export function ManufacturerSignaturePreparation({ authMode }: ManufacturerSignaturePreparationProps) {
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
        setPackages([]);
        setParticipantsByPackage({});
      } else {
        const packageRows = await fetchManufacturerSignaturePackages();
        const participantEntries = await Promise.all(
          packageRows.map(async (item) => [item.id, await fetchSignatureParticipants(item.id)] as const)
        );
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

  function selectPackage(item: SignaturePackageRecord) {
    const participant = findSignatureParticipant(participantsByPackage[item.id] ?? [], "manufacturer_signer");
    setSelectedPackage(item);
    setValues(emptySignatureParticipantValues(participant));
    setErrors([]);
    setMessage(null);
  }

  async function saveManufacturerSigner() {
    if (!selectedPackage) return;
    const validationErrors = validateSignatureParticipant(values);
    setErrors(validationErrors);
    if (validationErrors.length > 0) return;

    setIsSaving(true);
    try {
      await updateManufacturerSignatureParticipant(selectedPackage.id, values);
      await loadPackages();
      setMessage("Manufacturer signer saved.");
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to save Manufacturer signer."]);
    } finally {
      setIsSaving(false);
    }
  }

  const selectedParticipants = selectedPackage ? participantsByPackage[selectedPackage.id] ?? [] : [];
  const buyerSigner = findSignatureParticipant(selectedParticipants, "buyer_signer");

  return (
    <section className="quote-panel">
      <h4>Signature Preparation</h4>
      {isLoading && <LoadingState message="Loading signature preparation..." />}
      <ErrorList errors={errors} />
      {message && <p className="form-success">{message}</p>}
      {packages.length === 0 && !isLoading && <p>No signature packages assigned yet.</p>}
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
          {selectedPackage.status === "ready_to_send" && <p>Prepared only - not sent or signed.</p>}
          <div className="quote-line-items">
            <div className="meta-row">
              <span>Order 1: Buyer signer</span>
              <span>{buyerSigner?.full_name ?? "Buyer signer pending"}</span>
              <span>{buyerSigner?.email ?? "Email pending"}</span>
            </div>
          </div>
          <label>
            Manufacturer signer name
            <input
              value={values.fullName}
              disabled={selectedPackage.status !== "draft"}
              onChange={(event) => setValues((current) => ({ ...current, fullName: event.target.value }))}
            />
          </label>
          <label>
            Manufacturer signer email
            <input
              type="email"
              value={values.email}
              disabled={selectedPackage.status !== "draft"}
              onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))}
            />
          </label>
          <label>
            Manufacturer signer title
            <input
              value={values.title}
              disabled={selectedPackage.status !== "draft"}
              onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))}
            />
          </label>
          <div className="actions">
            {selectedPackage.status === "draft" && (
              <button type="button" disabled={isSaving} onClick={() => void saveManufacturerSigner()}>
                Save Manufacturer Signer
              </button>
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
