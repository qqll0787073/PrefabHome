import { useEffect, useMemo, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import {
  canCreateLogisticsBookingRequest,
  canSubmitLogisticsBookingRequest,
  canWithdrawLogisticsBookingRequest,
  createLogisticsBookingRequest,
  emptyLogisticsBookingRequestDraftValues,
  fetchLogisticsBookingRequestEvents,
  fetchManufacturerBookingRequests,
  isLogisticsBookingRequestReadOnly,
  logisticsContainerPreferenceLabels,
  logisticsContainerPreferences,
  logisticsIncoterms,
  logisticsPlanningDisclaimer,
  logisticsSubmitConfirmationText,
  logisticsTransportModes,
  logisticsWithdrawConfirmationText,
  submitLogisticsBookingRequest,
  updateLogisticsBookingRequestDraft,
  validateLogisticsBookingDraft,
  validateLogisticsWithdrawalReason,
  withdrawLogisticsBookingRequest,
} from "../../lib/logisticsBookingRequests";
import { fetchManufacturerShippingReadiness } from "../../lib/shippingReadiness";
import type {
  LogisticsBookingRequestDraftValues,
  LogisticsBookingRequestEventRecord,
  LogisticsBookingRequestRecord,
  ShippingReadinessRecord,
} from "../../types";
import { LogisticsBookingRequestSummary } from "./LogisticsBookingRequestSummary";

interface ManufacturerLogisticsBookingRequestsProps {
  authMode: "supabase" | "demo";
}

export function ManufacturerLogisticsBookingRequests({ authMode }: ManufacturerLogisticsBookingRequestsProps) {
  const [shippingRecords, setShippingRecords] = useState<ShippingReadinessRecord[]>([]);
  const [requests, setRequests] = useState<LogisticsBookingRequestRecord[]>([]);
  const [eventsByRequest, setEventsByRequest] = useState<Record<string, LogisticsBookingRequestEventRecord[]>>({});
  const [selectedRequest, setSelectedRequest] = useState<LogisticsBookingRequestRecord | null>(null);
  const [values, setValues] = useState<LogisticsBookingRequestDraftValues>(emptyLogisticsBookingRequestDraftValues());
  const [withdrawReason, setWithdrawReason] = useState("");
  const [isLoading, setIsLoading] = useState(authMode === "supabase");
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function loadRequests() {
    setErrors([]);
    setIsLoading(true);
    try {
      if (authMode === "demo") {
        setShippingRecords([]);
        setRequests([]);
        setEventsByRequest({});
      } else {
        const [shippingRows, requestRows] = await Promise.all([
          fetchManufacturerShippingReadiness(),
          fetchManufacturerBookingRequests(),
        ]);
        const entries = await Promise.all(requestRows.map(async (request) => [request.id, await fetchLogisticsBookingRequestEvents(request.id)] as const));
        setShippingRecords(shippingRows);
        setRequests(requestRows);
        setEventsByRequest(Object.fromEntries(entries));
        if (selectedRequest) {
          const refreshed = requestRows.find((request) => request.id === selectedRequest.id) ?? null;
          setSelectedRequest(refreshed);
          setValues(emptyLogisticsBookingRequestDraftValues(refreshed));
        }
      }
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to load logistics booking requests."]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadRequests();
  }, [authMode]);

  const eligibleShippingRecords = useMemo(
    () => shippingRecords.filter((record) => canCreateLogisticsBookingRequest(record, requests)),
    [requests, shippingRecords]
  );

  function selectRequest(request: LogisticsBookingRequestRecord) {
    setSelectedRequest(request);
    setValues(emptyLogisticsBookingRequestDraftValues(request));
    setWithdrawReason("");
    setErrors([]);
  }

  async function createRequest(shippingReadinessId: string) {
    setIsSaving(true);
    setErrors([]);
    try {
      const created = await createLogisticsBookingRequest(shippingReadinessId);
      setSelectedRequest(created);
      setValues(emptyLogisticsBookingRequestDraftValues(created));
      await loadRequests();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to create logistics booking request."]);
    } finally {
      setIsSaving(false);
    }
  }

  async function saveDraft() {
    if (!selectedRequest) return;
    const validationErrors = validateLogisticsBookingDraft(values);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    setIsSaving(true);
    setErrors([]);
    try {
      const updated = await updateLogisticsBookingRequestDraft(selectedRequest.id, values);
      setSelectedRequest(updated);
      setValues(emptyLogisticsBookingRequestDraftValues(updated));
      await loadRequests();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to save logistics booking request draft."]);
    } finally {
      setIsSaving(false);
    }
  }

  async function submitRequest() {
    if (!selectedRequest) return;
    const validationErrors = validateLogisticsBookingDraft(values, true);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    if (!window.confirm(logisticsSubmitConfirmationText(selectedRequest))) return;
    setIsSaving(true);
    setErrors([]);
    try {
      await updateLogisticsBookingRequestDraft(selectedRequest.id, values);
      const submitted = await submitLogisticsBookingRequest(selectedRequest.id);
      setSelectedRequest(submitted);
      await loadRequests();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to submit logistics booking request."]);
    } finally {
      setIsSaving(false);
    }
  }

  async function withdrawRequest() {
    if (!selectedRequest) return;
    const validationErrors = validateLogisticsWithdrawalReason(withdrawReason);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    if (!window.confirm(logisticsWithdrawConfirmationText())) return;
    setIsSaving(true);
    setErrors([]);
    try {
      const withdrawn = await withdrawLogisticsBookingRequest(selectedRequest.id, withdrawReason);
      setSelectedRequest(withdrawn);
      setWithdrawReason("");
      await loadRequests();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to withdraw logistics booking request."]);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="quote-panel">
      <h4>Logistics Booking Requests</h4>
      {isLoading && <LoadingState message="Loading logistics booking requests..." />}
      <ErrorList errors={errors} />
      <p className="form-notice">{logisticsPlanningDisclaimer()}</p>

      {eligibleShippingRecords.length > 0 && (
        <div className="review-list">
          {eligibleShippingRecords.map((record) => (
            <article className="quote-card" key={record.id}>
              <div className="quote-card-header">
                <div>
                  <p className="eyebrow">Eligible Shipping Readiness</p>
                  <h5>{record.shipping_number}</h5>
                </div>
                <span>{record.status}</span>
              </div>
              <button disabled={isSaving} onClick={() => void createRequest(record.id)}>Prepare Booking Request</button>
            </article>
          ))}
        </div>
      )}

      {requests.length === 0 && eligibleShippingRecords.length === 0 && !isLoading && <p>No logistics booking requests yet.</p>}
      <div className="review-list">
        {requests.map((request) => (
          <div key={request.id}>
            <button className="secondary-button" onClick={() => selectRequest(request)}>Open {request.booking_request_number}</button>
            <LogisticsBookingRequestSummary request={request} events={eventsByRequest[request.id] ?? []} />
          </div>
        ))}
      </div>

      {selectedRequest && (
        <section className="panel">
          <p className="eyebrow">Selected Booking Request</p>
          <h4>{selectedRequest.booking_request_number}</h4>
          <div className="quote-line-items">
            <div className="meta-row"><span>Source cargo</span><span>{selectedRequest.cargo_description ?? "Not provided"}</span></div>
            <div className="meta-row"><span>Packages</span><span>{selectedRequest.package_count ?? "Not provided"}</span></div>
            <div className="meta-row"><span>Gross weight kg</span><span>{selectedRequest.gross_weight_kg ?? "Not provided"}</span></div>
            <div className="meta-row"><span>Volume cbm</span><span>{selectedRequest.volume_cbm ?? "Not provided"}</span></div>
          </div>
          <div className="form-grid">
            <label>Mode<select disabled={isLogisticsBookingRequestReadOnly(selectedRequest)} value={values.requestedTransportMode} onChange={(event) => setValues({ ...values, requestedTransportMode: event.target.value as LogisticsBookingRequestDraftValues["requestedTransportMode"] })}>{logisticsTransportModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}</select></label>
            <label>Incoterm<select disabled={isLogisticsBookingRequestReadOnly(selectedRequest)} value={values.requestedIncoterm} onChange={(event) => setValues({ ...values, requestedIncoterm: event.target.value as LogisticsBookingRequestDraftValues["requestedIncoterm"] })}>{logisticsIncoterms.map((incoterm) => <option key={incoterm} value={incoterm}>{incoterm}</option>)}</select></label>
            <label>Container<select disabled={isLogisticsBookingRequestReadOnly(selectedRequest)} value={values.containerPreference} onChange={(event) => setValues({ ...values, containerPreference: event.target.value as LogisticsBookingRequestDraftValues["containerPreference"] })}>{logisticsContainerPreferences.map((preference) => <option key={preference} value={preference}>{logisticsContainerPreferenceLabels[preference]}</option>)}</select></label>
            <label>Preferred departure<input disabled={isLogisticsBookingRequestReadOnly(selectedRequest)} type="date" value={values.preferredDepartureDate} onChange={(event) => setValues({ ...values, preferredDepartureDate: event.target.value })} /></label>
            <label>Latest acceptable departure<input disabled={isLogisticsBookingRequestReadOnly(selectedRequest)} type="date" value={values.latestAcceptableDepartureDate} onChange={(event) => setValues({ ...values, latestAcceptableDepartureDate: event.target.value })} /></label>
            <label>Origin line 1<input disabled={isLogisticsBookingRequestReadOnly(selectedRequest)} value={values.originAddressLine1} onChange={(event) => setValues({ ...values, originAddressLine1: event.target.value })} /></label>
            <label>Origin line 2<input disabled={isLogisticsBookingRequestReadOnly(selectedRequest)} value={values.originAddressLine2} onChange={(event) => setValues({ ...values, originAddressLine2: event.target.value })} /></label>
            <label>Origin city<input disabled={isLogisticsBookingRequestReadOnly(selectedRequest)} value={values.originCity} onChange={(event) => setValues({ ...values, originCity: event.target.value })} /></label>
            <label>Origin state/region<input disabled={isLogisticsBookingRequestReadOnly(selectedRequest)} value={values.originStateRegion} onChange={(event) => setValues({ ...values, originStateRegion: event.target.value })} /></label>
            <label>Origin postal code<input disabled={isLogisticsBookingRequestReadOnly(selectedRequest)} value={values.originPostalCode} onChange={(event) => setValues({ ...values, originPostalCode: event.target.value })} /></label>
            <label>Origin country code<input disabled={isLogisticsBookingRequestReadOnly(selectedRequest)} value={values.originCountryCode} onChange={(event) => setValues({ ...values, originCountryCode: event.target.value })} /></label>
            <label>Destination line 1<input disabled={isLogisticsBookingRequestReadOnly(selectedRequest)} value={values.destinationAddressLine1} onChange={(event) => setValues({ ...values, destinationAddressLine1: event.target.value })} /></label>
            <label>Destination line 2<input disabled={isLogisticsBookingRequestReadOnly(selectedRequest)} value={values.destinationAddressLine2} onChange={(event) => setValues({ ...values, destinationAddressLine2: event.target.value })} /></label>
            <label>Destination city<input disabled={isLogisticsBookingRequestReadOnly(selectedRequest)} value={values.destinationCity} onChange={(event) => setValues({ ...values, destinationCity: event.target.value })} /></label>
            <label>Destination state/region<input disabled={isLogisticsBookingRequestReadOnly(selectedRequest)} value={values.destinationStateRegion} onChange={(event) => setValues({ ...values, destinationStateRegion: event.target.value })} /></label>
            <label>Destination postal code<input disabled={isLogisticsBookingRequestReadOnly(selectedRequest)} value={values.destinationPostalCode} onChange={(event) => setValues({ ...values, destinationPostalCode: event.target.value })} /></label>
            <label>Destination country code<input disabled={isLogisticsBookingRequestReadOnly(selectedRequest)} value={values.destinationCountryCode} onChange={(event) => setValues({ ...values, destinationCountryCode: event.target.value })} /></label>
          </div>
          <textarea disabled={isLogisticsBookingRequestReadOnly(selectedRequest)} placeholder="Equipment notes" value={values.equipmentNotes} onChange={(event) => setValues({ ...values, equipmentNotes: event.target.value })} />
          <textarea disabled={isLogisticsBookingRequestReadOnly(selectedRequest)} placeholder="Handling requirements" value={values.handlingRequirements} onChange={(event) => setValues({ ...values, handlingRequirements: event.target.value })} />
          <textarea disabled={isLogisticsBookingRequestReadOnly(selectedRequest)} placeholder="Booking notes" value={values.bookingNotes} onChange={(event) => setValues({ ...values, bookingNotes: event.target.value })} />
          {canSubmitLogisticsBookingRequest(selectedRequest) && <div className="portal-actions"><button disabled={isSaving} onClick={() => void saveDraft()}>Save Draft</button><button disabled={isSaving} onClick={() => void submitRequest()}>Submit for Logistics Arrangement</button></div>}
          {canWithdrawLogisticsBookingRequest(selectedRequest) && <div className="portal-actions"><textarea placeholder="Withdrawal reason" value={withdrawReason} onChange={(event) => setWithdrawReason(event.target.value)} /><button disabled={isSaving} onClick={() => void withdrawRequest()}>Withdraw Request</button></div>}
        </section>
      )}
    </section>
  );
}
