import { useEffect, useMemo, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import { fetchManufacturerRFQs, rfqStatusLabels } from "../../lib/rfq";
import type { AuthUser } from "../../lib/auth";
import type { RFQWithDetails } from "../../types";
import { RFQConversation } from "./RFQConversation";

interface ManufacturerRFQInboxProps {
  user: AuthUser;
  authMode: "supabase" | "demo";
}

export function ManufacturerRFQInbox({ user, authMode }: ManufacturerRFQInboxProps) {
  const [rfqs, setRFQs] = useState<RFQWithDetails[]>([]);
  const [selectedRFQ, setSelectedRFQ] = useState<RFQWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(authMode === "supabase");
  const [errors, setErrors] = useState<string[]>([]);

  async function loadRFQs() {
    setIsLoading(true);
    setErrors([]);
    try {
      setRFQs(authMode === "demo" ? [] : await fetchManufacturerRFQs(user.id));
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to load manufacturer RFQs."]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadRFQs();
  }, [authMode, user.id]);

  const submittedRFQs = useMemo(
    () => rfqs.filter((rfq) => rfq.status === "submitted"),
    [rfqs]
  );

  return (
    <section className="workspace-section">
      <section className="panel">
        <p className="eyebrow">RFQ Inbox</p>
        <h2>Submitted RFQs</h2>
        <p className="form-notice">Quote creation is deferred to PH-006B.</p>
        {isLoading && <LoadingState message="Loading RFQ inbox..." />}
        <ErrorList errors={errors} />
        {!isLoading && submittedRFQs.length === 0 && <p>No submitted RFQs yet.</p>}
        <div className="review-list">
          {submittedRFQs.map((rfq) => (
            <article className="review-item" key={rfq.id}>
              <div>
                <p className="eyebrow">{rfqStatusLabels[rfq.status]}</p>
                <h3>{rfq.product?.model_name || rfq.product?.name || "Product RFQ"}</h3>
                <p>Buyer: {rfq.buyer?.full_name || rfq.buyer?.email || "Buyer"}</p>
              </div>
              <div className="meta-row">
                <span>{rfq.requested_quantity} units</span>
                <span>{rfq.destination_country}</span>
                <span>{new Date(rfq.created_at).toLocaleDateString()}</span>
              </div>
              <div className="actions">
                <button type="button" onClick={() => setSelectedRFQ(rfq)}>
                  Open RFQ
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <RFQConversation rfq={selectedRFQ} user={user} onMessagePosted={loadRFQs} />
    </section>
  );
}
