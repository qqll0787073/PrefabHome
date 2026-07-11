import { useEffect, useMemo, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import {
  adminReviewProduct,
  adminReviewProductStatuses,
  fetchAllProductsForAdmin,
  productStatusLabels,
  productStatuses,
} from "../../lib/products";
import type { ProductLifecycleStatus, ProductRecord } from "../../types";
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
            <article className="review-item" key={product.id}>
              <div>
                <p className="eyebrow">{productStatusLabels[product.status]}</p>
                <h3>{product.model_name ?? product.name}</h3>
                <p>{product.description || product.short_description || "No description provided."}</p>
                <p>Manufacturer: {product.manufacturer_id}</p>
              </div>
              <ProductStatusPanel product={product} />
              <label className="review-notes">
                Review notes
                <textarea
                  value={reviewNotes[product.id] ?? product.review_notes ?? ""}
                  onChange={(event) =>
                    setReviewNotes((current) => ({
                      ...current,
                      [product.id]: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="actions">
                {adminReviewProductStatuses.map((status) => (
                  <button
                    key={status}
                    type="button"
                    disabled={Boolean(isReviewing)}
                    onClick={() => void applyReview(product, status)}
                  >
                    {isReviewing === `${product.id}:${status}`
                      ? "Saving..."
                      : status === "draft"
                        ? "Return to Draft"
                        : productStatusLabels[status]}
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
