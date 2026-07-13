import type { MarketplaceProduct, MarketplaceProductImage } from "../../types";

interface MarketplaceImageGalleryProps {
  product: MarketplaceProduct;
  images: MarketplaceProductImage[];
}

export function MarketplaceImageGallery({ product, images }: MarketplaceImageGalleryProps) {
  const visibleImages = images.filter((image) => image.signed_url);

  if (visibleImages.length === 0) {
    return (
      <div
        className="marketplace-detail-placeholder"
        role="img"
        aria-label={`${product.model_name || product.name} image unavailable`}
      >
        Image pending
      </div>
    );
  }

  return (
    <div className="marketplace-gallery">
      {visibleImages.map((image) => (
        <img
          key={image.id}
          src={image.signed_url ?? ""}
          alt={image.alt_text || image.title || product.model_name || product.name}
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ))}
    </div>
  );
}
