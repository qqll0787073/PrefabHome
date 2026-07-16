import { useEffect, useMemo, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import { fetchBuyerSignaturePackages } from "../../lib/signaturePreparation";
import {
  canCancelSignatureDelivery,
  canPrepareSignatureDelivery,
  canQueueSignatureDelivery,
  cancelSignatureDeliveryRequest,
  createSignatureDeliveryRequest,
  fetchBuyerSignatureDeliveries,
  fetchSignatureDeliveryEvents,
  fetchSignatureDeliveryRecipients,
  queueSignatureDeliveryRequest,
  signatureDeliveryManufacturerNotice,
  signatureDeliveryQueueConfirmationText,
  signatureDeliveryQueuedNotice,
  validateSignatureDeliveryCancelReason,
} from "../../lib/signatureDelivery";
import type {
  SignatureDeliveryEventRecord,
  SignatureDeliveryRecipientRecord,
  SignatureDeliveryRequestRecord,
  SignaturePackageRecord,
} from "../../types";
import { SignatureDeliverySummary } from "./SignatureDeliverySummary";

interface BuyerSignatureDeliveryProps {
  authMode: "supabase" | "demo";
}

export function BuyerSignatureDelivery({ authMode }: BuyerSignatureDeliveryProps) {
  const [packages, setPackages] = useState<SignaturePackageRecord[]>([]);
  const [deliveries, setDeliveries] = useState<SignatureDeliveryRequestRecord[]>([]);
  const [recipientsByDelivery, setRecipientsByDelivery] = useState<Record<string, SignatureDeliveryRecipientRecord[]>>({});
  const [eventsByDelivery, setEventsByDelivery] = useState<Record<string, SignatureDeliveryEventRecord[]>>({});
  const [selectedDelivery, setSelectedDelivery] = useState<SignatureDeliveryRequestRecord | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isLoading, setIsLoading] = useState(authMode === "supabase");
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  async function loadDeliveries() {
    setErrors([]);
    setIsLoading(true);
    try {
      if (authMode === "demo") {
        setPackages([]);
        setDeliveries([]);
        setRecipientsByDelivery({});
        setEventsByDelivery({});
      } else {
        const [packageRows, deliveryRows] = await Promise.all([
          fetchBuyerSignaturePackages(),
          fetchBuyerSignatureDeliveries(),
        ]);
        const [recipientEntries, eventEntries] = await Promise.all([
          Promise.all(deliveryRows.map(async (item) => [item.id, await fetchSignatureDeliveryRecipients(item.id)] as const)),
          Promise.all(deliveryRows.map(async (item) => [item.id, await fetchSignatureDeliveryEvents(item.id)] as const)),
        ]);
        setPackages(packageRows);
        setDeliveries(deliveryRows);
        setRecipientsByDelivery(Object.fromEntries(recipientEntries));
        setEventsByDelivery(Object.fromEntries(eventEntries));
      }
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to load signature delivery."]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadDeliveries();
  }, [authMode]);

  const eligiblePackages = useMemo(
    () => packages.filter((signaturePackage) => canPrepareSignatureDelivery(signaturePackage, deliveries)),
    [packages, deliveries]
  );

  async function prepareDelivery(packageId: string) {
    setIsSaving(true);
    setErrors([]);
    setMessage(null);
    try {
      const created = await createSignatureDeliveryRequest(packageId);
      await loadDeliveries();
      setSelectedDelivery(created);
      setMessage("Signature delivery request prepared.");
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to prepare signature delivery request."]);
    } finally {
      setIsSaving(false);
    }
  }

  async function queueDelivery(delivery: SignatureDeliveryRequestRecord) {
    if (!window.confirm(signatureDeliveryQueueConfirmationText(delivery))) return;
    setIsSaving(true);
    setErrors([]);
    try {
      const queued = await queueSignatureDeliveryRequest(delivery.id);
      await loadDeliveries();
      setSelectedDelivery(queued);
      setMessage("Signature delivery request queued internally.");
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to queue signature delivery request."]);
    } finally {
      setIsSaving(false);
    }
  }

  async function cancelDelivery(delivery: SignatureDeliveryRequestRecord) {
    const validationErrors = validateSignatureDeliveryCancelReason(cancelReason);
    setErrors(validationErrors);
    if (validationErrors.length > 0) return;

    setIsSaving(true);
    try {
      const cancelled = await cancelSignatureDeliveryRequest(delivery.id, cancelReason);
      await loadDeliveries();
      setSelectedDelivery(cancelled);
      setCancelReason("");
      setMessage("Signature delivery request cancelled.");
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to cancel signature delivery request."]);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="quote-panel">
      <h4>Signature Delivery</h4>
      {isLoading && <LoadingState message="Loading signature delivery..." />}
      <ErrorList errors={errors} />
      {message && <p className="form-success">{message}</p>}
      {eligiblePackages.length > 0 && (
        <div className="actions">
          {eligiblePackages.map((item) => (
            <button type="button" key={item.id} disabled={isSaving} onClick={() => void prepareDelivery(item.id)}>
              Prepare Signature Delivery
            </button>
          ))}
        </div>
      )}
      {deliveries.length === 0 && !isLoading && <p>No signature delivery requests yet.</p>}
      <div className="review-list">
        {deliveries.map((delivery) => (
          <div key={delivery.id}>
            <SignatureDeliverySummary
              delivery={delivery}
              recipients={recipientsByDelivery[delivery.id] ?? []}
              events={eventsByDelivery[delivery.id] ?? []}
            />
            <div className="actions">
              <button type="button" onClick={() => setSelectedDelivery(delivery)}>
                Open Delivery Request
              </button>
            </div>
          </div>
        ))}
      </div>
      {selectedDelivery && (
        <section className="quote-line-editor">
          <h4>{selectedDelivery.delivery_number}</h4>
          <p className="form-notice">Provider: Not configured</p>
          <p className="form-notice">{signatureDeliveryManufacturerNotice()}</p>
          {selectedDelivery.status === "queued" && <p className="form-notice">{signatureDeliveryQueuedNotice()}</p>}
          {selectedDelivery.status === "cancelled" && <p>Cancelled state is read-only.</p>}
          <SignatureDeliverySummary
            delivery={selectedDelivery}
            recipients={recipientsByDelivery[selectedDelivery.id] ?? []}
            events={eventsByDelivery[selectedDelivery.id] ?? []}
          />
          {canCancelSignatureDelivery(selectedDelivery) && (
            <label>
              Cancellation reason
              <textarea
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                placeholder="Reason required before cancelling"
              />
            </label>
          )}
          <div className="actions">
            {canQueueSignatureDelivery(selectedDelivery) && (
              <button type="button" disabled={isSaving} onClick={() => void queueDelivery(selectedDelivery)}>
                Queue Internally
              </button>
            )}
            {canCancelSignatureDelivery(selectedDelivery) && (
              <button type="button" disabled={isSaving} onClick={() => void cancelDelivery(selectedDelivery)}>
                Cancel Request
              </button>
            )}
            <button type="button" onClick={() => setSelectedDelivery(null)}>
              Close
            </button>
          </div>
        </section>
      )}
    </section>
  );
}
