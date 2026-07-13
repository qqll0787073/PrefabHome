import { useEffect, useState } from "react";
import { fetchMarketplaceProductImages, marketplaceProductLocation } from "../../lib/marketplace";
import type { MarketplaceProduct, MarketplaceProductImage } from "../../types";
import { MarketplaceImageGallery } from "./MarketplaceImageGallery";
import { MarketplaceProductSpecs } from "./MarketplaceProductSpecs";

interface MarketplaceProductDetailProps {
  product: MarketplaceProduct;
  onBack: () => void;
}

export function MarketplaceProductDetail({ product, onBack }: MarketplaceProductDetailProps) {
  const [images, setImages] = useState<MarketplaceProductImage[]>(
    product.primary_image ? [product.primary_image] : []
  );
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [imageError, setImageError] = useState("");

  useEffect(() => {
    let isMounted = true;
    setIsLoadingImages(true);
    setImageError("");
    fetchMarketplaceProductImages(product.id)
      .then((items) => {
        if (!isMounted) return;
        setImages(items.length > 0 ? items : product.primary_image ? [product.primary_image] : []);
      })
      .catch((error) => {
        if (!isMounted) return;
        setImageError(error instanceof Error ? error.message : "Images could not be loaded.");
        setImages(product.primary_image ? [product.primary_image] : []);
      })
      .finally(() => {
        if (isMounted) setIsLoadingImages(false);
      });

    return () => {
      isMounted = false;
    };
  }, [product]);

  const title = product.model_name || product.name;
  const location = marketplaceProductLocation(product);

  return (
    <section className="panel marketplace-detail">
      <button type="button" className="close-button" onClick={onBack}>
        Back to marketplace
      </button>
      <div className="marketplace-detail-layout">
        <div>
          {isLoadingImages && <p aria-live="polite">Loading images...</p>}
          {imageError && <p role="alert">{imageError}</p>}
          <MarketplaceImageGallery product={product} images={images} />
        </div>
        <div className="marketplace-detail-copy">
          <p className="eyebrow">{product.category}</p>
          <h2>{title}</h2>
          <p>{product.description || product.short_description || "Published prefab home model."}</p>
          <div className="meta-row">
            <span>{formatCurrency(product.fob_price, product.currency)}</span>
            <span>{product.floor_area_sq_ft ? `${product.floor_area_sq_ft} sq ft` : "Area n/a"}</span>
            <span>
              {product.production_lead_time_weeks
                ? `${product.production_lead_time_weeks} weeks`
                : "Lead time n/a"}
            </span>
          </div>
          <div>
            <h3>Manufacturer</h3>
            <p>{product.manufacturer_display_name}</p>
            {location && <p>{location}</p>}
            {product.manufacturer_website && (
              <a href={product.manufacturer_website} rel="noreferrer" target="_blank">
                Manufacturer website
              </a>
            )}
          </div>
          <MarketplaceProductSpecs product={product} />
          <div className="tag-row">
            {[...product.tags, ...product.certifications, ...product.target_markets].map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function formatCurrency(value: number | null, currency: string): string {
  if (value === null) return "Price on request";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
