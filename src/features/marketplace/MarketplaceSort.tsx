import { marketplaceSortLabels } from "../../lib/marketplace";
import type { MarketplaceSort as MarketplaceSortValue } from "../../types";

interface MarketplaceSortProps {
  value: MarketplaceSortValue;
  onChange: (value: MarketplaceSortValue) => void;
}

export function MarketplaceSort({ value, onChange }: MarketplaceSortProps) {
  return (
    <label className="marketplace-sort" htmlFor="marketplace-sort">
      Sort
      <select
        id="marketplace-sort"
        value={value}
        onChange={(event) => onChange(event.target.value as MarketplaceSortValue)}
      >
        {(Object.keys(marketplaceSortLabels) as MarketplaceSortValue[]).map((sort) => (
          <option key={sort} value={sort}>
            {marketplaceSortLabels[sort]}
          </option>
        ))}
      </select>
    </label>
  );
}
