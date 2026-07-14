import { useEffect, useMemo, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import {
  canCreatePurchaseOrderForQuote,
  cancelPurchaseOrderDraft,
  createPurchaseOrderFromQuote,
  emptyPurchaseOrderDraftValues,
  fetchBuyerPurchaseOrders,
  isPurchaseOrderReadOnly,
  purchaseOrderConfirmationText,
  submitPurchaseOrder,
  updatePurchaseOrderDraft,
  validatePurchaseOrderDraft,
} from "../../lib/purchaseOrders";
import type {
  PurchaseOrderDraftValues,
  PurchaseOrderWithItems,
  RFQQuoteWithItems,
} from "../../types";
import { PurchaseOrderSummary } from "./PurchaseOrderSummary";

interface BuyerPurchaseOrdersProps {
  authMode: "supabase" | "demo";
  quotes: RFQQuoteWithItems[];
}

export function BuyerPurchaseOrders({ authMode, quotes }: BuyerPurchaseOrdersProps) {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderWithItems[]>([]);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrderWithItems | null>(null);
  const [values, setValues] = useState<PurchaseOrderDraftValues>(() => emptyPurchaseOrderDraftValues());
  const [isLoading, setIsLoading] = useState(authMode === "supabase");
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  async function loadPurchaseOrders() {
    setErrors([]);
    setIsLoading(true);
    try {
      setPurchaseOrders(authMode === "demo" ? [] : await fetchBuyerPurchaseOrders());
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to load purchase orders."]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadPurchaseOrders();
  }, [authMode]);

  const eligibleQuotes = useMemo(
    () => quotes.filter((quote) => canCreatePurchaseOrderForQuote(quote, purchaseOrders)),
    [quotes, purchaseOrders]
  );

  async function createPO(quoteId: string) {
    setIsSaving(true);
    setErrors([]);
    setMessage(null);
    try {
      const created = await createPurchaseOrderFromQuote(quoteId);
      await loadPurchaseOrders();
      setSelectedPO({ ...created, items: [] });
      setValues(emptyPurchaseOrderDraftValues(created));
      setMessage("Purchase order draft created.");
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to create purchase order."]);
    } finally {
      setIsSaving(false);
    }
  }

  function selectPO(po: PurchaseOrderWithItems) {
    setSelectedPO(po);
    setValues(emptyPurchaseOrderDraftValues(po));
    setErrors([]);
    setMessage(null);
  }

  async function saveDraft() {
    if (!selectedPO) return;
    const validationErrors = validatePurchaseOrderDraft(values);
    setErrors(validationErrors);
    if (validationErrors.length > 0) return;

    setIsSaving(true);
    try {
      await updatePurchaseOrderDraft(selectedPO.id, values);
      await loadPurchaseOrders();
      setMessage("Purchase order draft saved.");
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to save purchase order."]);
    } finally {
      setIsSaving(false);
    }
  }

  async function submitDraft() {
    if (!selectedPO) return;
    if (!window.confirm(purchaseOrderConfirmationText(selectedPO))) return;
    setIsSaving(true);
    try {
      await submitPurchaseOrder(selectedPO.id);
      await loadPurchaseOrders();
      setSelectedPO(null);
      setMessage("Purchase order submitted.");
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to submit purchase order."]);
    } finally {
      setIsSaving(false);
    }
  }

  async function cancelDraft() {
    if (!selectedPO) return;
    setIsSaving(true);
    try {
      await cancelPurchaseOrderDraft(selectedPO.id);
      await loadPurchaseOrders();
      setSelectedPO(null);
      setMessage("Purchase order draft cancelled.");
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to cancel purchase order."]);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="quote-panel">
      <h4>Purchase Orders</h4>
      {isLoading && <LoadingState message="Loading purchase orders..." />}
      <ErrorList errors={errors} />
      {message && <p className="form-success">{message}</p>}
      {eligibleQuotes.length > 0 && (
        <div className="actions">
          {eligibleQuotes.map((quote) => (
            <button type="button" key={quote.id} disabled={isSaving} onClick={() => void createPO(quote.id)}>
              Create Purchase Order
            </button>
          ))}
        </div>
      )}
      {purchaseOrders.length === 0 && !isLoading && <p>No purchase orders yet.</p>}
      <div className="review-list">
        {purchaseOrders.map((po) => (
          <div key={po.id}>
            <PurchaseOrderSummary purchaseOrder={po} />
            <div className="actions">
              <button type="button" onClick={() => selectPO(po)}>
                Open Purchase Order
              </button>
            </div>
          </div>
        ))}
      </div>
      {selectedPO && (
        <section className="quote-line-editor">
          <h4>{selectedPO.po_number}</h4>
          <label>
            Requested delivery date
            <input
              type="date"
              value={values.requestedDeliveryDate}
              disabled={isPurchaseOrderReadOnly(selectedPO)}
              onChange={(event) => setValues((current) => ({ ...current, requestedDeliveryDate: event.target.value }))}
            />
          </label>
          <label>
            Buyer reference
            <input
              value={values.buyerReference}
              disabled={isPurchaseOrderReadOnly(selectedPO)}
              onChange={(event) => setValues((current) => ({ ...current, buyerReference: event.target.value }))}
            />
          </label>
          <label>
            Buyer note
            <textarea
              value={values.buyerNote}
              disabled={isPurchaseOrderReadOnly(selectedPO)}
              onChange={(event) => setValues((current) => ({ ...current, buyerNote: event.target.value }))}
            />
          </label>
          {!isPurchaseOrderReadOnly(selectedPO) ? (
            <div className="actions">
              <button type="button" disabled={isSaving} onClick={() => void saveDraft()}>
                Save Draft
              </button>
              <button type="button" disabled={isSaving} onClick={() => void submitDraft()}>
                Submit Purchase Order
              </button>
              <button type="button" disabled={isSaving} onClick={() => void cancelDraft()}>
                Cancel Draft
              </button>
            </div>
          ) : (
            <p className="form-notice">Submitted and cancelled purchase orders are read-only.</p>
          )}
        </section>
      )}
    </section>
  );
}
