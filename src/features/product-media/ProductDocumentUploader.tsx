import { useState } from "react";
import {
  documentMediaTypes,
  uploadProductDocument,
  validateProductMediaFile,
} from "../../lib/productMedia";
import type { ProductMediaRecord, ProductMediaType, ProductRecord } from "../../types";

interface ProductDocumentUploaderProps {
  product: ProductRecord;
  isLocked: boolean;
  onUploaded: (media: ProductMediaRecord) => void;
  onError: (message: string) => void;
}

export function ProductDocumentUploader({
  product,
  isLocked,
  onUploaded,
  onError,
}: ProductDocumentUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<ProductMediaType>("specification_sheet");
  const [title, setTitle] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  async function upload() {
    if (!file) {
      onError("Choose a PDF before uploading.");
      return;
    }

    const validationErrors = validateProductMediaFile(file, mediaType);
    if (validationErrors.length > 0) {
      onError(validationErrors.join(" "));
      return;
    }

    setIsUploading(true);
    try {
      const media = await uploadProductDocument({
        productId: product.id,
        manufacturerId: product.manufacturer_id,
        file,
        mediaType,
        title,
        visibility: "private",
      });
      setFile(null);
      setTitle("");
      onUploaded(media);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to upload document.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="media-uploader">
      <h4>Document upload</h4>
      <label>
        File
        <input
          type="file"
          accept="application/pdf"
          disabled={isLocked || isUploading}
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </label>
      <label>
        Type
        <select
          disabled={isLocked || isUploading}
          value={mediaType}
          onChange={(event) => setMediaType(event.target.value as ProductMediaType)}
        >
          {documentMediaTypes.map((item) => (
            <option key={item} value={item}>
              {item.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </label>
      <label>
        Title
        <input disabled={isLocked || isUploading} value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <button type="button" disabled={isLocked || isUploading} onClick={() => void upload()}>
        {isUploading ? "Uploading..." : "Upload Document"}
      </button>
    </section>
  );
}
