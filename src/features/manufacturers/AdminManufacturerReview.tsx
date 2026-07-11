import { useEffect, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import {
  adminReviewStatuses,
  fetchManufacturerApplications,
  reviewManufacturerApplication,
  statusLabels,
} from "../../lib/manufacturers";
import { formatDate } from "../../lib/format";
import type { ManufacturerApplication, ManufacturerApplicationStatus } from "../../types";

interface AdminManufacturerReviewProps {
  authMode: "supabase" | "demo";
}

export function AdminManufacturerReview({ authMode }: AdminManufacturerReviewProps) {
  const [applications, setApplications] = useState<ManufacturerApplication[]>([]);
  const [isLoading, setIsLoading] = useState(authMode === "supabase");
  const [error, setError] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [isReviewing, setIsReviewing] = useState<string | null>(null);

  async function loadApplications() {
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchManufacturerApplications();
      setApplications(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load applications.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (authMode === "demo") {
      setApplications([]);
      setIsLoading(false);
      return;
    }

    void loadApplications();
  }, [authMode]);

  async function applyReview(
    application: ManufacturerApplication,
    status: ManufacturerApplicationStatus
  ) {
    setIsReviewing(`${application.id}:${status}`);
    setError(null);

    try {
      const updated = await reviewManufacturerApplication(
        application.id,
        status,
        reviewNotes[application.id] ?? application.review_notes ?? ""
      );
      setApplications((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Unable to review application.");
    } finally {
      setIsReviewing(null);
    }
  }

  return (
    <section className="workspace-section">
      <section className="panel">
        <p className="eyebrow">Admin Manufacturer Review</p>
        <h2>Application queue</h2>
        <ErrorList errors={error ? [error] : []} />
        {isLoading && <LoadingState message="Loading manufacturer applications..." />}
        {!isLoading && applications.length === 0 && (
          <p>
            {authMode === "demo"
              ? "Demo mode has no shared manufacturer applications."
              : "No manufacturer applications are waiting for review."}
          </p>
        )}
        <div className="review-list">
          {applications.map((application) => (
            <article className="review-item" key={application.id}>
              <div>
                <p className="eyebrow">{statusLabels[application.application_status]}</p>
                <h3>{application.company_display_name ?? application.company_name}</h3>
                <p>{application.company_description || "No company description provided."}</p>
                <dl className="status-list compact">
                  <div>
                    <dt>Contact</dt>
                    <dd>{application.contact_person ?? "Not provided"}</dd>
                  </div>
                  <div>
                    <dt>Location</dt>
                    <dd>
                      {[application.city, application.province, application.country]
                        .filter(Boolean)
                        .join(", ")}
                    </dd>
                  </div>
                  <div>
                    <dt>Categories</dt>
                    <dd>{application.product_categories.join(", ") || "Not provided"}</dd>
                  </div>
                  <div>
                    <dt>Submitted</dt>
                    <dd>{formatDate(application.submitted_at)}</dd>
                  </div>
                </dl>
              </div>
              <label className="review-notes">
                Review notes
                <textarea
                  value={reviewNotes[application.id] ?? application.review_notes ?? ""}
                  onChange={(event) =>
                    setReviewNotes((current) => ({
                      ...current,
                      [application.id]: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="actions">
                {adminReviewStatuses.map((status) => (
                  <button
                    key={status}
                    type="button"
                    disabled={Boolean(isReviewing)}
                    onClick={() => void applyReview(application, status)}
                  >
                    {isReviewing === `${application.id}:${status}`
                      ? "Saving..."
                      : status === "draft"
                        ? "Return for Revision"
                        : statusLabels[status]}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
