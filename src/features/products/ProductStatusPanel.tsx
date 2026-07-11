import { productStatusLabels } from "../../lib/products";
import { formatDate } from "../../lib/format";
import type { ProductRecord } from "../../types";

interface ProductStatusPanelProps {
  product: ProductRecord;
}

export function ProductStatusPanel({ product }: ProductStatusPanelProps) {
  return (
    <dl className="status-list compact">
      <div>
        <dt>Status</dt>
        <dd>{productStatusLabels[product.status]}</dd>
      </div>
      <div>
        <dt>Submitted</dt>
        <dd>{formatDate(product.submitted_at)}</dd>
      </div>
      <div>
        <dt>Published</dt>
        <dd>{formatDate(product.published_at)}</dd>
      </div>
      <div>
        <dt>Archived</dt>
        <dd>{formatDate(product.archived_at)}</dd>
      </div>
    </dl>
  );
}
