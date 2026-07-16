import { useEffect, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import {
  fetchAdminSignaturePackages,
  fetchSignaturePackageEvents,
  fetchSignatureParticipants,
} from "../../lib/signaturePreparation";
import type {
  SignaturePackageEventRecord,
  SignaturePackageRecord,
  SignatureParticipantRecord,
} from "../../types";
import { SignaturePackageSummary } from "./SignaturePackageSummary";

interface AdminSignaturePreparationProps {
  authMode: "supabase" | "demo";
}

export function AdminSignaturePreparation({ authMode }: AdminSignaturePreparationProps) {
  const [packages, setPackages] = useState<SignaturePackageRecord[]>([]);
  const [participantsByPackage, setParticipantsByPackage] = useState<Record<string, SignatureParticipantRecord[]>>({});
  const [eventsByPackage, setEventsByPackage] = useState<Record<string, SignaturePackageEventRecord[]>>({});
  const [isLoading, setIsLoading] = useState(authMode === "supabase");
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    async function loadPackages() {
      setErrors([]);
      setIsLoading(true);
      try {
        if (authMode === "demo") {
          setPackages([]);
          setParticipantsByPackage({});
          setEventsByPackage({});
        } else {
          const packageRows = await fetchAdminSignaturePackages();
          const [participantEntries, eventEntries] = await Promise.all([
            Promise.all(packageRows.map(async (item) => [item.id, await fetchSignatureParticipants(item.id)] as const)),
            Promise.all(packageRows.map(async (item) => [item.id, await fetchSignaturePackageEvents(item.id)] as const)),
          ]);
          setPackages(packageRows);
          setParticipantsByPackage(Object.fromEntries(participantEntries));
          setEventsByPackage(Object.fromEntries(eventEntries));
        }
      } catch (error) {
        setErrors([error instanceof Error ? error.message : "Unable to load signature preparation."]);
      } finally {
        setIsLoading(false);
      }
    }

    void loadPackages();
  }, [authMode]);

  return (
    <section className="quote-panel">
      <h4>Signature Preparation Management</h4>
      {isLoading && <LoadingState message="Loading signature packages..." />}
      <ErrorList errors={errors} />
      {packages.length === 0 && !isLoading && <p>No signature packages yet.</p>}
      <div className="review-list">
        {packages.map((item) => (
          <SignaturePackageSummary
            key={item.id}
            signaturePackage={item}
            participants={participantsByPackage[item.id] ?? []}
            events={eventsByPackage[item.id] ?? []}
            showSnapshots
          />
        ))}
      </div>
      <p className="form-notice">Admin signature preparation access is read-only.</p>
    </section>
  );
}
