import { useEffect, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import {
  fetchLogisticsArrangementEvents,
  fetchLogisticsProviderCandidates,
  fetchLogisticsProviderSelections,
  logisticsArrangementEventLabels,
  logisticsArrangementNotice,
  logisticsProviderTypeLabels,
  selectedProviderCandidate,
} from "../../lib/logisticsArrangement";
import { fetchBuyerBookingRequests, fetchManufacturerBookingRequests, logisticsBookingStatusLabels } from "../../lib/logisticsBookingRequests";
import type {
  LogisticsArrangementEventRecord,
  LogisticsBookingRequestRecord,
  LogisticsProviderCandidateRecord,
  LogisticsProviderSelectionRecord,
  Role,
} from "../../types";

interface LogisticsArrangementReadOnlyProps {
  authMode: "supabase" | "demo";
  role: Extract<Role, "buyer" | "manufacturer">;
}

export function LogisticsArrangementReadOnly({ authMode, role }: LogisticsArrangementReadOnlyProps) {
  const [requests, setRequests] = useState<LogisticsBookingRequestRecord[]>([]);
  const [candidates, setCandidates] = useState<LogisticsProviderCandidateRecord[]>([]);
  const [selections, setSelections] = useState<LogisticsProviderSelectionRecord[]>([]);
  const [events, setEvents] = useState<LogisticsArrangementEventRecord[]>([]);
  const [isLoading, setIsLoading] = useState(authMode === "supabase");
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    async function load() {
      setErrors([]);
      setIsLoading(true);
      try {
        if (authMode === "demo") {
          setRequests([]);
          setCandidates([]);
          setSelections([]);
          setEvents([]);
          return;
        }
        const [requestRows, candidateRows, selectionRows, eventRows] = await Promise.all([
          role === "buyer" ? fetchBuyerBookingRequests() : fetchManufacturerBookingRequests(),
          fetchLogisticsProviderCandidates(),
          fetchLogisticsProviderSelections(),
          fetchLogisticsArrangementEvents(),
        ]);
        setRequests(requestRows);
        setCandidates(candidateRows);
        setSelections(selectionRows);
        setEvents(eventRows);
      } catch (error) {
        setErrors([error instanceof Error ? error.message : "Unable to load logistics arrangements."]);
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, [authMode, role]);

  const arrangedRequests = requests.filter((request) => !["booking_draft", "submitted_for_arrangement", "withdrawn"].includes(request.status));

  return (
    <section className="quote-panel">
      <h4>{role === "buyer" ? "Buyer Logistics Arrangements" : "Manufacturer Logistics Arrangements"}</h4>
      <p className="form-notice">Read-only. {logisticsArrangementNotice()}</p>
      {isLoading && <LoadingState message="Loading logistics arrangements..." />}
      <ErrorList errors={errors} />
      {!isLoading && arrangedRequests.length === 0 && <p>No carrier options have been shared yet.</p>}
      <div className="review-list">
        {arrangedRequests.map((request) => {
          const requestCandidates = candidates.filter((candidate) => candidate.logistics_booking_request_id === request.id && candidate.candidate_status !== "withdrawn");
          const requestSelections = selections.filter((selection) => selection.logistics_booking_request_id === request.id);
          const selected = selectedProviderCandidate(requestCandidates, requestSelections);
          return (
            <article className="quote-card" key={request.id}>
              <div className="quote-card-header">
                <div><p className="eyebrow">{request.booking_request_number}</p><h5>{request.shipping_number}</h5></div>
                <span className={`status status-${request.status}`}>{logisticsBookingStatusLabels[request.status]}</span>
              </div>
              {selected && <p><strong>Selected planning option:</strong> {selected.provider_name} ({logisticsProviderTypeLabels[selected.provider_type]})</p>}
              <div className="quote-line-items">
                {requestCandidates.map((candidate) => (
                  <div className="meta-row" key={candidate.id}>
                    <span>{candidate.provider_name} · {logisticsProviderTypeLabels[candidate.provider_type]}</span>
                    <span>{candidate.estimated_cost !== null ? `${candidate.currency ?? ""} ${candidate.estimated_cost.toFixed(2)}`.trim() : "Estimate pending"}</span>
                  </div>
                ))}
              </div>
              <div className="timeline-list">
                {events.filter((event) => event.logistics_booking_request_id === request.id).map((event) => (
                  <div className="timeline-item" key={event.id}><span>{new Date(event.created_at).toLocaleString()}</span><strong>{logisticsArrangementEventLabels[event.event_type]}</strong></div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
