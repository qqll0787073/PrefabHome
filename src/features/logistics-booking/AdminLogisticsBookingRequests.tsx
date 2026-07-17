import { useEffect, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import { fetchAdminBookingRequests, fetchLogisticsBookingRequestEvents, logisticsPlanningDisclaimer } from "../../lib/logisticsBookingRequests";
import type { LogisticsBookingRequestEventRecord, LogisticsBookingRequestRecord } from "../../types";
import { LogisticsBookingRequestSummary } from "./LogisticsBookingRequestSummary";

interface AdminLogisticsBookingRequestsProps {
  authMode: "supabase" | "demo";
}

export function AdminLogisticsBookingRequests({ authMode }: AdminLogisticsBookingRequestsProps) {
  const [requests, setRequests] = useState<LogisticsBookingRequestRecord[]>([]);
  const [eventsByRequest, setEventsByRequest] = useState<Record<string, LogisticsBookingRequestEventRecord[]>>({});
  const [isLoading, setIsLoading] = useState(authMode === "supabase");
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    async function loadRequests() {
      setErrors([]);
      setIsLoading(true);
      try {
        if (authMode === "demo") {
          setRequests([]);
          setEventsByRequest({});
        } else {
          const rows = await fetchAdminBookingRequests();
          const entries = await Promise.all(rows.map(async (request) => [request.id, await fetchLogisticsBookingRequestEvents(request.id)] as const));
          setRequests(rows);
          setEventsByRequest(Object.fromEntries(entries));
        }
      } catch (error) {
        setErrors([error instanceof Error ? error.message : "Unable to load logistics booking requests."]);
      } finally {
        setIsLoading(false);
      }
    }
    void loadRequests();
  }, [authMode]);

  return (
    <section className="quote-panel">
      <h4>Admin Logistics Booking Requests</h4>
      {isLoading && <LoadingState message="Loading logistics booking requests..." />}
      <ErrorList errors={errors} />
      <p className="form-notice">Admin access is read-only in PH-010B. {logisticsPlanningDisclaimer()}</p>
      {requests.length === 0 && !isLoading && <p>No logistics booking requests yet.</p>}
      <div className="review-list">
        {requests.map((request) => <LogisticsBookingRequestSummary key={request.id} request={request} events={eventsByRequest[request.id] ?? []} showSnapshots />)}
      </div>
    </section>
  );
}
