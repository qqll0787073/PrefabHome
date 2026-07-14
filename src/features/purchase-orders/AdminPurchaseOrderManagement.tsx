import { useEffect, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import {
  fetchAdminPurchaseOrders,
  fetchPurchaseOrderEvents,
} from "../../lib/purchaseOrders";
import type { PurchaseOrderEventRecord, PurchaseOrderWithItems } from "../../types";
import { PurchaseOrderSummary } from "./PurchaseOrderSummary";

interface AdminPurchaseOrderManagementProps {
  authMode: "supabase" | "demo";
}

export function AdminPurchaseOrderManagement({ authMode }: AdminPurchaseOrderManagementProps) {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderWithItems[]>([]);
  const [eventsByPO, setEventsByPO] = useState<Record<string, PurchaseOrderEventRecord[]>>({});
  const [isLoading, setIsLoading] = useState(authMode === "supabase");
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setErrors([]);
    if (authMode === "demo") {
      setPurchaseOrders([]);
      setEventsByPO({});
      setIsLoading(false);
      return;
    }

    fetchAdminPurchaseOrders()
      .then(async (items) => {
        const eventEntries = await Promise.all(
          items.map(async (po) => [po.id, await fetchPurchaseOrderEvents(po.id)] as const)
        );
        if (isMounted) {
          setPurchaseOrders(items);
          setEventsByPO(Object.fromEntries(eventEntries));
        }
      })
      .catch((error) => {
        if (isMounted) setErrors([error instanceof Error ? error.message : "Unable to load purchase orders."]);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [authMode]);

  return (
    <section className="quote-panel">
      <h4>Purchase Order Management</h4>
      <p className="form-notice">Admin purchase order management is read-only in PH-007A.</p>
      {isLoading && <LoadingState message="Loading purchase orders..." />}
      <ErrorList errors={errors} />
      {!isLoading && purchaseOrders.length === 0 && <p>No purchase orders yet.</p>}
      <div className="review-list">
        {purchaseOrders.map((po) => (
          <PurchaseOrderSummary
            key={po.id}
            purchaseOrder={po}
            events={eventsByPO[po.id] ?? []}
            showSnapshots
          />
        ))}
      </div>
    </section>
  );
}
