import { useEffect, useMemo, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import { fetchManufacturerContracts } from "../../lib/contracts";
import { fetchManufacturerInvoices } from "../../lib/invoices";
import { fetchManufacturerPurchaseOrders } from "../../lib/purchaseOrders";
import {
  canCancelShippingReadiness,
  canCreateShippingReadiness,
  canMarkShippingReady,
  cancelShippingReadiness,
  createShippingReadiness,
  emptyShippingReadinessDraftValues,
  fetchManufacturerShippingReadiness,
  fetchShippingReadinessEvents,
  isShippingReadinessReadOnly,
  markShippingReadinessReady,
  shippingIncoterms,
  shippingModes,
  shippingPlanningDisclaimer,
  shippingReadyConfirmationText,
  updateShippingReadinessDraft,
  validateShippingCancellationReason,
  validateShippingReadinessDraft,
} from "../../lib/shippingReadiness";
import type {
  ContractRecord,
  InvoiceRecord,
  PurchaseOrderWithItems,
  ShippingReadinessDraftValues,
  ShippingReadinessEventRecord,
  ShippingReadinessRecord,
} from "../../types";
import { ShippingReadinessSummary } from "./ShippingReadinessSummary";

interface ManufacturerShippingReadinessProps {
  authMode: "supabase" | "demo";
}

export function ManufacturerShippingReadiness({ authMode }: ManufacturerShippingReadinessProps) {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderWithItems[]>([]);
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [records, setRecords] = useState<ShippingReadinessRecord[]>([]);
  const [eventsByRecord, setEventsByRecord] = useState<Record<string, ShippingReadinessEventRecord[]>>({});
  const [selectedRecord, setSelectedRecord] = useState<ShippingReadinessRecord | null>(null);
  const [values, setValues] = useState<ShippingReadinessDraftValues>(emptyShippingReadinessDraftValues());
  const [cancelReason, setCancelReason] = useState("");
  const [isLoading, setIsLoading] = useState(authMode === "supabase");
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function loadShippingReadiness() {
    setErrors([]);
    setIsLoading(true);
    try {
      if (authMode === "demo") {
        setPurchaseOrders([]);
        setContracts([]);
        setInvoices([]);
        setRecords([]);
        setEventsByRecord({});
      } else {
        const [poRows, contractRows, invoiceRows, recordRows] = await Promise.all([
          fetchManufacturerPurchaseOrders(),
          fetchManufacturerContracts(),
          fetchManufacturerInvoices(),
          fetchManufacturerShippingReadiness(),
        ]);
        const eventEntries = await Promise.all(
          recordRows.map(async (record) => [record.id, await fetchShippingReadinessEvents(record.id)] as const)
        );
        setPurchaseOrders(poRows);
        setContracts(contractRows);
        setInvoices(invoiceRows);
        setRecords(recordRows);
        setEventsByRecord(Object.fromEntries(eventEntries));
        if (selectedRecord) {
          const refreshed = recordRows.find((record) => record.id === selectedRecord.id) ?? null;
          setSelectedRecord(refreshed);
          setValues(emptyShippingReadinessDraftValues(refreshed));
        }
      }
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to load shipping readiness."]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadShippingReadiness();
  }, [authMode]);

  const eligiblePurchaseOrders = useMemo(
    () => purchaseOrders.filter((po) => canCreateShippingReadiness(po, contracts, invoices, records)),
    [contracts, invoices, purchaseOrders, records]
  );

  function selectRecord(record: ShippingReadinessRecord) {
    setSelectedRecord(record);
    setValues(emptyShippingReadinessDraftValues(record));
    setCancelReason("");
    setErrors([]);
  }

  async function createRecord(poId: string) {
    setIsSaving(true);
    setErrors([]);
    try {
      const created = await createShippingReadiness(poId);
      setSelectedRecord(created);
      setValues(emptyShippingReadinessDraftValues(created));
      await loadShippingReadiness();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to create shipping readiness."]);
    } finally {
      setIsSaving(false);
    }
  }

  async function saveDraft() {
    if (!selectedRecord) return;
    const validationErrors = validateShippingReadinessDraft(values);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    setIsSaving(true);
    setErrors([]);
    try {
      const updated = await updateShippingReadinessDraft(selectedRecord.id, values);
      setSelectedRecord(updated);
      setValues(emptyShippingReadinessDraftValues(updated));
      await loadShippingReadiness();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to save shipping readiness draft."]);
    } finally {
      setIsSaving(false);
    }
  }

  async function markReady() {
    if (!selectedRecord) return;
    const validationErrors = validateShippingReadinessDraft(values, true);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    if (!window.confirm(shippingReadyConfirmationText(selectedRecord))) return;
    setIsSaving(true);
    setErrors([]);
    try {
      await updateShippingReadinessDraft(selectedRecord.id, values);
      const ready = await markShippingReadinessReady(selectedRecord.id);
      setSelectedRecord(ready);
      await loadShippingReadiness();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to mark shipping readiness ready."]);
    } finally {
      setIsSaving(false);
    }
  }

  async function cancelSelected() {
    if (!selectedRecord) return;
    const validationErrors = validateShippingCancellationReason(cancelReason);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    setIsSaving(true);
    setErrors([]);
    try {
      const cancelled = await cancelShippingReadiness(selectedRecord.id, cancelReason);
      setSelectedRecord(cancelled);
      setCancelReason("");
      await loadShippingReadiness();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to cancel shipping readiness."]);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="quote-panel">
      <h4>Shipping Readiness</h4>
      {isLoading && <LoadingState message="Loading shipping readiness..." />}
      <ErrorList errors={errors} />
      <p className="form-notice">{shippingPlanningDisclaimer()}</p>

      {eligiblePurchaseOrders.length > 0 && (
        <div className="review-list">
          {eligiblePurchaseOrders.map((po) => (
            <article className="quote-card" key={po.id}>
              <div className="quote-card-header">
                <div>
                  <p className="eyebrow">Eligible PO</p>
                  <h5>{po.po_number}</h5>
                </div>
                <span>{po.status}</span>
              </div>
              <button disabled={isSaving} onClick={() => void createRecord(po.id)}>
                Prepare Shipping Record
              </button>
            </article>
          ))}
        </div>
      )}

      {records.length === 0 && eligiblePurchaseOrders.length === 0 && !isLoading && <p>No shipping-ready transactions yet.</p>}

      <div className="review-list">
        {records.map((record) => (
          <div key={record.id}>
            <button className="secondary-button" onClick={() => selectRecord(record)}>
              Open {record.shipping_number}
            </button>
            <ShippingReadinessSummary record={record} events={eventsByRecord[record.id] ?? []} />
          </div>
        ))}
      </div>

      {selectedRecord && (
        <section className="panel">
          <p className="eyebrow">Selected Shipping Record</p>
          <h4>{selectedRecord.shipping_number}</h4>
          <div className="form-grid">
            <label>
              Mode
              <select disabled={isShippingReadinessReadOnly(selectedRecord)} value={values.shippingMode} onChange={(event) => setValues({ ...values, shippingMode: event.target.value as ShippingReadinessDraftValues["shippingMode"] })}>
                {shippingModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
              </select>
            </label>
            <label>
              Incoterm
              <select disabled={isShippingReadinessReadOnly(selectedRecord)} value={values.incoterm} onChange={(event) => setValues({ ...values, incoterm: event.target.value as ShippingReadinessDraftValues["incoterm"] })}>
                {shippingIncoterms.map((incoterm) => <option key={incoterm} value={incoterm}>{incoterm}</option>)}
              </select>
            </label>
            <label>Origin line 1<input disabled={isShippingReadinessReadOnly(selectedRecord)} value={values.originAddressLine1} onChange={(event) => setValues({ ...values, originAddressLine1: event.target.value })} /></label>
            <label>Origin line 2<input disabled={isShippingReadinessReadOnly(selectedRecord)} value={values.originAddressLine2} onChange={(event) => setValues({ ...values, originAddressLine2: event.target.value })} /></label>
            <label>Origin city<input disabled={isShippingReadinessReadOnly(selectedRecord)} value={values.originCity} onChange={(event) => setValues({ ...values, originCity: event.target.value })} /></label>
            <label>Origin state/region<input disabled={isShippingReadinessReadOnly(selectedRecord)} value={values.originStateRegion} onChange={(event) => setValues({ ...values, originStateRegion: event.target.value })} /></label>
            <label>Origin postal code<input disabled={isShippingReadinessReadOnly(selectedRecord)} value={values.originPostalCode} onChange={(event) => setValues({ ...values, originPostalCode: event.target.value })} /></label>
            <label>Origin country code<input disabled={isShippingReadinessReadOnly(selectedRecord)} value={values.originCountryCode} onChange={(event) => setValues({ ...values, originCountryCode: event.target.value })} /></label>
            <label>Destination line 1<input disabled={isShippingReadinessReadOnly(selectedRecord)} value={values.destinationAddressLine1} onChange={(event) => setValues({ ...values, destinationAddressLine1: event.target.value })} /></label>
            <label>Destination line 2<input disabled={isShippingReadinessReadOnly(selectedRecord)} value={values.destinationAddressLine2} onChange={(event) => setValues({ ...values, destinationAddressLine2: event.target.value })} /></label>
            <label>Destination city<input disabled={isShippingReadinessReadOnly(selectedRecord)} value={values.destinationCity} onChange={(event) => setValues({ ...values, destinationCity: event.target.value })} /></label>
            <label>Destination state/region<input disabled={isShippingReadinessReadOnly(selectedRecord)} value={values.destinationStateRegion} onChange={(event) => setValues({ ...values, destinationStateRegion: event.target.value })} /></label>
            <label>Destination postal code<input disabled={isShippingReadinessReadOnly(selectedRecord)} value={values.destinationPostalCode} onChange={(event) => setValues({ ...values, destinationPostalCode: event.target.value })} /></label>
            <label>Destination country code<input disabled={isShippingReadinessReadOnly(selectedRecord)} value={values.destinationCountryCode} onChange={(event) => setValues({ ...values, destinationCountryCode: event.target.value })} /></label>
            <label>Package count<input disabled={isShippingReadinessReadOnly(selectedRecord)} inputMode="numeric" value={values.packageCount} onChange={(event) => setValues({ ...values, packageCount: event.target.value })} /></label>
            <label>Gross weight kg<input disabled={isShippingReadinessReadOnly(selectedRecord)} inputMode="decimal" value={values.grossWeightKg} onChange={(event) => setValues({ ...values, grossWeightKg: event.target.value })} /></label>
            <label>Volume cbm<input disabled={isShippingReadinessReadOnly(selectedRecord)} inputMode="decimal" value={values.volumeCbm} onChange={(event) => setValues({ ...values, volumeCbm: event.target.value })} /></label>
            <label>Estimated ready date<input disabled={isShippingReadinessReadOnly(selectedRecord)} type="date" value={values.estimatedReadyDate} onChange={(event) => setValues({ ...values, estimatedReadyDate: event.target.value })} /></label>
            <label>Requested ship date<input disabled={isShippingReadinessReadOnly(selectedRecord)} type="date" value={values.requestedShipDate} onChange={(event) => setValues({ ...values, requestedShipDate: event.target.value })} /></label>
          </div>
          <textarea disabled={isShippingReadinessReadOnly(selectedRecord)} placeholder="Cargo description" value={values.cargoDescription} onChange={(event) => setValues({ ...values, cargoDescription: event.target.value })} />
          <textarea disabled={isShippingReadinessReadOnly(selectedRecord)} placeholder="Special instructions" value={values.specialInstructions} onChange={(event) => setValues({ ...values, specialInstructions: event.target.value })} />
          {canMarkShippingReady(selectedRecord) && (
            <div className="portal-actions">
              <button disabled={isSaving} onClick={() => void saveDraft()}>Save Draft</button>
              <button disabled={isSaving} onClick={() => void markReady()}>Mark Ready for Logistics</button>
            </div>
          )}
          {canCancelShippingReadiness(selectedRecord) && (
            <div className="portal-actions">
              <textarea placeholder="Cancellation reason" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
              <button disabled={isSaving} onClick={() => void cancelSelected()}>Cancel Record</button>
            </div>
          )}
        </section>
      )}
    </section>
  );
}
