import { useEffect, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import {
  fetchAdminShippingReadiness,
  fetchShippingReadinessEvents,
  shippingPlanningDisclaimer,
} from "../../lib/shippingReadiness";
import type { ShippingReadinessEventRecord, ShippingReadinessRecord } from "../../types";
import { ShippingReadinessSummary } from "./ShippingReadinessSummary";

interface AdminShippingReadinessProps {
  authMode: "supabase" | "demo";
}

export function AdminShippingReadiness({ authMode }: AdminShippingReadinessProps) {
  const [records, setRecords] = useState<ShippingReadinessRecord[]>([]);
  const [eventsByRecord, setEventsByRecord] = useState<Record<string, ShippingReadinessEventRecord[]>>({});
  const [isLoading, setIsLoading] = useState(authMode === "supabase");
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    async function loadShippingReadiness() {
      setErrors([]);
      setIsLoading(true);
      try {
        if (authMode === "demo") {
          setRecords([]);
          setEventsByRecord({});
        } else {
          const recordRows = await fetchAdminShippingReadiness();
          const eventEntries = await Promise.all(
            recordRows.map(async (record) => [record.id, await fetchShippingReadinessEvents(record.id)] as const)
          );
          setRecords(recordRows);
          setEventsByRecord(Object.fromEntries(eventEntries));
        }
      } catch (error) {
        setErrors([error instanceof Error ? error.message : "Unable to load shipping readiness."]);
      } finally {
        setIsLoading(false);
      }
    }

    void loadShippingReadiness();
  }, [authMode]);

  return (
    <section className="quote-panel">
      <h4>Admin Shipping Readiness</h4>
      {isLoading && <LoadingState message="Loading shipping readiness..." />}
      <ErrorList errors={errors} />
      <p className="form-notice">Admin shipping readiness access is read-only in PH-010A. {shippingPlanningDisclaimer()}</p>
      {records.length === 0 && !isLoading && <p>No shipping readiness records yet.</p>}
      <div className="review-list">
        {records.map((record) => (
          <ShippingReadinessSummary
            key={record.id}
            record={record}
            events={eventsByRecord[record.id] ?? []}
            showSnapshots
          />
        ))}
      </div>
    </section>
  );
}
