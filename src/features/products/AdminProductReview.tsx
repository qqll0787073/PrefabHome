import { useEffect, useMemo, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import {
  adminReviewProduct,
  fetchAllProductsForAdmin,
  getAllowedAdminProductTransitions,
  productStatusLabels,
  productStatuses,
} from "../../lib/products";
import type { ProductLifecycleStatus, ProductRecord } from "../../types";
import { ProductMediaManager } from "../product-media/ProductMediaManager";
import { ProductStatusPanel } from "./ProductStatusPanel";

interface AdminProductReviewProps {
  authMode: "supabase" | "demo";
}

export function AdminProductReview({ authMode }: AdminProductReviewProps) {
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<ProductLifecycleStatus | "all">("submitted");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(authMode === "supabase");
  const [isReviewing, setIsReviewing] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  async function loadProducts() {
    setIsLoading(true);
    setErrors([]);

    try {
      if (authMode === "demo") {
        setProducts([]);
        return;
      }

      setProducts(await fetchAllProductsForAdmin());
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to load products."]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts();
  }, [authMode]);

  const filteredProducts = useMemo(
    () =>
      statusFilter === "all"
        ? products
        : products.filter((product) => product.status === statusFilter),
    [products, statusFilter]
  );

  async function applyReview(product: ProductRecord, status: ProductLifecycleStatus) {
    setIsReviewing(`${product.id}:${status}`);
    setErrors([]);

    try {
      const updated = await adminReviewProduct(
        product.id,
        product.status,
        status,
        reviewNotes[product.id] ?? product.review_notes ?? ""
      );
      setProducts((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to review product."]);
    } finally {
      setIsReviewing(null);
    }
  }

  return (
    <section className="workspace-section">
      <section className="panel">
        <p className="eyebrow">Admin Product Review</p>
        <h2>Product queue</h2>
        <label className="review-notes">
          Status filter
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as ProductLifecycleStatus | "all")}
          >
            <option value="all">All statuses</option>
            {productStatuses.map((status) => (
              <option key={status} value={status}>
                {productStatusLabels[status]}
              </option>
            ))}
          </select>
        </label>
        <ErrorList errors={errors} />
        {isLoading && <LoadingState message="Loading products..." />}
        {!isLoading && filteredProducts.length === 0 && <p>No products match this filter.</p>}
        <div className="review-list">
          {filteredProducts.map((product) => (
            <AdminProductReviewItem
              key={product.id}
              product={product}
              notes={reviewNotes[product.id] ?? product.review_notes ?? ""}
              isReviewing={isReviewing}
              onNotesChange={(value) =>
                setReviewNotes((current) => ({
                  ...current,
                  [product.id]: value,
                }))
              }
              onApplyReview={applyReview}
              authMode={authMode}
            />
          ))}
        </div>
      </section>
    </section>
  );
}

interface AdminProductReviewItemProps {
  product: ProductRecord;
  notes: string;
  isReviewing: string | null;
  authMode: "supabase" | "demo";
  onNotesChange: (value: string) => void;
  onApplyReview: (product: ProductRecord, status: ProductLifecycleStatus) => void;
}

function AdminProductReviewItem({
  product,
  notes,
  isReviewing,
  authMode,
  onNotesChange,
  onApplyReview,
}: AdminProductReviewItemProps) {
  const allowedStatuses = getAllowedAdminProductTransitions(product.status);

  return (
    <article className="review-item">
      <div>
        <p className="eyebrow">{productStatusLabels[product.status]}</p>
        <h3>{product.model_name ?? product.name}</h3>
        <p>{product.description || product.short_description || "No description provided."}</p>
        <p>Manufacturer: {product.manufacturer_id}</p>
      </div>
      <ProductStatusPanel product={product} />
      <label className="review-notes">
        Review notes
        <textarea value={notes} onChange={(event) => onNotesChange(event.target.value)} />
      </label>
      <div className="actions">
        {allowedStatuses.map((status) => (
          <button
            key={status}
            type="button"
            disabled={Boolean(isReviewing)}
            onClick={() => onApplyReview(product, status)}
          >
            {isReviewing === `${product.id}:${status}`
              ? "Saving..."
              : status === "draft"
                ? "Return to Draft"
                : productStatusLabels[status]}
          </button>
        ))}
        {allowedStatuses.length === 0 && <p>No lifecycle actions available.</p>}
      </div>
      <ProductMediaManager product={product} authMode={authMode} mode="admin" />
    </article>
  );
}
