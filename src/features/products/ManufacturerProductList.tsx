import { useEffect, useMemo, useRef, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import { fetchOwnManufacturerAccount } from "../../lib/manufacturers";
import {
  createProductDraft,
  emptyProductForm,
  fetchOwnProducts,
  manufacturerEditableProductStatuses,
  manufacturerSubmittableProductStatuses,
  productFormFromRecord,
  productStatuses,
  productStatusLabels,
  selectManufacturerProducts,
  submitProduct,
  updateProductDraft,
  validateProductDraft,
  validateProductForSubmit,
  type ManufacturerProductSort,
} from "../../lib/products";
import type { AuthUser } from "../../lib/auth";
import type { ManufacturerApplication, ProductFormValues, ProductLifecycleStatus, ProductRecord } from "../../types";
import { ProductMediaManager } from "../product-media/ProductMediaManager";
import { ManufacturerProductForm } from "./ManufacturerProductForm";
import { ProductStatusPanel } from "./ProductStatusPanel";

interface ManufacturerProductListProps {
  user: AuthUser;
  authMode: "supabase" | "demo";
  selectedProductId?: string | null;
  onSelectedProductChange?: (productId: string | null) => void;
}

export function ManufacturerProductList({ user, authMode, selectedProductId = null, onSelectedProductChange = () => {} }: ManufacturerProductListProps) {
  const [manufacturer, setManufacturer] = useState<ManufacturerApplication | null>(null);
  const [canManageProducts, setCanManageProducts] = useState(false);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductRecord | null>(null);
  const [values, setValues] = useState<ProductFormValues>(() => emptyProductForm());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProductLifecycleStatus | "all">("all");
  const [sort, setSort] = useState<ManufacturerProductSort>("updated");
  const [isLoading, setIsLoading] = useState(authMode === "supabase");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const generation = useRef(0);
  const saving = useRef(false);
  const identity = useRef(user.id);
  identity.current = user.id;

  async function loadProducts() {
    const request = ++generation.current;
    const requestedIdentity = user.id;
    setIsLoading(true);
    setErrors([]);
    try {
      if (authMode === "demo") {
        setProducts([]);
        setManufacturer(null);
        setCanManageProducts(false);
        return;
      }
      const account = await fetchOwnManufacturerAccount();
      if (request !== generation.current || identity.current !== requestedIdentity) return;
      if (account.profile_id !== requestedIdentity) throw new Error("Manufacturer identity changed. Please try again.");
      setManufacturer(account.manufacturer);
      const isAuthorized = account.profile_status === "active" && account.manufacturer?.application_status === "approved";
      setCanManageProducts(isAuthorized);
      if (!isAuthorized) {
        setProducts([]);
        return;
      }
      const ownProducts = await fetchOwnProducts(requestedIdentity);
      if (request !== generation.current || identity.current !== requestedIdentity) return;
      setProducts(ownProducts);
    } catch (error) {
      if (request === generation.current) setErrors([error instanceof Error ? error.message : "Unable to load Products."]);
    } finally {
      if (request === generation.current) setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts();
    return () => { generation.current += 1; };
  }, [authMode, user.id]);

  useEffect(() => {
    if (!selectedProductId) return;
    const product = products.find((item) => item.id === selectedProductId);
    if (product) selectProduct(product, false);
    else if (!isLoading) setErrors(["Product unavailable."]);
  }, [selectedProductId, products, isLoading]);

  const visibleProducts = useMemo(
    () => selectManufacturerProducts(products, search, statusFilter, sort),
    [products, search, statusFilter, sort],
  );
  const isEditable = !selectedProduct || manufacturerEditableProductStatuses.includes(selectedProduct.status);
  const canSubmit = !selectedProduct || manufacturerSubmittableProductStatuses.includes(selectedProduct.status);

  function updateField(field: keyof ProductFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function startNewProduct() {
    setSelectedProduct(null);
    setValues(emptyProductForm());
    setMessage(null);
    setErrors([]);
    onSelectedProductChange(null);
  }

  function selectProduct(product: ProductRecord, updateRoute = true) {
    setSelectedProduct(product);
    setValues(productFormFromRecord(product));
    setMessage(null);
    setErrors([]);
    if (updateRoute) onSelectedProductChange(product.id);
  }

  async function saveProduct(action: "draft" | "submit") {
    if (saving.current) return;
    const isSubmit = action === "submit";
    const validationErrors = isSubmit ? validateProductForSubmit(values) : validateProductDraft(values);
    setErrors(validationErrors);
    setMessage(null);
    if (validationErrors.length || !manufacturer || !canManageProducts) {
      if (!validationErrors.length) setErrors(["Only approved manufacturers can manage Products."]);
      return;
    }
    saving.current = true;
    setIsSaving(true);
    const request = generation.current;
    const requestedIdentity = user.id;
    try {
      if (authMode === "demo") {
        setMessage(isSubmit ? "Demo Product submitted." : "Demo Product draft saved.");
        return;
      }
      const saved = selectedProduct
        ? isSubmit ? await submitProduct(selectedProduct.id, values) : await updateProductDraft(selectedProduct.id, values)
        : await createProductDraft(manufacturer.id, values, isSubmit ? "submitted" : "draft");
      if (request !== generation.current || identity.current !== requestedIdentity) return;
      setSelectedProduct(saved);
      setValues(productFormFromRecord(saved));
      setProducts((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      onSelectedProductChange(saved.id);
      setMessage(isSubmit ? "Product submitted for Admin review." : "Product draft saved.");
    } catch (error) {
      if (request === generation.current) setErrors([error instanceof Error ? error.message : "Unable to save Product."]);
    } finally {
      saving.current = false;
      if (request === generation.current) setIsSaving(false);
    }
  }

  return <section className="workspace-section" aria-labelledby="manufacturer-products-heading">
    <section className="panel">
      <p className="eyebrow">Product Database</p>
      <h2 id="manufacturer-products-heading">Manufacturer Products</h2>
      {!canManageProducts && <p className="form-notice" role="status">Product management requires an active, approved Manufacturer account.</p>}
      <div className="workspace-toolbar">
        <label>Search Products<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <label>Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ProductLifecycleStatus | "all")}><option value="all">All statuses</option>{productStatuses.map((status) => <option key={status} value={status}>{productStatusLabels[status]}</option>)}</select></label>
        <label>Sort<select value={sort} onChange={(event) => setSort(event.target.value as ManufacturerProductSort)}><option value="updated">Recently updated</option><option value="created">Newest created</option><option value="name">Name A–Z</option></select></label>
        <button type="button" disabled={!canManageProducts} onClick={startNewProduct}>Create Product</button>
      </div>
      {isLoading && <LoadingState message="Loading Products..." />}
      <ErrorList errors={errors} />
      {message && <p className="form-success" role="status">{message}</p>}
      {errors.length > 0 && !isLoading && <button type="button" onClick={() => void loadProducts()}>Retry</button>}
      {!isLoading && canManageProducts && products.length === 0 && <p>No Products yet. Create a draft to get started.</p>}
      {!isLoading && products.length > 0 && visibleProducts.length === 0 && <p role="status">No Products match your search and status filters.</p>}
      <div className="review-list" role="list">{visibleProducts.map((product) => <article className="review-item" role="listitem" key={product.id}>
        <div><p className="eyebrow">{productStatusLabels[product.status]}</p><h3>{product.model_name ?? product.name}</h3><p>{product.category}</p><p>Updated {new Date(product.updated_at).toLocaleDateString()}</p></div>
        <ProductStatusPanel product={product} />
        <div className="actions"><a href={`/marketplace?view=dashboard&workspace=products&record=${encodeURIComponent(product.id)}`} onClick={(event) => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); selectProduct(product); } }}>Manage Product</a>{product.status === "published" && product.slug && <a href={`/products/${encodeURIComponent(product.slug)}`}>View in Marketplace</a>}</div>
      </article>)}</div>
    </section>

    <section className="panel">
      <p className="eyebrow">{selectedProduct ? productStatusLabels[selectedProduct.status] : "Draft"}</p>
      <h2>{selectedProduct ? "Product details" : "New Product draft"}</h2>
      {selectedProduct && !isEditable && <p className="form-notice" role="status">This Product is read-only while {productStatusLabels[selectedProduct.status].toLowerCase()}.</p>}
      <ManufacturerProductForm values={values} isEditable={isEditable && canManageProducts} onFieldChange={updateField} />
      <div className="actions">{isEditable && <button type="button" disabled={isSaving || !canManageProducts} onClick={() => void saveProduct("draft")}>{isSaving ? "Saving..." : "Save Draft"}</button>}{canSubmit && <button type="button" disabled={isSaving || !canManageProducts} onClick={() => void saveProduct("submit")}>{isSaving ? "Saving..." : "Submit for Review"}</button>}</div>
    </section>
    {selectedProduct && <ProductMediaManager key={selectedProduct.id} product={selectedProduct} authMode={authMode} mode="manufacturer" />}
  </section>;
}
