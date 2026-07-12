import {
  createSignedDocumentUrl,
  deleteProductMedia,
  productDocumentBucket,
  productImageBucket,
  setPrimaryProductImage,
  updateProductMediaMetadata,
} from "../../lib/productMedia";
import type { ProductMediaRecord } from "../../types";

interface ProductMediaListProps {
  media: ProductMediaRecord[];
  isLocked: boolean;
  canViewPrivateDocuments: boolean;
  onChanged: (media: ProductMediaRecord) => void;
  onDeleted: (mediaId: string) => void;
  onError: (message: string) => void;
}

export function ProductMediaList({
  media,
  isLocked,
  canViewPrivateDocuments,
  onChanged,
  onDeleted,
  onError,
}: ProductMediaListProps) {
  async function setPrimary(mediaItem: ProductMediaRecord) {
    try {
      onChanged(await setPrimaryProductImage(mediaItem.product_id, mediaItem.id));
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to set primary image.");
    }
  }

  async function updateSort(mediaItem: ProductMediaRecord, sortOrder: number) {
    try {
      onChanged(await updateProductMediaMetadata(mediaItem.id, { sort_order: sortOrder }));
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to update sort order.");
    }
  }

  async function remove(mediaItem: ProductMediaRecord) {
    try {
      await deleteProductMedia(mediaItem);
      onDeleted(mediaItem.id);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to delete media.");
    }
  }

  async function openSignedDocument(mediaItem: ProductMediaRecord) {
    try {
      const url = await createSignedDocumentUrl(mediaItem);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to open document.");
    }
  }

  if (media.length === 0) {
    return <p>No product media yet.</p>;
  }

  return (
    <div className="media-list">
      {media.map((item) => (
        <article className="media-row" key={item.id}>
          <div>
            <p className="eyebrow">
              {item.media_type.replace(/_/g, " ")} · {item.visibility}
            </p>
            <h4>{item.title || item.original_filename || item.storage_path}</h4>
            <p>{item.storage_bucket === productImageBucket ? item.alt_text || "No alt text" : item.mime_type}</p>
            {item.is_primary && <p className="form-success">Primary media</p>}
          </div>
          <label>
            Sort
            <input
              type="number"
              min="0"
              value={item.sort_order}
              disabled={isLocked}
              onChange={(event) => void updateSort(item, Number(event.target.value))}
            />
          </label>
          <div className="actions">
            {item.storage_bucket === productImageBucket && (
              <button type="button" disabled={isLocked || item.is_primary} onClick={() => void setPrimary(item)}>
                Set Primary
              </button>
            )}
            {item.storage_bucket === productDocumentBucket && item.visibility === "private" && canViewPrivateDocuments && (
              <button type="button" onClick={() => void openSignedDocument(item)}>
                Signed URL
              </button>
            )}
            <button type="button" disabled={isLocked} onClick={() => void remove(item)}>
              Delete
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
