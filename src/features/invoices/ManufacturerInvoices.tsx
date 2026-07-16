import { useEffect, useMemo, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import { fetchManufacturerContracts } from "../../lib/contracts";
import {
  calculateInvoiceTotalPreview,
  canCancelInvoice,
  canCreateInvoiceForPurchaseOrder,
  canIssueInvoice,
  cancelInvoice,
  createInvoiceFromPurchaseOrder,
  emptyInvoiceDraftValues,
  fetchInvoiceEvents,
  fetchInvoiceLineItems,
  fetchManufacturerInvoices,
  invoiceAmountLabel,
  invoiceIssueConfirmationText,
  invoiceTaxDisclaimer,
  issueInvoice,
  updateInvoiceDraft,
  validateInvoiceCancellationReason,
  validateInvoiceDraftValues,
} from "../../lib/invoices";
import { fetchManufacturerPurchaseOrders, purchaseOrderSubtotalLabel } from "../../lib/purchaseOrders";
import { fetchManufacturerSignaturePackages } from "../../lib/signaturePreparation";
import type {
  ContractRecord,
  InvoiceDraftValues,
  InvoiceEventRecord,
  InvoiceLineItemRecord,
  InvoiceRecord,
  PurchaseOrderWithItems,
  SignaturePackageRecord,
} from "../../types";
import { InvoiceSummary } from "./InvoiceSummary";

interface ManufacturerInvoicesProps {
  authMode: "supabase" | "demo";
}

export function ManufacturerInvoices({ authMode }: ManufacturerInvoicesProps) {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderWithItems[]>([]);
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [packages, setPackages] = useState<SignaturePackageRecord[]>([]);
  const [itemsByInvoice, setItemsByInvoice] = useState<Record<string, InvoiceLineItemRecord[]>>({});
  const [eventsByInvoice, setEventsByInvoice] = useState<Record<string, InvoiceEventRecord[]>>({});
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);
  const [draftValues, setDraftValues] = useState<InvoiceDraftValues>(emptyInvoiceDraftValues());
  const [cancelReason, setCancelReason] = useState("");
  const [isLoading, setIsLoading] = useState(authMode === "supabase");
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function loadInvoices() {
    setErrors([]);
    setIsLoading(true);
    try {
      if (authMode === "demo") {
        setInvoices([]);
        setPurchaseOrders([]);
        setContracts([]);
        setPackages([]);
        setItemsByInvoice({});
        setEventsByInvoice({});
      } else {
        const [invoiceRows, poRows, contractRows, packageRows] = await Promise.all([
          fetchManufacturerInvoices(),
          fetchManufacturerPurchaseOrders(),
          fetchManufacturerContracts(),
          fetchManufacturerSignaturePackages(),
        ]);
        const [itemEntries, eventEntries] = await Promise.all([
          Promise.all(invoiceRows.map(async (invoice) => [invoice.id, await fetchInvoiceLineItems(invoice.id)] as const)),
          Promise.all(invoiceRows.map(async (invoice) => [invoice.id, await fetchInvoiceEvents(invoice.id)] as const)),
        ]);
        setInvoices(invoiceRows);
        setPurchaseOrders(poRows);
        setContracts(contractRows);
        setPackages(packageRows);
        setItemsByInvoice(Object.fromEntries(itemEntries));
        setEventsByInvoice(Object.fromEntries(eventEntries));
        if (selectedInvoice) {
          const refreshed = invoiceRows.find((invoice) => invoice.id === selectedInvoice.id) ?? null;
          setSelectedInvoice(refreshed);
          setDraftValues(emptyInvoiceDraftValues(refreshed));
        }
      }
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to load invoices."]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadInvoices();
  }, [authMode]);

  const eligiblePurchaseOrders = useMemo(() => {
    return purchaseOrders.filter((po) => {
      const contract = contracts.find((item) => item.purchase_order_id === po.id && item.status === "accepted");
      return canCreateInvoiceForPurchaseOrder(po, invoices, packages, contract?.id);
    });
  }, [contracts, invoices, packages, purchaseOrders]);

  function selectInvoice(invoice: InvoiceRecord) {
    setSelectedInvoice(invoice);
    setDraftValues(emptyInvoiceDraftValues(invoice));
    setCancelReason("");
    setErrors([]);
  }

  async function createInvoice(poId: string) {
    setIsSaving(true);
    setErrors([]);
    try {
      const invoice = await createInvoiceFromPurchaseOrder(poId);
      setSelectedInvoice(invoice);
      setDraftValues(emptyInvoiceDraftValues(invoice));
      await loadInvoices();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to create invoice."]);
    } finally {
      setIsSaving(false);
    }
  }

  async function saveDraft() {
    if (!selectedInvoice) return;
    const validationErrors = validateInvoiceDraftValues(draftValues, selectedInvoice.subtotal);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    setIsSaving(true);
    setErrors([]);
    try {
      const updated = await updateInvoiceDraft(selectedInvoice.id, draftValues);
      setSelectedInvoice(updated);
      setDraftValues(emptyInvoiceDraftValues(updated));
      await loadInvoices();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to update invoice draft."]);
    } finally {
      setIsSaving(false);
    }
  }

  async function issueSelectedInvoice() {
    if (!selectedInvoice) return;
    const validationErrors = validateInvoiceDraftValues(draftValues, selectedInvoice.subtotal, true);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    if (!window.confirm(invoiceIssueConfirmationText(selectedInvoice))) return;
    setIsSaving(true);
    setErrors([]);
    try {
      await updateInvoiceDraft(selectedInvoice.id, draftValues);
      const issued = await issueInvoice(selectedInvoice.id);
      setSelectedInvoice(issued);
      await loadInvoices();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to issue invoice."]);
    } finally {
      setIsSaving(false);
    }
  }

  async function cancelSelectedInvoice() {
    if (!selectedInvoice) return;
    const validationErrors = validateInvoiceCancellationReason(cancelReason);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    setIsSaving(true);
    setErrors([]);
    try {
      const cancelled = await cancelInvoice(selectedInvoice.id, cancelReason);
      setSelectedInvoice(cancelled);
      setCancelReason("");
      await loadInvoices();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to cancel invoice."]);
    } finally {
      setIsSaving(false);
    }
  }

  const previewTotal = selectedInvoice
    ? calculateInvoiceTotalPreview(selectedInvoice.subtotal, draftValues)
    : Number.NaN;

  return (
    <section className="quote-panel">
      <h4>Invoice Management</h4>
      {isLoading && <LoadingState message="Loading invoices..." />}
      <ErrorList errors={errors} />
      <p className="form-notice">{invoiceTaxDisclaimer()}</p>

      {eligiblePurchaseOrders.length > 0 && (
        <div className="review-list">
          {eligiblePurchaseOrders.map((po) => (
            <article className="quote-card" key={po.id}>
              <div className="quote-card-header">
                <div>
                  <p className="eyebrow">Eligible confirmed PO</p>
                  <h5>{po.po_number}</h5>
                </div>
                <span>{purchaseOrderSubtotalLabel(po)}</span>
              </div>
              <button disabled={isSaving} onClick={() => void createInvoice(po.id)}>
                Create Invoice
              </button>
            </article>
          ))}
        </div>
      )}

      {invoices.length === 0 && eligiblePurchaseOrders.length === 0 && !isLoading && <p>No invoice-ready purchase orders yet.</p>}

      <div className="review-list">
        {invoices.map((invoice) => (
          <div key={invoice.id}>
            <button className="secondary-button" onClick={() => selectInvoice(invoice)}>
              Open {invoice.invoice_number}
            </button>
            <InvoiceSummary
              invoice={invoice}
              lineItems={itemsByInvoice[invoice.id] ?? []}
              events={eventsByInvoice[invoice.id] ?? []}
            />
          </div>
        ))}
      </div>

      {selectedInvoice && selectedInvoice.status === "draft" && (
        <section className="panel">
          <p className="eyebrow">Draft Invoice</p>
          <h4>{selectedInvoice.invoice_number}</h4>
          <div className="form-grid">
            <label>
              Issue date
              <input
                type="date"
                value={draftValues.issueDate}
                onChange={(event) => setDraftValues({ ...draftValues, issueDate: event.target.value })}
              />
            </label>
            <label>
              Due date
              <input
                type="date"
                value={draftValues.dueDate}
                onChange={(event) => setDraftValues({ ...draftValues, dueDate: event.target.value })}
              />
            </label>
            <label>
              Billing name
              <input
                value={draftValues.billingName}
                onChange={(event) => setDraftValues({ ...draftValues, billingName: event.target.value })}
              />
            </label>
            <label>
              Billing email
              <input
                type="email"
                value={draftValues.billingEmail}
                onChange={(event) => setDraftValues({ ...draftValues, billingEmail: event.target.value })}
              />
            </label>
            <label>
              Tax amount
              <input
                inputMode="decimal"
                value={draftValues.taxAmount}
                onChange={(event) => setDraftValues({ ...draftValues, taxAmount: event.target.value })}
              />
            </label>
            <label>
              Shipping amount
              <input
                inputMode="decimal"
                value={draftValues.shippingAmount}
                onChange={(event) => setDraftValues({ ...draftValues, shippingAmount: event.target.value })}
              />
            </label>
            <label>
              Discount amount
              <input
                inputMode="decimal"
                value={draftValues.discountAmount}
                onChange={(event) => setDraftValues({ ...draftValues, discountAmount: event.target.value })}
              />
            </label>
          </div>
          <label>
            Billing address JSON
            <textarea
              value={draftValues.billingAddress}
              onChange={(event) => setDraftValues({ ...draftValues, billingAddress: event.target.value })}
            />
          </label>
          <p className="form-notice">
            Preview total:{" "}
            {Number.isNaN(previewTotal)
              ? "Invalid amount"
              : invoiceAmountLabel({ total_amount: previewTotal, currency: selectedInvoice.currency })}
          </p>
          <div className="portal-actions">
            <button disabled={isSaving} onClick={() => void saveDraft()}>
              Save Draft
            </button>
            {canIssueInvoice(selectedInvoice) && (
              <button disabled={isSaving} onClick={() => void issueSelectedInvoice()}>
                Issue Invoice
              </button>
            )}
          </div>
        </section>
      )}

      {selectedInvoice && canCancelInvoice(selectedInvoice) && (
        <section className="panel">
          <p className="eyebrow">Cancel Invoice</p>
          <textarea
            placeholder="Cancellation reason"
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
          />
          <button disabled={isSaving} onClick={() => void cancelSelectedInvoice()}>
            Cancel Invoice
          </button>
        </section>
      )}
    </section>
  );
}
