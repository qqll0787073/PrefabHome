import { useEffect, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import { fetchOwnManufacturerApplication } from "../../lib/manufacturers";
import {
  createProductDraft,
  emptyProductForm,
  fetchOwnProducts,
  manufacturerEditableProductStatuses,
  manufacturerSubmittableProductStatuses,
  productFormFromRecord,
  productStatusLabels,
  submitProduct,
  updateProductDraft,
  validateProductDraft,
  validateProductForSubmit,
} from "../../lib/products";
import type { AuthUser } from "../../lib/auth";
import type { ManufacturerApplication, ProductFormValues, ProductRecord } from "../../types";
import { ManufacturerProductForm } from "./ManufacturerProductForm";
import { ProductStatusPanel } from "./ProductStatusPanel";

interface ManufacturerProductListProps {
  user: AuthUser;
  authMode: "supabase" | "demo";
}

export function ManufacturerProductList({ user, authMode }: ManufacturerProductListProps) {
  const [manufacturer, setManufacturer] = useState<ManufacturerApplication | null>(null);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductRecord | null>(null);
  const [values, setValues] = useState<ProductFormValues>(() => emptyProductForm());
  const [isLoading, setIsLoading] = useState(authMode === "supabase");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  async function loadProducts() {
    setIsLoading(true);
    setErrors([]);

    try {
      if (authMode === "demo") {
        setProducts([]);
        setManufacturer(null);
        return;
      }

      const [ownManufacturer, ownProducts] = await Promise.all([
        fetchOwnManufacturerApplication(user.id),
        fetchOwnProducts(user.id),
      ]);
      setManufacturer(ownManufacturer);
      setProducts(ownProducts);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to load products."]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts();
  }, [authMode, user.id]);

  const isManufacturerApproved = manufacturer?.application_status === "approved";
  const isEditable =
    !selectedProduct || manufacturerEditableProductStatuses.includes(selectedProduct.status);
  const canSubmit =
    !selectedProduct || manufacturerSubmittableProductStatuses.includes(selectedProduct.status);

  function updateField(field: keyof ProductFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function startNewProduct() {
    setSelectedProduct(null);
    setValues(emptyProductForm());
    setMessage(null);
    setErrors([]);
  }

  function selectProduct(product: ProductRecord) {
    setSelectedProduct(product);
    setValues(productFormFromRecord(product));
    setMessage(null);
    setErrors([]);
  }

  async function saveProduct(action: "draft" | "submit") {
    const isSubmit = action === "submit";
    const validationErrors = isSubmit ? validateProductForSubmit(values) : validateProductDraft(values);
    setErrors(validationErrors);
    setMessage(null);

    if (validationErrors.length > 0) return;

    if (!manufacturer || !isManufacturerApproved) {
      setErrors(["Only approved manufacturers can create or submit products."]);
      return;
    }

    setIsSaving(true);

    try {
      if (authMode === "demo") {
        setMessage(isSubmit ? "Demo product submitted." : "Demo product draft saved.");
        return;
      }

      const savedProduct = selectedProduct
        ? isSubmit
          ? await submitProduct(selectedProduct.id, values)
          : await updateProductDraft(selectedProduct.id, values)
        : await createProductDraft(manufacturer.id, values, isSubmit ? "submitted" : "draft");

      setSelectedProduct(savedProduct);
      setValues(productFormFromRecord(savedProduct));
      await loadProducts();
      setMessage(isSubmit ? "Product submitted for admin review." : "Product draft saved.");
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to save product."]);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="workspace-section">
      <section className="panel">
        <p className="eyebrow">Product Database</p>
        <h2>Manufacturer products</h2>
        {!isManufacturerApproved && (
          <p className="form-notice">
            Product creation is locked until the manufacturer application is approved.
          </p>
        )}
        {isLoading && <LoadingState message="Loading products..." />}
        <ErrorList errors={errors} />
        {message && <p className="form-success">{message}</p>}

        <div className="actions">
          <button type="button" onClick={startNewProduct}>
            New Product Draft
          </button>
        </div>

        {products.length === 0 && !isLoading && (
          <p>No products yet. Approved manufacturers can start with a draft.</p>
        )}

        <div className="review-list">
          {products.map((product) => (
            <article className="review-item" key={product.id}>
              <div>
                <p className="eyebrow">{productStatusLabels[product.status]}</p>
                <h3>{product.model_name ?? product.name}</h3>
                <p>{product.description || product.short_description || "No description provided."}</p>
              </div>
              <ProductStatusPanel product={product} />
              <div className="actions">
                <button type="button" onClick={() => selectProduct(product)}>
                  Manage
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">
          {selectedProduct ? productStatusLabels[selectedProduct.status] : "Draft"}
        </p>
        <h2>{selectedProduct ? "Product details" : "New product draft"}</h2>
        {selectedProduct && !isEditable && (
          <p className="form-notice">
            This product is locked. Manufacturers can edit only draft or rejected products.
          </p>
        )}
        <ManufacturerProductForm
          values={values}
          isEditable={isEditable && isManufacturerApproved}
          onFieldChange={updateField}
        />
        <div className="actions">
          {isEditable && (
            <button
              type="button"
              disabled={isSaving || !isManufacturerApproved}
              onClick={() => void saveProduct("draft")}
            >
              Save Draft
            </button>
          )}
          {canSubmit && (
            <button
              type="button"
              disabled={isSaving || !isManufacturerApproved}
              onClick={() => void saveProduct("submit")}
            >
              {isSaving ? "Saving..." : "Submit Product"}
            </button>
          )}
        </div>
      </section>
    </section>
  );
}
