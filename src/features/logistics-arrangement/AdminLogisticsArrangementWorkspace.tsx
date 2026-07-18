import { useEffect, useMemo, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import {
  canMarkReadyForExternalBooking,
  canManageProviderCandidates,
  canSelectProviderCandidate,
  cancelLogisticsProviderSelection,
  createLogisticsProviderCandidate,
  emptyLogisticsProviderCandidateValues,
  fetchAdminLogisticsArrangementEvents,
  fetchAdminLogisticsProviderCandidates,
  fetchAdminLogisticsProviderSelections,
  logisticsCandidateTransportModeLabels,
  logisticsCandidateTransportModes,
  logisticsArrangementEventLabels,
  logisticsArrangementNotice,
  logisticsProviderTypeLabels,
  logisticsProviderTypes,
  markReadyForExternalBooking,
  selectLogisticsProviderCandidate,
  selectedProviderCandidate,
  updateLogisticsProviderCandidate,
  validateLogisticsProviderCandidate,
  withdrawLogisticsProviderCandidate,
} from "../../lib/logisticsArrangement";
import { fetchAdminBookingRequests, logisticsBookingStatusLabels } from "../../lib/logisticsBookingRequests";
import type {
  LogisticsArrangementEventRecord,
  LogisticsBookingRequestRecord,
  LogisticsProviderCandidateRecord,
  LogisticsProviderCandidateValues,
  LogisticsProviderSelectionRecord,
} from "../../types";

interface AdminLogisticsArrangementWorkspaceProps { authMode: "supabase" | "demo"; }

export function AdminLogisticsArrangementWorkspace({ authMode }: AdminLogisticsArrangementWorkspaceProps) {
  const [requests, setRequests] = useState<LogisticsBookingRequestRecord[]>([]);
  const [candidates, setCandidates] = useState<LogisticsProviderCandidateRecord[]>([]);
  const [selections, setSelections] = useState<LogisticsProviderSelectionRecord[]>([]);
  const [events, setEvents] = useState<LogisticsArrangementEventRecord[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [editingCandidateId, setEditingCandidateId] = useState<string | null>(null);
  const [values, setValues] = useState<LogisticsProviderCandidateValues>(emptyLogisticsProviderCandidateValues());
  const [isLoading, setIsLoading] = useState(authMode === "supabase");
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState("");

  async function load(preferredRequestId?: string) {
    setErrors([]);
    setIsLoading(true);
    try {
      if (authMode === "demo") {
        setRequests([]); setCandidates([]); setSelections([]); setEvents([]); setSelectedRequestId("");
        return;
      }
      const [requestRows, candidateRows, selectionRows, eventRows] = await Promise.all([
        fetchAdminBookingRequests(), fetchAdminLogisticsProviderCandidates(), fetchAdminLogisticsProviderSelections(), fetchAdminLogisticsArrangementEvents(),
      ]);
      const eligible = requestRows.filter((request) => !["booking_draft", "withdrawn"].includes(request.status));
      setRequests(eligible); setCandidates(candidateRows); setSelections(selectionRows); setEvents(eventRows);
      setSelectedRequestId((current) => preferredRequestId ?? (current || eligible[0]?.id || ""));
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to load logistics arrangement workspace."]);
    } finally { setIsLoading(false); }
  }

  useEffect(() => { void load(); }, [authMode]);

  const selectedRequest = requests.find((request) => request.id === selectedRequestId) ?? null;
  const requestCandidates = useMemo(() => candidates.filter((candidate) => candidate.logistics_booking_request_id === selectedRequestId), [candidates, selectedRequestId]);
  const requestSelections = useMemo(() => selections.filter((selection) => selection.logistics_booking_request_id === selectedRequestId), [selections, selectedRequestId]);
  const requestEvents = useMemo(() => events.filter((event) => event.logistics_booking_request_id === selectedRequestId), [events, selectedRequestId]);
  const selectedCandidate = selectedProviderCandidate(requestCandidates, requestSelections);

  function field<K extends keyof LogisticsProviderCandidateValues>(name: K, value: LogisticsProviderCandidateValues[K]) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function run(action: () => Promise<unknown>, success: string) {
    setErrors([]); setNotice(""); setIsSaving(true);
    try { await action(); setNotice(success); setEditingCandidateId(null); setValues(emptyLogisticsProviderCandidateValues()); await load(selectedRequestId); }
    catch (error) { setErrors([error instanceof Error ? error.message : "Logistics arrangement action failed."]); }
    finally { setIsSaving(false); }
  }

  async function saveCandidate() {
    const validation = validateLogisticsProviderCandidate(values);
    if (!selectedRequest || validation.length) { setErrors(validation.length ? validation : ["Choose a logistics booking request."]); return; }
    await run(
      () => editingCandidateId ? updateLogisticsProviderCandidate(editingCandidateId, values) : createLogisticsProviderCandidate(selectedRequest.id, values),
      editingCandidateId ? "Provider candidate updated." : "Provider candidate added.",
    );
  }

  return (
    <section className="quote-panel">
      <div className="quote-card-header"><div><p className="eyebrow">PH-010C</p><h4>Logistics Arrangement Workspace</h4></div></div>
      <p className="form-notice">{logisticsArrangementNotice()}</p>
      {isLoading && <LoadingState message="Loading logistics arrangement workspace..." />}
      <ErrorList errors={errors} />
      {notice && <p className="form-success">{notice}</p>}
      {!isLoading && requests.length === 0 && <p>No submitted logistics booking requests are ready for arrangement.</p>}
      {requests.length > 0 && (
        <label className="review-notes">Booking request
          <select value={selectedRequestId} onChange={(event) => { setSelectedRequestId(event.target.value); setEditingCandidateId(null); setValues(emptyLogisticsProviderCandidateValues()); }}>
            {requests.map((request) => <option key={request.id} value={request.id}>{request.booking_request_number} - {logisticsBookingStatusLabels[request.status]}</option>)}
          </select>
        </label>
      )}
      {selectedRequest && (
        <>
          <div className="meta-grid"><span>{selectedRequest.shipping_number}</span><span>{logisticsBookingStatusLabels[selectedRequest.status]}</span><span>{selectedRequest.requested_transport_mode}</span><span>{selectedRequest.requested_incoterm ?? "Incoterm unspecified"}</span></div>
          {canManageProviderCandidates(selectedRequest) && selectedRequest.status !== "ready_for_external_booking" && (
            <div className="quote-builder">
              <h5>{editingCandidateId ? "Edit provider candidate" : "Add provider candidate"}</h5>
              <div className="form-grid">
                <label>Provider name<input value={values.providerName} onChange={(event) => field("providerName", event.target.value)} /></label>
                <label>Provider type<select value={values.providerType} onChange={(event) => field("providerType", event.target.value as LogisticsProviderCandidateValues["providerType"])}>{logisticsProviderTypes.map((type) => <option key={type} value={type}>{logisticsProviderTypeLabels[type]}</option>)}</select></label>
                <label>Transport mode<select value={values.transportMode} onChange={(event) => field("transportMode", event.target.value as LogisticsProviderCandidateValues["transportMode"])}>{logisticsCandidateTransportModes.map((mode) => <option key={mode} value={mode}>{logisticsCandidateTransportModeLabels[mode]}</option>)}</select></label>
                <label>Service level<input value={values.serviceLevel} onChange={(event) => field("serviceLevel", event.target.value)} /></label>
                <label>Quote reference<input value={values.quoteReference} onChange={(event) => field("quoteReference", event.target.value)} /></label>
                <label>Estimated departure<input type="date" value={values.estimatedDepartureDate} onChange={(event) => field("estimatedDepartureDate", event.target.value)} /></label>
                <label>Estimated arrival<input type="date" value={values.estimatedArrivalDate} onChange={(event) => field("estimatedArrivalDate", event.target.value)} /></label>
                <label>Transit days<input type="number" min="0" value={values.estimatedTransitDays} onChange={(event) => field("estimatedTransitDays", event.target.value)} /></label>
                <label>Estimated cost<input type="number" min="0" step="0.01" value={values.estimatedCost} onChange={(event) => field("estimatedCost", event.target.value)} /></label>
                <label>Currency<input maxLength={3} value={values.currency} onChange={(event) => field("currency", event.target.value.toUpperCase())} /></label>
                <label>Contact name<input value={values.contactName} onChange={(event) => field("contactName", event.target.value)} /></label>
                <label>Contact email<input type="email" value={values.contactEmail} onChange={(event) => field("contactEmail", event.target.value)} /></label>
                <label>Contact phone<input value={values.contactPhone} onChange={(event) => field("contactPhone", event.target.value)} /></label>
              </div>
              <label>Internal notes<textarea value={values.notes} onChange={(event) => field("notes", event.target.value)} /></label>
              <div className="actions"><button disabled={isSaving} onClick={() => void saveCandidate()}>{editingCandidateId ? "Update candidate" : "Add candidate"}</button>{editingCandidateId && <button className="ghost" onClick={() => { setEditingCandidateId(null); setValues(emptyLogisticsProviderCandidateValues()); }}>Cancel edit</button>}</div>
            </div>
          )}
          <div className="review-list">
            {requestCandidates.map((candidate) => (
              <article className="quote-card" key={candidate.id}>
                <div className="quote-card-header"><div><h5>{candidate.provider_name}</h5><span>{logisticsProviderTypeLabels[candidate.provider_type]} - {logisticsCandidateTransportModeLabels[candidate.transport_mode]}</span></div><span className={`status status-${candidate.candidate_status}`}>{candidate.candidate_status}</span></div>
                <div className="meta-grid"><span>{candidate.service_level ?? "Service level pending"}</span><span>{candidate.estimated_transit_days !== null ? `${candidate.estimated_transit_days} days` : "Transit pending"}</span><span>{candidate.estimated_cost !== null ? `${candidate.currency ?? ""} ${candidate.estimated_cost.toFixed(2)}`.trim() : "Cost pending"}</span><span>Version {candidate.version}</span></div>
                {candidate.notes && <p>{candidate.notes}</p>}
                {candidate.candidate_status === "active" && selectedRequest.status !== "ready_for_external_booking" && <div className="actions"><button className="ghost" disabled={isSaving} onClick={() => { setEditingCandidateId(candidate.id); setValues(emptyLogisticsProviderCandidateValues(candidate)); }}>Edit</button><button disabled={isSaving || !canSelectProviderCandidate(candidate)} onClick={() => void run(() => selectLogisticsProviderCandidate(selectedRequest.id, candidate.id, "", Boolean(selectedCandidate)), selectedCandidate ? "Provider selection replaced." : "Provider selected.")}>{selectedCandidate ? "Replace selection" : "Select"}</button><button className="ghost" disabled={isSaving} onClick={() => { const reason = window.prompt("Withdrawal reason"); if (reason) void run(() => withdrawLogisticsProviderCandidate(candidate.id, reason), "Candidate withdrawn."); }}>Withdraw</button></div>}
              </article>
            ))}
          </div>
          {selectedCandidate && selectedRequest.status === "carrier_selected" && <div className="actions"><button disabled={isSaving || !canMarkReadyForExternalBooking(selectedRequest, selectedCandidate)} onClick={() => void run(() => markReadyForExternalBooking(selectedRequest.id), "Arrangement marked ready for external booking.")}>Mark ready for external booking</button><button className="ghost" disabled={isSaving} onClick={() => { const reason = window.prompt("Selection cancellation reason"); if (reason) void run(() => cancelLogisticsProviderSelection(selectedRequest.id, reason), "Provider selection cancelled."); }}>Cancel selection</button></div>}
          <div className="timeline-list">{requestEvents.map((event) => <div className="timeline-item" key={event.id}><span>{new Date(event.created_at).toLocaleString()}</span><strong>{logisticsArrangementEventLabels[event.event_type]}</strong></div>)}</div>
        </>
      )}
    </section>
  );
}
