import { useEffect, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import { fetchAdminRFQs, rfqSnapshotTitle, rfqStatusLabels } from "../../lib/rfq";
import type { AuthUser } from "../../lib/auth";
import type { RFQWithDetails } from "../../types";
import { RFQConversation } from "./RFQConversation";

interface AdminRFQManagementProps {
  user: AuthUser;
  authMode: "supabase" | "demo";
}

export function AdminRFQManagement({ user, authMode }: AdminRFQManagementProps) {
  const [rfqs, setRFQs] = useState<RFQWithDetails[]>([]);
  const [selectedRFQ, setSelectedRFQ] = useState<RFQWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(authMode === "supabase");
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setErrors([]);

    if (authMode === "demo") {
      setRFQs([]);
      setIsLoading(false);
      return;
    }

    fetchAdminRFQs()
      .then((items) => {
        if (isMounted) setRFQs(items);
      })
      .catch((error) => {
        if (isMounted) {
          setErrors([error instanceof Error ? error.message : "Unable to load RFQs."]);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [authMode]);

  return (
    <section className="workspace-section">
      <section className="panel">
        <p className="eyebrow">RFQ Management</p>
        <h2>All RFQs</h2>
        <p className="form-notice">Admin RFQ management is read-only in PH-006A.</p>
        {isLoading && <LoadingState message="Loading RFQs..." />}
        <ErrorList errors={errors} />
        {!isLoading && rfqs.length === 0 && <p>No RFQs have been created yet.</p>}
        <div className="review-list">
          {rfqs.map((rfq) => (
            <article className="review-item" key={rfq.id}>
              <div>
                <p className="eyebrow">{rfqStatusLabels[rfq.status]}</p>
                <h3>{rfqSnapshotTitle(rfq.product_snapshot)}</h3>
                <p>
                  {rfq.buyer?.email || "Buyer"} to{" "}
                  {rfq.manufacturer?.company_display_name ||
                    rfq.manufacturer?.company_name ||
                    "Manufacturer"}
                </p>
              </div>
              <div className="meta-row">
                <span>{rfq.requested_quantity} units</span>
                <span>{rfq.destination_country}</span>
                <span>{new Date(rfq.updated_at).toLocaleDateString()}</span>
              </div>
              <div className="actions">
                <button type="button" onClick={() => setSelectedRFQ(rfq)}>
                  View
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <RFQConversation rfq={selectedRFQ} user={user} readOnly />
    </section>
  );
}
