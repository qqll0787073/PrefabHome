import { statusLabels } from "../../lib/manufacturers";
import { formatDate } from "../../lib/format";
import type { ManufacturerApplication } from "../../types";

interface ManufacturerStatusPanelProps {
  application: ManufacturerApplication | null;
}

export function ManufacturerStatusPanel({ application }: ManufacturerStatusPanelProps) {
  return (
    <div className="panel application-status-panel">
      <div>
        <p className="eyebrow">Manufacturer Application Status</p>
        <h2>{application ? statusLabels[application.application_status] : "Not started"}</h2>
        <p>
          {application
            ? application.review_notes || "Your application is available for review tracking."
            : "Complete the onboarding form to create your manufacturer application."}
        </p>
      </div>
      {application && (
        <dl className="status-list">
          <div>
            <dt>Submitted</dt>
            <dd>{formatDate(application.submitted_at)}</dd>
          </div>
          <div>
            <dt>Reviewed</dt>
            <dd>{formatDate(application.reviewed_at)}</dd>
          </div>
          <div>
            <dt>Products</dt>
            <dd>
              {application.application_status === "approved"
                ? "Product creation enabled"
                : "Product creation locked"}
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}
