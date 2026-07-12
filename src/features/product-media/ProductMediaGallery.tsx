import type { ProductMediaRecord } from "../../types";

interface ProductMediaGalleryProps {
  media: ProductMediaRecord[];
}

export function ProductMediaGallery({ media }: ProductMediaGalleryProps) {
  const images = media.filter((item) => item.storage_bucket === "product-images");

  if (images.length === 0) {
    return <p>No product images yet.</p>;
  }

  return (
    <div className="media-gallery">
      {images.map((item) => (
        <figure key={item.id}>
          <div className="media-thumb">
            {item.is_primary ? "Primary" : item.media_type.replace(/_/g, " ")}
          </div>
          <figcaption>{item.title || item.original_filename || item.storage_path}</figcaption>
        </figure>
      ))}
    </div>
  );
}
