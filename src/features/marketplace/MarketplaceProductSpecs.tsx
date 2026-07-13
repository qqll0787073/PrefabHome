import type { MarketplaceProduct } from "../../types";

interface MarketplaceProductSpecsProps {
  product: MarketplaceProduct;
}

export function MarketplaceProductSpecs({ product }: MarketplaceProductSpecsProps) {
  const specs = [
    ["Floor area", formatNumber(product.floor_area_sq_ft, "sq ft")],
    ["Bedrooms", formatPlain(product.bedrooms)],
    ["Bathrooms", formatPlain(product.bathrooms)],
    ["Stories", formatPlain(product.stories)],
    ["Dimensions", formatDimensions(product)],
    ["Structure", product.structure_material],
    ["Exterior finish", product.exterior_finish],
    ["Roof type", product.roof_type],
    ["Insulation", product.insulation],
    ["Electrical", product.electrical_standard],
    ["Plumbing", product.plumbing_standard],
    ["Wind rating", product.wind_rating],
    ["Snow load", formatNumber(product.snow_load_psf, "psf")],
    ["MOQ", formatNumber(product.minimum_order_quantity, "units")],
    ["Lead time", formatNumber(product.production_lead_time_weeks, "weeks")],
    ["Port of loading", product.port_of_loading],
    ["HS code", product.hs_code],
  ].filter(([, value]) => value);

  return (
    <dl className="marketplace-specs">
      {specs.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function formatPlain(value: number | null): string | null {
  return value === null ? null : value.toLocaleString();
}

function formatNumber(value: number | null, suffix: string): string | null {
  return value === null ? null : `${value.toLocaleString()} ${suffix}`;
}

function formatDimensions(product: MarketplaceProduct): string | null {
  const dimensions = [product.length_ft, product.width_ft, product.height_ft];
  if (dimensions.every((value) => value === null)) return null;
  return dimensions.map((value) => (value === null ? "n/a" : `${value} ft`)).join(" x ");
}
