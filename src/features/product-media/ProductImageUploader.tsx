import { useState } from "react";
import {
  imageMediaTypes,
  productMediaVisibilities,
  uploadProductImage,
  validateProductMediaFile,
} from "../../lib/productMedia";
import type {
  ProductMediaRecord,
  ProductMediaType,
  ProductMediaVisibility,
  ProductRecord,
} from "../../types";

interface ProductImageUploaderProps {
  product: ProductRecord;
  isLocked: boolean;
  onUploaded: (media: ProductMediaRecord) => void;
  onError: (message: string) => void;
}

export function ProductImageUploader({
  product,
  isLocked,
  onUploaded,
  onError,
}: ProductImageUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<ProductMediaType>("exterior_image");
  const [visibility, setVisibility] = useState<ProductMediaVisibility>("public");
  const [title, setTitle] = useState("");
  const [altText, setAltText] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  async function upload() {
    if (!file) {
      onError("Choose an image before uploading.");
      return;
    }

    const validationErrors = validateProductMediaFile(file, mediaType);
    if (validationErrors.length > 0) {
      onError(validationErrors.join(" "));
      return;
    }

    setIsUploading(true);
    try {
      const media = await uploadProductImage({
        productId: product.id,
        manufacturerId: product.manufacturer_id,
        file,
        mediaType,
        title,
        altText,
        visibility,
      });
      setFile(null);
      setTitle("");
      setAltText("");
      onUploaded(media);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to upload image.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="media-uploader">
      <h4>Image upload</h4>
      <label>
        File
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
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
          {imageMediaTypes.map((item) => (
            <option key={item} value={item}>
              {item.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </label>
      <label>
        Visibility
        <select
          disabled={isLocked || isUploading}
          value={visibility}
          onChange={(event) => setVisibility(event.target.value as ProductMediaVisibility)}
        >
          {productMediaVisibilities.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label>
        Title
        <input disabled={isLocked || isUploading} value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label>
        Alt text
        <input disabled={isLocked || isUploading} value={altText} onChange={(event) => setAltText(event.target.value)} />
      </label>
      <button type="button" disabled={isLocked || isUploading} onClick={() => void upload()}>
        {isUploading ? "Uploading..." : "Upload Image"}
      </button>
    </section>
  );
}
