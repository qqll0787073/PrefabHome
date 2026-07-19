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
      {visibleImages.map((image, index) => (
        <img
          key={image.id}
          src={image.signed_url ?? ""}
          alt={image.alt_text || image.title || product.model_name || product.name}
          loading={index === 0 ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={index === 0 ? "high" : "auto"}
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ))}
    </div>
  );
}
