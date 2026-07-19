import type { MarketplaceProduct } from "../../types";

interface MarketplaceProductCardProps {
  product: MarketplaceProduct;
  priority?: boolean;
  onSelect: (product: MarketplaceProduct) => void;
}

export function MarketplaceProductCard({ product, priority = false, onSelect }: MarketplaceProductCardProps) {
  const title = product.model_name || product.name;
  const imageAlt = product.primary_image?.alt_text || title;

  return (
    <article className="product-card marketplace-product-card">
      {product.image_url ? (
        <img
          src={product.image_url}
          alt={imageAlt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <div className="marketplace-image-placeholder" role="img" aria-label={`${title} image unavailable`}>
          Image pending
        </div>
      )}
      <div className="product-body">
        <p className="eyebrow">{product.category}</p>
        <h3>{title}</h3>
        <p>{product.short_description || product.description || "Published prefab home model."}</p>
        <p className="manufacturer-line">{product.manufacturer_display_name}</p>
        {product.manufacturer_country && <p>{product.manufacturer_country}</p>}
        <div className="meta-row">
          <span>{formatOptionalCurrency(product.fob_price, product.currency)}</span>
          <span>{formatOptionalNumber(product.floor_area_sq_ft, "sq ft")}</span>
          <span>{formatOptionalNumber(product.production_lead_time_weeks, "weeks")}</span>
        </div>
        <div className="meta-row">
          <span>{formatRooms(product.bedrooms, "bed")}</span>
          <span>{formatRooms(product.bathrooms, "bath")}</span>
        </div>
        <div className="tag-row">
          {product.tags.slice(0, 3).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        <div className="actions">
          <button type="button" onClick={() => onSelect(product)}>
            Details
          </button>
        </div>
      </div>
    </article>
  );
}

function formatOptionalCurrency(value: number | null, currency: string): string {
  if (value === null) return "Price on request";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatOptionalNumber(value: number | null, suffix: string): string {
  return value === null ? "Not listed" : `${value.toLocaleString()} ${suffix}`;
}

function formatRooms(value: number | null, label: string): string {
  return value === null ? `${label} n/a` : `${value} ${label}`;
}
