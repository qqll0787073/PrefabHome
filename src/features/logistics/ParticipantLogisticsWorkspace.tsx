import React, { useEffect, useMemo, useRef, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import {
  fetchParticipantLogisticsArrangementEvents,
  fetchParticipantLogisticsProviderCandidates,
  fetchParticipantLogisticsProviderSelections,
  logisticsArrangementEventLabels,
  logisticsArrangementNotice,
  logisticsCandidateTransportModeLabels,
  logisticsProviderTypeLabels,
} from "../../lib/logisticsArrangement";
import {
  canCreateLogisticsBookingRequest,
  canSubmitLogisticsBookingRequest,
  canWithdrawLogisticsBookingRequest,
  createLogisticsBookingRequest,
  emptyLogisticsBookingRequestDraftValues,
  fetchBuyerBookingRequests,
  fetchLogisticsBookingRequestEvents,
  fetchManufacturerBookingRequests,
  isLogisticsBookingRequestReadOnly,
  logisticsBookingEventLabels,
  logisticsBookingStatusLabels,
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
  ParticipantLogisticsArrangementEventRecord,
  ParticipantLogisticsProviderCandidateRecord,
  ParticipantLogisticsProviderSelectionRecord,
  ShippingReadinessRecord,
} from "../../types";
import {
  describePartialFailure,
  filterLogisticsRequests,
  isLogisticsLifecycleConflict,
  logisticsNextStep,
  logisticsStatusCounts,
  reconcileLogisticsRequestId,
  type LogisticsStatusFilter,
} from "./logisticsWorkspaceModel";

interface ParticipantLogisticsWorkspaceProps {
  authMode: "supabase" | "demo";
  role: "buyer" | "manufacturer";
  selectedRequestId: string | null;
  preferredShippingReadinessId?: string | null;
  onSelectedRequestChange: (requestId: string | null) => void;
}

const statusFilters: LogisticsStatusFilter[] = [
  "all",
  "booking_draft",
  "submitted_for_arrangement",
  "carrier_options_available",
  "carrier_selected",
  "ready_for_external_booking",
  "withdrawn",
];

export function ParticipantLogisticsWorkspace({
  authMode,
  role,
  selectedRequestId,
  preferredShippingReadinessId = null,
  onSelectedRequestChange,
}: ParticipantLogisticsWorkspaceProps) {
  const [requests, setRequests] = useState<LogisticsBookingRequestRecord[]>([]);
  const [shippingRecords, setShippingRecords] = useState<ShippingReadinessRecord[]>([]);
  const [bookingEvents, setBookingEvents] = useState<LogisticsBookingRequestEventRecord[]>([]);
  const [candidates, setCandidates] = useState<ParticipantLogisticsProviderCandidateRecord[]>([]);
  const [selections, setSelections] = useState<ParticipantLogisticsProviderSelectionRecord[]>([]);
  const [arrangementEvents, setArrangementEvents] = useState<ParticipantLogisticsArrangementEventRecord[]>([]);
  const [values, setValues] = useState<LogisticsBookingRequestDraftValues>(emptyLogisticsBookingRequestDraftValues());
  const [withdrawReason, setWithdrawReason] = useState("");
  const [filter, setFilter] = useState<LogisticsStatusFilter>("all");
  const [initialLoading, setInitialLoading] = useState(authMode === "supabase");
  const [detailLoading, setDetailLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState(false);
  const [savingAction, setSavingAction] = useState<string | null>(null);
  const [criticalError, setCriticalError] = useState<string | null>(null);
  const [secondaryErrors, setSecondaryErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const queueGeneration = useRef(0);
  const detailGeneration = useRef(0);

  const selectedRequest = requests.find((request) => request.id === selectedRequestId) ?? null;
  const counts = useMemo(() => logisticsStatusCounts(requests), [requests]);
  const visibleRequests = useMemo(() => filterLogisticsRequests(requests, filter), [filter, requests]);
  const eligibleShippingRecords = useMemo(() => {
    const eligible = shippingRecords.filter((record) => canCreateLogisticsBookingRequest(record, requests));
    return [...eligible].sort((left, right) => Number(right.id === preferredShippingReadinessId) - Number(left.id === preferredShippingReadinessId));
  }, [preferredShippingReadinessId, requests, shippingRecords]);
  const selectedCandidate = candidates.find((candidate) => candidate.is_selected) ?? null;
  const actionsDisabled = stale || initialLoading || refreshing || Boolean(savingAction);

  async function loadQueue(background = false, preferredRequestId = selectedRequestId) {
    const generation = ++queueGeneration.current;
    if (background) setRefreshing(true); else setInitialLoading(true);
    setCriticalError(null);
    setSecondaryErrors([]);
    try {
      if (authMode === "demo") {
        if (generation !== queueGeneration.current) return;
        setRequests([]);
        setShippingRecords([]);
        onSelectedRequestChange(null);
        setStale(false);
        return;
      }
      const requestPromise = role === "buyer" ? fetchBuyerBookingRequests() : fetchManufacturerBookingRequests();
      const results = await Promise.allSettled([
        requestPromise,
        role === "manufacturer" ? fetchManufacturerShippingReadiness() : Promise.resolve([] as ShippingReadinessRecord[]),
      ]);
      if (generation !== queueGeneration.current) return;
      const requestResult = results[0];
      if (requestResult.status === "rejected") throw requestResult.reason;
      const requestRows = requestResult.value;
      setRequests(requestRows);
      const shippingResult = results[1];
      if (shippingResult.status === "fulfilled") setShippingRecords(shippingResult.value);
      else setSecondaryErrors(["Shipping readiness records could not be refreshed."]);
      const nextRequestId = reconcileLogisticsRequestId(requestRows, preferredRequestId);
      if (nextRequestId !== selectedRequestId) onSelectedRequestChange(nextRequestId);
      setStale(false);
    } catch (error) {
      if (generation !== queueGeneration.current) return;
      setCriticalError(error instanceof Error ? error.message : "Unable to load logistics requests.");
      setStale(requests.length > 0);
    } finally {
      if (generation === queueGeneration.current) {
        setInitialLoading(false);
        setRefreshing(false);
      }
    }
  }

  async function loadDetail(requestId: string) {
    const generation = ++detailGeneration.current;
    setDetailLoading(true);
    setSecondaryErrors([]);
    const results = await Promise.allSettled([
      fetchLogisticsBookingRequestEvents(requestId),
      fetchParticipantLogisticsProviderCandidates(requestId),
      fetchParticipantLogisticsProviderSelections(requestId),
      fetchParticipantLogisticsArrangementEvents(requestId),
    ]);
    if (generation !== detailGeneration.current) return;
    const failures: string[] = [];
    const [bookingResult, candidateResult, selectionResult, eventResult] = results;
    if (bookingResult.status === "fulfilled") setBookingEvents(bookingResult.value); else failures.push("booking timeline");
    if (candidateResult.status === "fulfilled") setCandidates(candidateResult.value); else failures.push("provider options");
    if (selectionResult.status === "fulfilled") setSelections(selectionResult.value); else failures.push("selection history");
    if (eventResult.status === "fulfilled") setArrangementEvents(eventResult.value); else failures.push("arrangement timeline");
    setSecondaryErrors(failures.length ? [describePartialFailure(failures)] : []);
    setStale(failures.length > 0);
    setDetailLoading(false);
  }

  useEffect(() => {
    void loadQueue();
    return () => {
      queueGeneration.current += 1;
      detailGeneration.current += 1;
    };
  }, [authMode, role]);

  useEffect(() => {
    if (!selectedRequest) {
      setBookingEvents([]);
      setCandidates([]);
      setSelections([]);
      setArrangementEvents([]);
      setValues(emptyLogisticsBookingRequestDraftValues());
      return;
    }
    setValues(emptyLogisticsBookingRequestDraftValues(selectedRequest));
    setWithdrawReason("");
    void loadDetail(selectedRequest.id);
  }, [selectedRequest?.id, selectedRequest?.updated_at]);

  async function runMutation(actionName: string, action: () => Promise<LogisticsBookingRequestRecord>, success: string) {
    setSavingAction(actionName);
    setCriticalError(null);
    setNotice("");
    try {
      const updated = await action();
      onSelectedRequestChange(updated.id);
      setNotice(success);
      await loadQueue(true, updated.id);
      await loadDetail(updated.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Logistics action failed.";
      setCriticalError(message);
      if (isLogisticsLifecycleConflict(message)) {
        setStale(true);
        await loadQueue(true, selectedRequestId);
        setCriticalError(message);
        setNotice("The latest authoritative state has been loaded. Review it before trying again.");
      }
    } finally {
      setSavingAction(null);
    }
  }

  async function createRequest(shippingReadinessId: string) {
    await runMutation("create", () => createLogisticsBookingRequest(shippingReadinessId), "Booking request draft created.");
  }

  async function saveDraft() {
    if (!selectedRequest) return;
    const errors = validateLogisticsBookingDraft(values);
    if (errors.length) { setCriticalError(errors.join(" ")); return; }
    await runMutation("save", () => updateLogisticsBookingRequestDraft(selectedRequest.id, values), "Booking request draft saved.");
  }

  async function submitRequest() {
    if (!selectedRequest) return;
    const errors = validateLogisticsBookingDraft(values, true);
    if (errors.length) { setCriticalError(errors.join(" ")); return; }
    if (!window.confirm(logisticsSubmitConfirmationText(selectedRequest))) return;
    await runMutation("submit", async () => {
      await updateLogisticsBookingRequestDraft(selectedRequest.id, values);
      return submitLogisticsBookingRequest(selectedRequest.id);
    }, "Booking request submitted for arrangement.");
  }

  async function withdrawRequest() {
    if (!selectedRequest) return;
    const errors = validateLogisticsWithdrawalReason(withdrawReason);
    if (errors.length) { setCriticalError(errors.join(" ")); return; }
    if (!window.confirm(logisticsWithdrawConfirmationText())) return;
    await runMutation("withdraw", () => withdrawLogisticsBookingRequest(selectedRequest.id, withdrawReason), "Booking request withdrawn.");
  }

  function setField<K extends keyof LogisticsBookingRequestDraftValues>(field: K, value: LogisticsBookingRequestDraftValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  if (authMode === "demo") {
    return (
      <section className="logistics-workspace-state panel">
        <p className="eyebrow">Demo mode</p>
        <h3>Logistics data is unavailable in demo mode</h3>
        <p>The Beta does not create synthetic booking requests or provider records. Configure Supabase and sign in to use Logistics.</p>
      </section>
    );
  }

  return (
    <section className="logistics-workspace" aria-labelledby="participant-logistics-title">
      <header className="workspace-toolbar">
        <div>
          <p className="eyebrow">Internal planning</p>
          <h3 id="participant-logistics-title">{role === "buyer" ? "Buyer Logistics" : "Manufacturer Logistics"}</h3>
          <p>{logisticsPlanningDisclaimer()}</p>
        </div>
        <button type="button" className="secondary-button" disabled={refreshing || initialLoading} onClick={() => void loadQueue(true)}>
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      {initialLoading && <LoadingState message="Loading logistics workspace..." />}
      {criticalError && <div className="workspace-error" role="alert"><ErrorList errors={[criticalError]} /><button type="button" onClick={() => void loadQueue(true)}>Retry</button></div>}
      {secondaryErrors.length > 0 && <div className="workspace-warning" role="status"><ErrorList errors={secondaryErrors} /><button type="button" className="ghost" onClick={() => selectedRequest && void loadDetail(selectedRequest.id)}>Retry details</button></div>}
      {stale && <p className="stale-warning" role="status">Some displayed data may be stale. Unsafe actions remain disabled until an authoritative refresh succeeds.</p>}
      {notice && <p className="form-success" role="status">{notice}</p>}

      {role === "manufacturer" && eligibleShippingRecords.length > 0 && (
        <section className="handoff-panel" aria-labelledby="eligible-shipping-title">
          <h4 id="eligible-shipping-title">Ready for a booking request</h4>
          <div className="workspace-card-grid compact">
            {eligibleShippingRecords.map((record) => (
              <article className={record.id === preferredShippingReadinessId ? "workspace-card highlighted" : "workspace-card"} key={record.id}>
                <strong>{record.shipping_number}</strong>
                <span>Shipping Readiness is complete. Prepare the internal booking request next.</span>
                <button type="button" disabled={actionsDisabled} onClick={() => void createRequest(record.id)}>{savingAction === "create" ? "Creating..." : "Prepare booking request"}</button>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="status-filter-bar" aria-label="Logistics request status filters">
        {statusFilters.map((status) => (
          <button type="button" key={status} className={filter === status ? "active" : ""} aria-pressed={filter === status} onClick={() => setFilter(status)}>
            {status === "all" ? "All" : logisticsBookingStatusLabels[status]} <span>{counts[status]}</span>
          </button>
        ))}
      </div>

      {!initialLoading && requests.length === 0 && !criticalError && (
        <div className="empty-workspace"><h4>No booking requests</h4><p>{role === "manufacturer" ? "Complete Shipping Readiness to prepare the first request." : "A booking request will appear after the Manufacturer prepares it."}</p></div>
      )}

      <div className="logistics-split-view">
        <aside className="request-list" aria-label="Logistics booking requests">
          {visibleRequests.map((request) => (
            <button type="button" key={request.id} className={selectedRequestId === request.id ? "request-list-item active" : "request-list-item"} aria-current={selectedRequestId === request.id ? "true" : undefined} onClick={() => onSelectedRequestChange(request.id)}>
              <strong>{request.booking_request_number}</strong>
              <span>{request.shipping_number}</span>
              <small>{logisticsBookingStatusLabels[request.status]}</small>
            </button>
          ))}
          {requests.length > 0 && visibleRequests.length === 0 && <p>No requests match this status.</p>}
        </aside>

        <div className="request-detail" aria-live="polite">
          {!selectedRequest && requests.length > 0 && <p>Select a booking request to view its details.</p>}
          {selectedRequest && (
            <>
              <header className="request-detail-header">
                <div><p className="eyebrow">{selectedRequest.booking_request_number}</p><h4>{selectedRequest.shipping_number}</h4></div>
                <span className={`status status-${selectedRequest.status}`}>{logisticsBookingStatusLabels[selectedRequest.status]}</span>
              </header>
              <p className="next-step"><strong>Next step:</strong> {logisticsNextStep(selectedRequest.status, role)}</p>
              <div className="meta-grid">
                <span>PO {selectedRequest.purchase_order_number}</span>
                <span>Contract {selectedRequest.contract_number}</span>
                <span>Invoice {selectedRequest.invoice_number}</span>
                <span>Mode {selectedRequest.requested_transport_mode}</span>
                <span>Incoterm {selectedRequest.requested_incoterm ?? "Unspecified"}</span>
                <span>Container {selectedRequest.container_preference ? logisticsContainerPreferenceLabels[selectedRequest.container_preference] : "Not specified"}</span>
              </div>

              {detailLoading && <LoadingState message="Loading request details..." />}

              {role === "manufacturer" && selectedRequest.status === "booking_draft" && (
                <section className="booking-editor" aria-labelledby="booking-editor-title">
                  <h4 id="booking-editor-title">Booking request draft</h4>
                  <div className="form-grid">
                    <label>Mode<select disabled={actionsDisabled || isLogisticsBookingRequestReadOnly(selectedRequest)} value={values.requestedTransportMode} onChange={(event) => setField("requestedTransportMode", event.target.value as LogisticsBookingRequestDraftValues["requestedTransportMode"])}>{logisticsTransportModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}</select></label>
                    <label>Incoterm<select disabled={actionsDisabled || isLogisticsBookingRequestReadOnly(selectedRequest)} value={values.requestedIncoterm} onChange={(event) => setField("requestedIncoterm", event.target.value as LogisticsBookingRequestDraftValues["requestedIncoterm"])}>{logisticsIncoterms.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                    <label>Container<select disabled={actionsDisabled} value={values.containerPreference} onChange={(event) => setField("containerPreference", event.target.value as LogisticsBookingRequestDraftValues["containerPreference"])}>{logisticsContainerPreferences.map((item) => <option key={item} value={item}>{logisticsContainerPreferenceLabels[item]}</option>)}</select></label>
                    <label>Preferred departure<input disabled={actionsDisabled} type="date" value={values.preferredDepartureDate} onChange={(event) => setField("preferredDepartureDate", event.target.value)} /></label>
                    <label>Latest acceptable departure<input disabled={actionsDisabled} type="date" value={values.latestAcceptableDepartureDate} onChange={(event) => setField("latestAcceptableDepartureDate", event.target.value)} /></label>
                    <label>Origin line 1<input disabled={actionsDisabled} value={values.originAddressLine1} onChange={(event) => setField("originAddressLine1", event.target.value)} /></label>
                    <label>Origin line 2<input disabled={actionsDisabled} value={values.originAddressLine2} onChange={(event) => setField("originAddressLine2", event.target.value)} /></label>
                    <label>Origin city<input disabled={actionsDisabled} value={values.originCity} onChange={(event) => setField("originCity", event.target.value)} /></label>
                    <label>Origin state/region<input disabled={actionsDisabled} value={values.originStateRegion} onChange={(event) => setField("originStateRegion", event.target.value)} /></label>
                    <label>Origin postal code<input disabled={actionsDisabled} value={values.originPostalCode} onChange={(event) => setField("originPostalCode", event.target.value)} /></label>
                    <label>Origin country code<input disabled={actionsDisabled} maxLength={2} value={values.originCountryCode} onChange={(event) => setField("originCountryCode", event.target.value.toUpperCase())} /></label>
                    <label>Destination line 1<input disabled={actionsDisabled} value={values.destinationAddressLine1} onChange={(event) => setField("destinationAddressLine1", event.target.value)} /></label>
                    <label>Destination line 2<input disabled={actionsDisabled} value={values.destinationAddressLine2} onChange={(event) => setField("destinationAddressLine2", event.target.value)} /></label>
                    <label>Destination city<input disabled={actionsDisabled} value={values.destinationCity} onChange={(event) => setField("destinationCity", event.target.value)} /></label>
                    <label>Destination state/region<input disabled={actionsDisabled} value={values.destinationStateRegion} onChange={(event) => setField("destinationStateRegion", event.target.value)} /></label>
                    <label>Destination postal code<input disabled={actionsDisabled} value={values.destinationPostalCode} onChange={(event) => setField("destinationPostalCode", event.target.value)} /></label>
                    <label>Destination country code<input disabled={actionsDisabled} maxLength={2} value={values.destinationCountryCode} onChange={(event) => setField("destinationCountryCode", event.target.value.toUpperCase())} /></label>
                  </div>
                  <label>Equipment notes<textarea disabled={actionsDisabled} value={values.equipmentNotes} onChange={(event) => setField("equipmentNotes", event.target.value)} /></label>
                  <label>Handling requirements<textarea disabled={actionsDisabled} value={values.handlingRequirements} onChange={(event) => setField("handlingRequirements", event.target.value)} /></label>
                  <label>Booking notes<textarea disabled={actionsDisabled} value={values.bookingNotes} onChange={(event) => setField("bookingNotes", event.target.value)} /></label>
                  {canSubmitLogisticsBookingRequest(selectedRequest) && <div className="actions"><button type="button" disabled={actionsDisabled} onClick={() => void saveDraft()}>{savingAction === "save" ? "Saving..." : "Save draft"}</button><button type="button" disabled={actionsDisabled} onClick={() => void submitRequest()}>{savingAction === "submit" ? "Submitting..." : "Submit for arrangement"}</button></div>}
                </section>
              )}

              {role === "manufacturer" && canWithdrawLogisticsBookingRequest(selectedRequest) && (
                <section className="withdraw-panel">
                  <label>Withdrawal reason<textarea maxLength={2000} disabled={actionsDisabled} value={withdrawReason} onChange={(event) => setWithdrawReason(event.target.value)} /></label>
                  <button type="button" className="ghost" disabled={actionsDisabled || !withdrawReason.trim()} onClick={() => void withdrawRequest()}>{savingAction === "withdraw" ? "Withdrawing..." : "Withdraw request"}</button>
                </section>
              )}

              <section className="provider-options" aria-labelledby="provider-options-title">
                <div className="section-heading"><h4 id="provider-options-title">Provider options</h4><span>{candidates.length}</span></div>
                {selectedRequest.status === "submitted_for_arrangement" && candidates.length === 0 && <p>Submitted and awaiting Admin review. No provider options are available yet.</p>}
                {candidates.length === 0 && selectedRequest.status !== "submitted_for_arrangement" && <p>No provider options are visible for this request.</p>}
                {selectedCandidate && <div className="selected-provider-summary"><strong>Selected provider</strong><span>{selectedCandidate.provider_name}</span><small>{logisticsProviderTypeLabels[selectedCandidate.provider_type]} / {logisticsCandidateTransportModeLabels[selectedCandidate.transport_mode]}</small></div>}
                <div className="review-list">
                  {candidates.map((candidate) => (
                    <article className={candidate.is_selected ? "quote-card selected-option" : "quote-card"} key={candidate.id}>
                      <div className="quote-card-header"><div><h5>{candidate.provider_name}</h5><span>{logisticsProviderTypeLabels[candidate.provider_type]} / {logisticsCandidateTransportModeLabels[candidate.transport_mode]}</span></div><span>{candidate.is_selected ? "Selected" : candidate.candidate_status}</span></div>
                      <div className="meta-grid">
                        <span>{candidate.service_level ?? "Service level pending"}</span>
                        <span>Departure {candidate.estimated_departure_date ? new Date(candidate.estimated_departure_date).toLocaleDateString() : "pending"}</span>
                        <span>Arrival {candidate.estimated_arrival_date ? new Date(candidate.estimated_arrival_date).toLocaleDateString() : "pending"}</span>
                        <span>{candidate.estimated_transit_days !== null ? `${candidate.estimated_transit_days} days` : "Transit pending"}</span>
                        <span>{candidate.estimated_cost !== null ? `${candidate.currency ?? ""} ${candidate.estimated_cost.toFixed(2)}`.trim() : "Estimate pending"}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="timeline-section" aria-labelledby="logistics-timeline-title">
                <h4 id="logistics-timeline-title">Planning timeline</h4>
                {bookingEvents.length === 0 && arrangementEvents.length === 0 && <p>No timeline activity yet.</p>}
                <div className="timeline-list">
                  {[
                    ...bookingEvents.map((event) => ({ id: event.id, createdAt: event.created_at, label: logisticsBookingEventLabels[event.event_type] })),
                    ...arrangementEvents.map((event) => ({ id: event.id, createdAt: event.created_at, label: logisticsArrangementEventLabels[event.event_type] })),
                  ].sort((left, right) => left.createdAt.localeCompare(right.createdAt)).map((event) => (
                    <div className="timeline-item" key={event.id}><span>{new Date(event.createdAt).toLocaleString()}</span><strong>{event.label}</strong></div>
                  ))}
                </div>
                {selections.length > 1 && <p className="form-notice">Selection history includes {selections.length} planning decisions. The current provider is identified above.</p>}
              </section>
              <p className="form-notice">{logisticsArrangementNotice()}</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
