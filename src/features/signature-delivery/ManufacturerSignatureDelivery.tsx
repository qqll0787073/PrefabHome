import { useEffect, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import {
  fetchManufacturerSignatureDeliveries,
  fetchSignatureDeliveryEvents,
  fetchSignatureDeliveryRecipients,
  signatureDeliveryManufacturerNotice,
} from "../../lib/signatureDelivery";
import type {
  SignatureDeliveryEventRecord,
  SignatureDeliveryRecipientRecord,
  SignatureDeliveryRequestRecord,
} from "../../types";
import { SignatureDeliverySummary } from "./SignatureDeliverySummary";

interface ManufacturerSignatureDeliveryProps {
  authMode: "supabase" | "demo";
}

export function ManufacturerSignatureDelivery({ authMode }: ManufacturerSignatureDeliveryProps) {
  const [deliveries, setDeliveries] = useState<SignatureDeliveryRequestRecord[]>([]);
  const [recipientsByDelivery, setRecipientsByDelivery] = useState<Record<string, SignatureDeliveryRecipientRecord[]>>({});
  const [eventsByDelivery, setEventsByDelivery] = useState<Record<string, SignatureDeliveryEventRecord[]>>({});
  const [isLoading, setIsLoading] = useState(authMode === "supabase");
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    async function loadDeliveries() {
      setErrors([]);
      setIsLoading(true);
      try {
        if (authMode === "demo") {
          setDeliveries([]);
          setRecipientsByDelivery({});
          setEventsByDelivery({});
        } else {
          const deliveryRows = await fetchManufacturerSignatureDeliveries();
          const [recipientEntries, eventEntries] = await Promise.all([
            Promise.all(deliveryRows.map(async (item) => [item.id, await fetchSignatureDeliveryRecipients(item.id)] as const)),
            Promise.all(deliveryRows.map(async (item) => [item.id, await fetchSignatureDeliveryEvents(item.id)] as const)),
          ]);
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

    void loadDeliveries();
  }, [authMode]);

  return (
    <section className="quote-panel">
      <h4>Signature Delivery</h4>
      {isLoading && <LoadingState message="Loading signature delivery..." />}
      <ErrorList errors={errors} />
      <p className="form-notice">{signatureDeliveryManufacturerNotice()}</p>
      {deliveries.length === 0 && !isLoading && <p>No signature delivery requests assigned yet.</p>}
      <div className="review-list">
        {deliveries.map((delivery) => (
          <SignatureDeliverySummary
            key={delivery.id}
            delivery={delivery}
            recipients={recipientsByDelivery[delivery.id] ?? []}
            events={eventsByDelivery[delivery.id] ?? []}
          />
        ))}
      </div>
    </section>
  );
}
