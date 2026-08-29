import { useEffect, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import {
  fetchBuyerShippingReadiness,
  fetchShippingReadinessEvents,
  shippingPlanningDisclaimer,
} from "../../lib/shippingReadiness";
import type { ShippingReadinessEventRecord, ShippingReadinessRecord } from "../../types";
import { ShippingReadinessSummary } from "./ShippingReadinessSummary";
import { buyerShippingNextAction } from "../../lib/buyerNextActions";
import { BuyerNextActionNotice } from "../dashboard/BuyerNextActionNotice";

interface BuyerShippingReadinessProps {
  authMode: "supabase" | "demo";
  selectedShippingId?: string | null;
}

export function BuyerShippingReadiness({ authMode, selectedShippingId = null }: BuyerShippingReadinessProps) {
  const [records, setRecords] = useState<ShippingReadinessRecord[]>([]);
  const [eventsByRecord, setEventsByRecord] = useState<Record<string, ShippingReadinessEventRecord[]>>({});
  const [isLoading, setIsLoading] = useState(authMode === "supabase");
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    async function loadShippingReadiness() {
      setErrors([]);
      setIsLoading(true);
      try {
        if (authMode === "demo") {
          setRecords([]);
          setEventsByRecord({});
        } else {
          const recordRows = await fetchBuyerShippingReadiness();
          const eventEntries = await Promise.all(
            recordRows.map(async (record) => [record.id, await fetchShippingReadinessEvents(record.id)] as const)
          );
          setRecords(recordRows);
          setEventsByRecord(Object.fromEntries(eventEntries));
        }
      } catch (error) {
        setErrors([error instanceof Error ? error.message : "Unable to load shipping readiness."]);
      } finally {
        setIsLoading(false);
      }
    }

    void loadShippingReadiness();
  }, [authMode]);

  return (
    <section className="quote-panel">
      <h4>Shipping Readiness</h4>
      {isLoading && <LoadingState message="Loading shipping readiness..." />}
      <ErrorList errors={errors} />
      <p className="form-notice">Buyer shipping readiness is read-only. {shippingPlanningDisclaimer()}</p>
      {records.length === 0 && !isLoading && <p>No shipping readiness records yet.</p>}
      <div className="review-list">
        {records.filter((record) => !selectedShippingId || record.id === selectedShippingId).map((record) => (
          <div key={record.id}><ShippingReadinessSummary
            key={record.id}
            record={record}
            events={eventsByRecord[record.id] ?? []}
          /><BuyerNextActionNotice action={buyerShippingNextAction(record.status, record.id)} /><nav className="actions" aria-label="Shipping context"><a href={`/marketplace?view=dashboard&workspace=orders&record=${record.purchase_order_id}`}>View Purchase Order {record.purchase_order_number}</a><a href={`/marketplace?view=dashboard&workspace=contracts&record=${record.contract_id}`}>View Contract {record.contract_number}</a><a href={`/marketplace?view=dashboard&workspace=invoices&record=${record.invoice_id}`}>View Invoice {record.invoice_number}</a><a href="/marketplace?view=dashboard&workspace=logistics">View Logistics</a></nav></div>
        ))}
      </div>
      {selectedShippingId && !isLoading && !records.some((record) => record.id === selectedShippingId) && <p role="status">This shipping record is unavailable to your Buyer account.</p>}
    </section>
  );
}
