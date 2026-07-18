import React, { useEffect, useMemo, useRef, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import {
  canManageProviderCandidates,
  canMarkReadyForExternalBooking,
  canSelectProviderCandidate,
  cancelLogisticsProviderSelection,
  createLogisticsProviderCandidate,
  emptyLogisticsProviderCandidateValues,
  fetchAdminLogisticsArrangementEvents,
  fetchAdminLogisticsProviderCandidates,
  fetchAdminLogisticsProviderSelections,
  logisticsArrangementEventLabels,
  logisticsArrangementNotice,
  logisticsCandidateTransportModeLabels,
  logisticsCandidateTransportModes,
  logisticsProviderTypeLabels,
  logisticsProviderTypes,
  markReadyForExternalBooking,
  selectLogisticsProviderCandidate,
  selectedProviderCandidate,
  updateLogisticsProviderCandidate,
  validateLogisticsProviderCandidate,
  withdrawLogisticsProviderCandidate,
} from "../../lib/logisticsArrangement";
import {
  fetchAdminBookingRequests,
  fetchLogisticsBookingRequestEvents,
  logisticsBookingEventLabels,
  logisticsBookingStatusLabels,
  logisticsPlanningDisclaimer,
} from "../../lib/logisticsBookingRequests";
import type {
  LogisticsArrangementEventRecord,
  LogisticsBookingRequestEventRecord,
  LogisticsBookingRequestRecord,
  LogisticsProviderCandidateRecord,
  LogisticsProviderCandidateValues,
  LogisticsProviderSelectionRecord,
} from "../../types";
import { LogisticsActionDialog } from "./LogisticsActionDialog";
import {
  canEditAdminCandidate,
  describePartialFailure,
  filterLogisticsRequests,
  isLogisticsLifecycleConflict,
  logisticsNextStep,
  logisticsStatusCounts,
  reconcileLogisticsRequestId,
  type LogisticsStatusFilter,
} from "./logisticsWorkspaceModel";

interface AdminLogisticsWorkspaceProps {
  authMode: "supabase" | "demo";
  selectedRequestId: string | null;
  onSelectedRequestChange: (requestId: string | null) => void;
}

type DialogState =
  | { kind: "withdraw"; candidate: LogisticsProviderCandidateRecord }
  | { kind: "select" | "replace"; candidate: LogisticsProviderCandidateRecord }
  | { kind: "cancel" | "ready" }
  | null;

const adminStatuses: LogisticsStatusFilter[] = [
  "all",
  "submitted_for_arrangement",
  "carrier_options_available",
  "carrier_selected",
  "ready_for_external_booking",
];

export function AdminLogisticsWorkspace({ authMode, selectedRequestId, onSelectedRequestChange }: AdminLogisticsWorkspaceProps) {
  const [requests, setRequests] = useState<LogisticsBookingRequestRecord[]>([]);
  const [bookingEvents, setBookingEvents] = useState<LogisticsBookingRequestEventRecord[]>([]);
  const [candidates, setCandidates] = useState<LogisticsProviderCandidateRecord[]>([]);
  const [selections, setSelections] = useState<LogisticsProviderSelectionRecord[]>([]);
  const [events, setEvents] = useState<LogisticsArrangementEventRecord[]>([]);
  const [values, setValues] = useState<LogisticsProviderCandidateValues>(emptyLogisticsProviderCandidateValues());
  const [editingCandidateId, setEditingCandidateId] = useState<string | null>(null);
  const [filter, setFilter] = useState<LogisticsStatusFilter>("all");
  const [search, setSearch] = useState("");
  const [initialLoading, setInitialLoading] = useState(authMode === "supabase");
  const [detailLoading, setDetailLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState(false);
  const [savingAction, setSavingAction] = useState<string | null>(null);
  const [criticalError, setCriticalError] = useState<string | null>(null);
  const [secondaryErrors, setSecondaryErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [dialogReason, setDialogReason] = useState("");
  const [returnFocusTo, setReturnFocusTo] = useState<HTMLElement | null>(null);
  const queueGeneration = useRef(0);
  const detailGeneration = useRef(0);

  const activeRequests = useMemo(() => requests.filter((request) => !["booking_draft", "withdrawn"].includes(request.status)), [requests]);
  const counts = useMemo(() => logisticsStatusCounts(activeRequests), [activeRequests]);
  const visibleRequests = useMemo(() => filterLogisticsRequests(activeRequests, filter, search), [activeRequests, filter, search]);
  const selectedRequest = activeRequests.find((request) => request.id === selectedRequestId) ?? null;
  const selectedCandidate = selectedProviderCandidate(candidates, selections);
  const actionsDisabled = stale || initialLoading || refreshing || Boolean(savingAction) || detailLoading;

  async function loadQueue(background = false, preferredRequestId = selectedRequestId) {
    const generation = ++queueGeneration.current;
    if (background) setRefreshing(true); else setInitialLoading(true);
    setCriticalError(null);
    try {
      if (authMode === "demo") {
        setRequests([]);
        onSelectedRequestChange(null);
        setStale(false);
        return;
      }
      const rows = await fetchAdminBookingRequests();
      if (generation !== queueGeneration.current) return;
      setRequests(rows);
      const eligible = rows.filter((request) => !["booking_draft", "withdrawn"].includes(request.status));
      const nextRequestId = reconcileLogisticsRequestId(eligible, preferredRequestId);
      if (nextRequestId !== selectedRequestId) onSelectedRequestChange(nextRequestId);
      setStale(false);
    } catch (error) {
      if (generation !== queueGeneration.current) return;
      setCriticalError(error instanceof Error ? error.message : "Unable to load the logistics request queue.");
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
      fetchAdminLogisticsProviderCandidates(requestId),
      fetchAdminLogisticsProviderSelections(requestId),
      fetchAdminLogisticsArrangementEvents(requestId),
    ]);
    if (generation !== detailGeneration.current) return;
    const failures: string[] = [];
    const [bookingResult, candidateResult, selectionResult, eventResult] = results;
    if (bookingResult.status === "fulfilled") setBookingEvents(bookingResult.value); else failures.push("booking timeline");
    if (candidateResult.status === "fulfilled") setCandidates(candidateResult.value); else failures.push("provider candidates");
    if (selectionResult.status === "fulfilled") setSelections(selectionResult.value); else failures.push("selection history");
    if (eventResult.status === "fulfilled") setEvents(eventResult.value); else failures.push("internal timeline");
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
  }, [authMode]);

  useEffect(() => {
    if (!selectedRequest) {
      setCandidates([]);
      setSelections([]);
      setEvents([]);
      setBookingEvents([]);
      return;
    }
    setEditingCandidateId(null);
    setValues(emptyLogisticsProviderCandidateValues());
    void loadDetail(selectedRequest.id);
  }, [selectedRequest?.id, selectedRequest?.updated_at]);

  function field<K extends keyof LogisticsProviderCandidateValues>(name: K, value: LogisticsProviderCandidateValues[K]) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function reconcileAfterMutation(requestId: string) {
    await loadQueue(true, requestId);
    await loadDetail(requestId);
  }

  async function runMutation(actionName: string, action: () => Promise<unknown>, success: string) {
    if (!selectedRequest) return;
    setSavingAction(actionName);
    setCriticalError(null);
    setNotice("");
    try {
      await action();
      setNotice(success);
      setStale(false);
      setDialog(null);
      setDialogReason("");
      setEditingCandidateId(null);
      setValues(emptyLogisticsProviderCandidateValues());
      await reconcileAfterMutation(selectedRequest.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Logistics arrangement action failed.";
      setCriticalError(message);
      if (isLogisticsLifecycleConflict(message)) {
        setStale(true);
        await reconcileAfterMutation(selectedRequest.id);
        setCriticalError(message);
        setNotice("The latest authoritative state has been loaded. Review it before trying again.");
      }
    } finally {
      setSavingAction(null);
    }
  }

  async function saveCandidate() {
    if (!selectedRequest) return;
    const errors = validateLogisticsProviderCandidate(values);
    if (errors.length) { setCriticalError(errors.join(" ")); return; }
    await runMutation(
      editingCandidateId ? "update-candidate" : "create-candidate",
      () => editingCandidateId ? updateLogisticsProviderCandidate(editingCandidateId, values) : createLogisticsProviderCandidate(selectedRequest.id, values),
      editingCandidateId ? "Provider candidate updated." : "Provider candidate created.",
    );
  }

  function openDialog(next: Exclude<DialogState, null>, target: EventTarget | null) {
    setReturnFocusTo(target instanceof HTMLElement ? target : document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setDialogReason("");
    setDialog(next);
  }

  async function confirmDialog() {
    if (!dialog || !selectedRequest) return;
    if (dialog.kind === "withdraw") return runMutation("withdraw-candidate", () => withdrawLogisticsProviderCandidate(dialog.candidate.id, dialogReason), "Provider candidate withdrawn.");
    if (dialog.kind === "select" || dialog.kind === "replace") return runMutation("select-provider", () => selectLogisticsProviderCandidate(selectedRequest.id, dialog.candidate.id, dialogReason, dialog.kind === "replace"), dialog.kind === "replace" ? "Provider selection replaced." : "Provider selected.");
    if (dialog.kind === "cancel") return runMutation("cancel-selection", () => cancelLogisticsProviderSelection(selectedRequest.id, dialogReason), "Provider selection cancelled.");
    return runMutation("mark-ready", () => markReadyForExternalBooking(selectedRequest.id), "Arrangement marked ready for external booking.");
  }

  const dialogContent = (() => {
    if (!dialog) return { title: "", description: "", confirmLabel: "Confirm", reasonLabel: undefined, reasonRequired: false };
    if (dialog.kind === "withdraw") return { title: "Withdraw provider candidate", description: `Withdraw ${dialog.candidate.provider_name} from this internal planning request?`, confirmLabel: "Withdraw candidate", reasonLabel: "Withdrawal reason", reasonRequired: true };
    if (dialog.kind === "select") return { title: "Select provider", description: `Select ${dialog.candidate.provider_name} as the current internal planning option? This does not create an external booking.`, confirmLabel: "Select provider", reasonLabel: "Selection reason", reasonRequired: false };
    if (dialog.kind === "replace") return { title: "Replace selected provider", description: `Replace the current selection with ${dialog.candidate.provider_name}? The previous selection remains in history.`, confirmLabel: "Replace provider", reasonLabel: "Replacement reason", reasonRequired: false };
    if (dialog.kind === "cancel") return { title: "Cancel provider selection", description: "Cancel the current internal provider selection and return the request to provider options?", confirmLabel: "Cancel selection", reasonLabel: "Cancellation reason", reasonRequired: true };
    return { title: "Mark ready for external booking", description: "Confirm that the selected planning estimate is complete. This does not contact the provider or create an external booking.", confirmLabel: "Mark ready", reasonLabel: undefined, reasonRequired: false };
  })();

  if (authMode === "demo") {
    return <section className="logistics-workspace-state panel"><p className="eyebrow">Demo mode</p><h3>Admin Logistics requires Supabase</h3><p>No synthetic request queue or provider records are created in demo mode.</p></section>;
  }

  return (
    <section className="logistics-workspace admin-logistics" aria-labelledby="admin-logistics-title">
      <header className="workspace-toolbar">
        <div><p className="eyebrow">Internal operations</p><h3 id="admin-logistics-title">Admin Logistics</h3><p>{logisticsPlanningDisclaimer()}</p></div>
        <button type="button" className="secondary-button" disabled={refreshing || initialLoading} onClick={() => void loadQueue(true)}>{refreshing ? "Refreshing..." : "Refresh queue"}</button>
      </header>
      {initialLoading && <LoadingState message="Loading logistics request queue..." />}
      {criticalError && <div className="workspace-error" role="alert"><ErrorList errors={[criticalError]} /><button type="button" onClick={() => void loadQueue(true)}>Retry authoritative refresh</button></div>}
      {secondaryErrors.length > 0 && <div className="workspace-warning" role="status"><ErrorList errors={secondaryErrors} /><button type="button" className="ghost" onClick={() => selectedRequest && void loadDetail(selectedRequest.id)}>Retry details</button></div>}
      {stale && <p className="stale-warning" role="status">The workspace may be stale. Mutations are disabled until the selected request refreshes successfully.</p>}
      {notice && <p className="form-success" role="status">{notice}</p>}

      <div className="queue-controls">
        <label>Search requests<input type="search" value={search} placeholder="Booking, shipping, PO, contract, or invoice" onChange={(event) => setSearch(event.target.value)} /></label>
        <div className="status-filter-bar" aria-label="Admin logistics status filters">
          {adminStatuses.map((status) => <button type="button" key={status} className={filter === status ? "active" : ""} aria-pressed={filter === status} onClick={() => setFilter(status)}>{status === "all" ? "Active" : logisticsBookingStatusLabels[status]} <span>{counts[status]}</span></button>)}
        </div>
      </div>

      {!initialLoading && activeRequests.length === 0 && !criticalError && <div className="empty-workspace"><h4>No submitted logistics requests</h4><p>Manufacturer submissions will appear here for provider planning.</p></div>}

      <div className="logistics-split-view">
        <aside className="request-list" aria-label="Admin logistics request queue">
          {visibleRequests.map((request) => <button type="button" key={request.id} className={selectedRequestId === request.id ? "request-list-item active" : "request-list-item"} aria-current={selectedRequestId === request.id ? "true" : undefined} onClick={() => onSelectedRequestChange(request.id)}><strong>{request.booking_request_number}</strong><span>{request.shipping_number}</span><small>{logisticsBookingStatusLabels[request.status]}</small></button>)}
          {activeRequests.length > 0 && visibleRequests.length === 0 && <p>No requests match the current filter.</p>}
        </aside>

        <div className="request-detail" aria-live="polite">
          {!selectedRequest && activeRequests.length > 0 && <p>Select a request to manage provider planning.</p>}
          {selectedRequest && (
            <>
              <header className="request-detail-header"><div><p className="eyebrow">{selectedRequest.booking_request_number}</p><h4>{selectedRequest.shipping_number}</h4></div><span className={`status status-${selectedRequest.status}`}>{logisticsBookingStatusLabels[selectedRequest.status]}</span></header>
              <p className="next-step"><strong>Next step:</strong> {logisticsNextStep(selectedRequest.status, "admin")}</p>
              <div className="meta-grid"><span>PO {selectedRequest.purchase_order_number}</span><span>Contract {selectedRequest.contract_number}</span><span>Invoice {selectedRequest.invoice_number}</span><span>Mode {selectedRequest.requested_transport_mode}</span><span>Incoterm {selectedRequest.requested_incoterm ?? "Unspecified"}</span><span>Requested departure {selectedRequest.preferred_departure_date ? new Date(selectedRequest.preferred_departure_date).toLocaleDateString() : "Not specified"}</span></div>
              {detailLoading && <LoadingState message="Loading internal arrangement details..." />}

              {canManageProviderCandidates(selectedRequest) && selectedRequest.status !== "ready_for_external_booking" && (
                <section className="candidate-editor" aria-labelledby="candidate-editor-title">
                  <div className="section-heading"><h4 id="candidate-editor-title">{editingCandidateId ? "Edit provider candidate" : "Add provider candidate"}</h4>{editingCandidateId && <span>Editing version {candidates.find((item) => item.id === editingCandidateId)?.version}</span>}</div>
                  <div className="form-grid">
                    <label>Provider name<input value={values.providerName} disabled={actionsDisabled} onChange={(event) => field("providerName", event.target.value)} /></label>
                    <label>Provider type<select value={values.providerType} disabled={actionsDisabled} onChange={(event) => field("providerType", event.target.value as LogisticsProviderCandidateValues["providerType"])}>{logisticsProviderTypes.map((type) => <option key={type} value={type}>{logisticsProviderTypeLabels[type]}</option>)}</select></label>
                    <label>Transport mode<select value={values.transportMode} disabled={actionsDisabled} onChange={(event) => field("transportMode", event.target.value as LogisticsProviderCandidateValues["transportMode"])}>{logisticsCandidateTransportModes.map((mode) => <option key={mode} value={mode}>{logisticsCandidateTransportModeLabels[mode]}</option>)}</select></label>
                    <label>Service level<input value={values.serviceLevel} disabled={actionsDisabled} onChange={(event) => field("serviceLevel", event.target.value)} /></label>
                    <label>Estimated departure<input type="date" value={values.estimatedDepartureDate} disabled={actionsDisabled} onChange={(event) => field("estimatedDepartureDate", event.target.value)} /></label>
                    <label>Estimated arrival<input type="date" value={values.estimatedArrivalDate} disabled={actionsDisabled} onChange={(event) => field("estimatedArrivalDate", event.target.value)} /></label>
                    <label>Transit days<input type="number" min="0" value={values.estimatedTransitDays} disabled={actionsDisabled} onChange={(event) => field("estimatedTransitDays", event.target.value)} /></label>
                    <label>Estimated cost<input type="number" min="0" step="0.01" value={values.estimatedCost} disabled={actionsDisabled} onChange={(event) => field("estimatedCost", event.target.value)} /></label>
                    <label>Currency<input maxLength={3} value={values.currency} disabled={actionsDisabled} onChange={(event) => field("currency", event.target.value.toUpperCase())} /></label>
                    <label>Quote reference<input value={values.quoteReference} disabled={actionsDisabled} onChange={(event) => field("quoteReference", event.target.value)} /></label>
                    <label>Contact name<input value={values.contactName} disabled={actionsDisabled} onChange={(event) => field("contactName", event.target.value)} /></label>
                    <label>Contact email<input type="email" value={values.contactEmail} disabled={actionsDisabled} onChange={(event) => field("contactEmail", event.target.value)} /></label>
                    <label>Contact phone<input value={values.contactPhone} disabled={actionsDisabled} onChange={(event) => field("contactPhone", event.target.value)} /></label>
                  </div>
                  <label>Internal notes<textarea value={values.notes} disabled={actionsDisabled} onChange={(event) => field("notes", event.target.value)} /></label>
                  <div className="actions"><button type="button" disabled={actionsDisabled} onClick={() => void saveCandidate()}>{savingAction?.includes("candidate") ? "Saving..." : editingCandidateId ? "Update candidate" : "Add candidate"}</button>{editingCandidateId && <button type="button" className="ghost" disabled={Boolean(savingAction)} onClick={() => { setEditingCandidateId(null); setValues(emptyLogisticsProviderCandidateValues()); }}>Cancel edit</button>}</div>
                </section>
              )}

              <section className="provider-options" aria-labelledby="admin-candidates-title">
                <div className="section-heading"><h4 id="admin-candidates-title">Provider candidates</h4><span>{candidates.length}</span></div>
                {candidates.length === 0 && <p>No provider candidates yet.</p>}
                <div className="review-list">
                  {candidates.map((candidate) => (
                    <article className={candidate.id === selectedCandidate?.id ? "quote-card selected-option" : "quote-card"} key={candidate.id}>
                      <div className="quote-card-header"><div><h5>{candidate.provider_name}</h5><span>{logisticsProviderTypeLabels[candidate.provider_type]} / {logisticsCandidateTransportModeLabels[candidate.transport_mode]}</span></div><span>{candidate.candidate_status}</span></div>
                      <div className="meta-grid"><span>{candidate.service_level ?? "Service pending"}</span><span>Departure {candidate.estimated_departure_date ?? "pending"}</span><span>Arrival {candidate.estimated_arrival_date ?? "pending"}</span><span>{candidate.estimated_transit_days !== null ? `${candidate.estimated_transit_days} days` : "Transit pending"}</span><span>{candidate.estimated_cost !== null ? `${candidate.currency ?? ""} ${candidate.estimated_cost.toFixed(2)}`.trim() : "Cost pending"}</span><span>Version {candidate.version}</span></div>
                      <dl className="internal-detail-grid"><div><dt>Quote reference</dt><dd>{candidate.quote_reference ?? "Not provided"}</dd></div><div><dt>Contact</dt><dd>{candidate.contact_name ?? "Not provided"}</dd></div><div><dt>Email</dt><dd>{candidate.contact_email ?? "Not provided"}</dd></div><div><dt>Phone</dt><dd>{candidate.contact_phone ?? "Not provided"}</dd></div></dl>
                      {candidate.notes && <p className="internal-note"><strong>Internal notes:</strong> {candidate.notes}</p>}
                      {candidate.candidate_status === "active" && selectedRequest.status !== "ready_for_external_booking" && <div className="actions"><button type="button" className="ghost" disabled={actionsDisabled || !canEditAdminCandidate(selectedRequest, candidate)} onClick={() => { setEditingCandidateId(candidate.id); setValues(emptyLogisticsProviderCandidateValues(candidate)); }}>Edit</button><button type="button" disabled={actionsDisabled || !canSelectProviderCandidate(candidate)} onClick={(event) => openDialog({ kind: selectedCandidate ? "replace" : "select", candidate }, event.currentTarget)}>{selectedCandidate ? "Replace selection" : "Select provider"}</button><button type="button" className="ghost" disabled={actionsDisabled} onClick={(event) => openDialog({ kind: "withdraw", candidate }, event.currentTarget)}>Withdraw</button></div>}
                    </article>
                  ))}
                </div>
              </section>

              {selectedCandidate && selectedRequest.status === "carrier_selected" && <div className="actions arrangement-actions"><button type="button" disabled={actionsDisabled || !canMarkReadyForExternalBooking(selectedRequest, selectedCandidate)} onClick={(event) => openDialog({ kind: "ready" }, event.currentTarget)}>Mark ready for external booking</button><button type="button" className="ghost" disabled={actionsDisabled} onClick={(event) => openDialog({ kind: "cancel" }, event.currentTarget)}>Cancel selection</button></div>}

              <section className="selection-history"><h4>Selection history</h4>{selections.length === 0 ? <p>No provider selection yet.</p> : selections.map((selection) => <div className="meta-row" key={selection.id}><span>{selection.selection_status} / {candidates.find((candidate) => candidate.id === selection.selected_candidate_id)?.provider_name ?? selection.selected_candidate_id}</span><span>{new Date(selection.selected_at).toLocaleString()}</span></div>)}</section>

              <section className="timeline-section" aria-labelledby="admin-arrangement-timeline"><h4 id="admin-arrangement-timeline">Internal timeline</h4><div className="timeline-list">{[
                ...bookingEvents.map((event) => ({ id: event.id, createdAt: event.created_at, label: logisticsBookingEventLabels[event.event_type], actor: event.actor_profile_id, metadata: event.metadata })),
                ...events.map((event) => ({ id: event.id, createdAt: event.created_at, label: logisticsArrangementEventLabels[event.event_type], actor: event.actor_profile_id, metadata: event.metadata })),
              ].sort((left, right) => left.createdAt.localeCompare(right.createdAt)).map((event) => <div className="timeline-item admin-timeline-item" key={event.id}><span>{new Date(event.createdAt).toLocaleString()}</span><strong>{event.label}</strong><small>Actor {event.actor ?? "system"}</small>{Object.keys(event.metadata).length > 0 && <code>{JSON.stringify(event.metadata)}</code>}</div>)}</div></section>
              <p className="form-notice">{logisticsArrangementNotice()}</p>
            </>
          )}
        </div>
      </div>

      <LogisticsActionDialog open={Boolean(dialog)} title={dialogContent.title} description={dialogContent.description} confirmLabel={dialogContent.confirmLabel} reasonLabel={dialogContent.reasonLabel} reason={dialogReason} reasonRequired={dialogContent.reasonRequired} isSaving={Boolean(savingAction)} returnFocusTo={returnFocusTo} onReasonChange={setDialogReason} onConfirm={() => void confirmDialog()} onClose={() => { setDialog(null); setDialogReason(""); }} />
    </section>
  );
}
