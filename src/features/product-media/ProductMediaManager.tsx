import { useEffect, useMemo, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import {
  canEditProductMedia,
  fetchAllProductMediaForAdmin,
  fetchOwnProductMedia,
} from "../../lib/productMedia";
import type { ProductMediaRecord, ProductRecord } from "../../types";
import { ProductDocumentUploader } from "./ProductDocumentUploader";
import { ProductImageUploader } from "./ProductImageUploader";
import { ProductMediaGallery } from "./ProductMediaGallery";
import { ProductMediaList } from "./ProductMediaList";

interface ProductMediaManagerProps {
  product: ProductRecord;
  authMode: "supabase" | "demo";
  mode: "manufacturer" | "admin";
}

export function ProductMediaManager({ product, authMode, mode }: ProductMediaManagerProps) {
  const [media, setMedia] = useState<ProductMediaRecord[]>([]);
  const [isLoading, setIsLoading] = useState(authMode === "supabase");
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const isLocked = mode === "manufacturer" && !canEditProductMedia(product.status);
  const sortedMedia = useMemo(
    () =>
      [...media].sort(
        (a, b) =>
          a.sort_order - b.sort_order ||
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ),
    [media]
  );

  async function loadMedia() {
    setIsLoading(true);
    setErrors([]);

    try {
      if (authMode === "demo") {
        setMedia([]);
        return;
      }

      setMedia(
        mode === "admin"
          ? await fetchAllProductMediaForAdmin(product.id)
          : await fetchOwnProductMedia(product.id)
      );
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to load product media."]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadMedia();
  }, [authMode, mode, product.id]);

  function handleUploaded(mediaItem: ProductMediaRecord) {
    setMedia((current) => [mediaItem, ...current.filter((item) => item.id !== mediaItem.id)]);
    setMessage("Media uploaded.");
    setErrors([]);
  }

  function handleChanged(mediaItem: ProductMediaRecord) {
    setMedia((current) => current.map((item) => (item.id === mediaItem.id ? mediaItem : item)));
    setMessage("Media updated.");
    setErrors([]);
  }

  function handleDeleted(mediaId: string) {
    setMedia((current) => current.filter((item) => item.id !== mediaId));
    setMessage("Media deleted.");
    setErrors([]);
  }

  function handleError(error: string) {
    setErrors([error]);
    setMessage(null);
  }

  return (
    <section className="panel media-manager">
      <p className="eyebrow">Product Media</p>
      <h3>{product.model_name ?? product.name}</h3>
      {isLocked && (
        <p className="form-notice">
          Media is locked for manufacturers while this product is {product.status}.
        </p>
      )}
      <ErrorList errors={errors} />
      {message && <p className="form-success">{message}</p>}
      {isLoading && <LoadingState message="Loading product media..." />}
      {!isLoading && (
        <>
          <ProductMediaGallery media={sortedMedia} />
          <div className="media-upload-grid">
            <ProductImageUploader
              product={product}
              isLocked={isLocked}
              onUploaded={handleUploaded}
              onError={handleError}
            />
            <ProductDocumentUploader
              product={product}
              isLocked={isLocked}
              onUploaded={handleUploaded}
              onError={handleError}
            />
          </div>
          <ProductMediaList
            media={sortedMedia}
            isLocked={isLocked}
            canViewPrivateDocuments={mode === "admin"}
            onChanged={handleChanged}
            onDeleted={handleDeleted}
            onError={handleError}
          />
        </>
      )}
    </section>
  );
}
