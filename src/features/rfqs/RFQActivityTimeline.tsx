import { useEffect, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import { fetchRFQEvents } from "../../lib/rfq";
import type { RFQEventRecord, RFQWithDetails } from "../../types";

const eventLabels: Record<string, string> = {
  draft_created: "Draft created",
  submitted: "RFQ submitted",
  manufacturer_opened: "Manufacturer opened RFQ",
  manufacturer_replied: "Manufacturer replied",
  quote_created: "Quote submitted",
  buyer_opened: "Buyer opened quote",
  accepted: "Quote accepted",
  declined: "Quote declined",
  quote_accepted: "Quote accepted",
  quote_rejected: "Quote rejected",
  quote_revision_requested: "Quote revision requested",
  cancelled: "RFQ cancelled",
  expired: "RFQ expired",
};

interface RFQActivityTimelineProps {
  rfq: RFQWithDetails | null;
  authMode: "supabase" | "demo";
}

export function RFQActivityTimeline({ rfq, authMode }: RFQActivityTimelineProps) {
  const [events, setEvents] = useState<RFQEventRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    setEvents([]);
    setErrors([]);
    if (!rfq || authMode === "demo") return;
    setIsLoading(true);
    fetchRFQEvents(rfq.id)
      .then((items) => { if (active) setEvents(items); })
      .catch(() => { if (active) setErrors(["Unable to load RFQ activity."]); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [authMode, rfq?.id]);

  if (!rfq) return null;

  return (
    <section className="quote-panel" aria-labelledby="rfq-activity-heading">
      <h3 id="rfq-activity-heading">RFQ Activity</h3>
      <p className="helper-text">Database-recorded lifecycle activity. Internal event metadata is not displayed.</p>
      <ErrorList errors={errors} />
      {isLoading && <LoadingState message="Loading RFQ activity..." />}
      {!isLoading && events.length === 0 && <p>No recorded activity is visible.</p>}
      <ol className="activity-timeline">
        {events.map((event) => (
          <li key={event.id}>
            <strong>{eventLabels[event.event_type] || "Activity recorded"}</strong>
            <time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString()}</time>
          </li>
        ))}
      </ol>
    </section>
  );
}
