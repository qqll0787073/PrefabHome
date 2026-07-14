import { useEffect, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import { fetchManufacturerPurchaseOrders } from "../../lib/purchaseOrders";
import type { PurchaseOrderWithItems } from "../../types";
import { PurchaseOrderSummary } from "./PurchaseOrderSummary";

interface ManufacturerPurchaseOrdersProps {
  authMode: "supabase" | "demo";
}

export function ManufacturerPurchaseOrders({ authMode }: ManufacturerPurchaseOrdersProps) {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderWithItems[]>([]);
  const [isLoading, setIsLoading] = useState(authMode === "supabase");
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setErrors([]);
    if (authMode === "demo") {
      setPurchaseOrders([]);
      setIsLoading(false);
      return;
    }

    fetchManufacturerPurchaseOrders()
      .then((items) => {
        if (isMounted) setPurchaseOrders(items);
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
      <h4>Purchase Orders</h4>
      <p className="form-notice">Manufacturer confirmation is deferred to PH-007B.</p>
      {isLoading && <LoadingState message="Loading purchase orders..." />}
      <ErrorList errors={errors} />
      {!isLoading && purchaseOrders.length === 0 && <p>No purchase orders yet.</p>}
      <div className="review-list">
        {purchaseOrders.map((po) => (
          <PurchaseOrderSummary key={po.id} purchaseOrder={po} />
        ))}
      </div>
    </section>
  );
}
