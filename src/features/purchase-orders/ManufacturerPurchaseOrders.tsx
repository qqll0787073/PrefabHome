import { useEffect, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import {
  confirmPurchaseOrder,
  fetchManufacturerPurchaseOrders,
  fetchPurchaseOrderDecisions,
  getManufacturerPurchaseOrderActions,
  manufacturerPurchaseOrderDecisionConfirmationText,
  purchaseOrderDecisionLabels,
  recordPurchaseOrderOpened,
  rejectPurchaseOrder,
  requestPurchaseOrderRevision,
  validatePurchaseOrderDecisionReason,
} from "../../lib/purchaseOrders";
import type {
  PurchaseOrderDecisionRecord,
  PurchaseOrderDecisionValue,
  PurchaseOrderWithItems,
} from "../../types";
import { PurchaseOrderSummary } from "./PurchaseOrderSummary";

interface ManufacturerPurchaseOrdersProps {
  authMode: "supabase" | "demo";
}

export function ManufacturerPurchaseOrders({ authMode }: ManufacturerPurchaseOrdersProps) {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderWithItems[]>([]);
  const [decisionsByPO, setDecisionsByPO] = useState<Record<string, PurchaseOrderDecisionRecord[]>>({});
  const [reasonByPO, setReasonByPO] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(authMode === "supabase");
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function loadPurchaseOrders(shouldUpdate = () => true) {
    setIsLoading(true);
    setErrors([]);
    if (authMode === "demo") {
      if (shouldUpdate()) {
        setPurchaseOrders([]);
        setDecisionsByPO({});
        setIsLoading(false);
      }
      return;
    }

    try {
      const items = await fetchManufacturerPurchaseOrders();
      const decisionEntries = await Promise.all(
        items.map(async (po) => [po.id, await fetchPurchaseOrderDecisions(po.id)] as const)
      );
      if (shouldUpdate()) {
        setPurchaseOrders(items);
        setDecisionsByPO(Object.fromEntries(decisionEntries));
      }
    } catch (error) {
      if (shouldUpdate()) setErrors([error instanceof Error ? error.message : "Unable to load purchase orders."]);
    } finally {
      if (shouldUpdate()) setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;
    void loadPurchaseOrders(() => isMounted);

    return () => {
      isMounted = false;
    };
  }, [authMode]);

  async function openForReview(po: PurchaseOrderWithItems) {
    setIsSaving(true);
    setErrors([]);
    try {
      await recordPurchaseOrderOpened(po.id);
      await loadPurchaseOrders();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to open purchase order."]);
    } finally {
      setIsSaving(false);
    }
  }

  async function decide(po: PurchaseOrderWithItems, decision: PurchaseOrderDecisionValue) {
    const reason = reasonByPO[po.id] ?? "";
    const validationErrors = validatePurchaseOrderDecisionReason(decision, reason);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    const message =
      decision === "revision_requested"
        ? `${manufacturerPurchaseOrderDecisionConfirmationText(po, decision)} Commercial terms remain immutable.`
        : manufacturerPurchaseOrderDecisionConfirmationText(po, decision);
    if (!window.confirm(message)) return;

    setIsSaving(true);
    setErrors([]);
    try {
      if (decision === "confirmed") {
        await confirmPurchaseOrder(po.id, reason);
      } else if (decision === "rejected") {
        await rejectPurchaseOrder(po.id, reason);
      } else {
        await requestPurchaseOrderRevision(po.id, reason);
      }
      setReasonByPO((current) => ({ ...current, [po.id]: "" }));
      await loadPurchaseOrders();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to save purchase order decision."]);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="quote-panel">
      <h4>Purchase Orders</h4>
      {isLoading && <LoadingState message="Loading purchase orders..." />}
      <ErrorList errors={errors} />
      {!isLoading && purchaseOrders.length === 0 && <p>No purchase orders yet.</p>}
      <div className="review-list">
        {purchaseOrders.map((po) => {
          const actions = getManufacturerPurchaseOrderActions(po);
          return (
            <div key={po.id}>
              <PurchaseOrderSummary purchaseOrder={po} decisions={decisionsByPO[po.id] ?? []} />
              {po.status === "submitted" && (
                <div className="actions">
                  <button type="button" disabled={isSaving} onClick={() => void openForReview(po)}>
                    Open for Review
                  </button>
                </div>
              )}
              {actions.length > 0 && (
                <div className="quote-line-editor">
                  <label>
                    Review note
                    <textarea
                      value={reasonByPO[po.id] ?? ""}
                      onChange={(event) => setReasonByPO((current) => ({ ...current, [po.id]: event.target.value }))}
                    />
                  </label>
                  <div className="actions">
                    {actions.map((action) => (
                      <button
                        type="button"
                        key={action}
                        disabled={isSaving}
                        onClick={() => void decide(po, action)}
                      >
                        {action === "confirmed"
                          ? "Confirm Purchase Order"
                          : action === "rejected"
                            ? "Reject Purchase Order"
                            : "Request Revision"}
                      </button>
                    ))}
                  </div>
                  <p className="form-notice">
                    {purchaseOrderDecisionLabels.revision_requested} keeps commercial terms immutable.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
