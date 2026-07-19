import { useEffect, useState } from "react";
import { createSignedImageUrl } from "../../lib/productMedia";
import type { ProductMediaRecord } from "../../types";

interface ProductMediaGalleryProps {
  media: ProductMediaRecord[];
}

export function ProductMediaGallery({ media }: ProductMediaGalleryProps) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const images = media.filter((item) => item.storage_bucket === "product-images");

  useEffect(() => {
    let isCurrent = true;

    async function loadSignedUrls() {
      const entries = await Promise.all(
        images.map(async (item) => {
          try {
            return [item.id, await createSignedImageUrl(item)] as const;
          } catch {
            return [item.id, ""] as const;
          }
        })
      );

      if (isCurrent) {
        setSignedUrls(Object.fromEntries(entries));
      }
    }

    void loadSignedUrls();

    return () => {
      isCurrent = false;
    };
  }, [images.map((item) => `${item.id}:${item.storage_path}`).join("|")]);

  if (images.length === 0) {
    return <p>No product images yet.</p>;
  }

  return (
    <div className="media-gallery">
      {images.map((item) => (
        <figure key={item.id}>
          {signedUrls[item.id] ? (
            <img
              src={signedUrls[item.id]}
              alt={item.alt_text || item.title || "Product media"}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="media-thumb">
              {item.is_primary ? "Primary" : item.media_type.replace(/_/g, " ")}
            </div>
          )}
          <figcaption>{item.title || item.original_filename || item.storage_path}</figcaption>
        </figure>
      ))}
    </div>
  );
}
