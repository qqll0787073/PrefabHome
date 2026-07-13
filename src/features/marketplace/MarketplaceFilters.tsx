import type { MarketplaceFilterOptions, MarketplaceFilters } from "../../types";

interface MarketplaceFiltersProps {
  filters: MarketplaceFilters;
  options: MarketplaceFilterOptions;
  onChange: (filters: MarketplaceFilters) => void;
  onReset: () => void;
}

export function MarketplaceFilters({
  filters,
  options,
  onChange,
  onReset,
}: MarketplaceFiltersProps) {
  function update<K extends keyof MarketplaceFilters>(key: K, value: MarketplaceFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <aside className="filters marketplace-filters">
      <h3>Filters</h3>

      <label htmlFor="filter-category">Category</label>
      <select
        id="filter-category"
        value={filters.category}
        onChange={(event) => update("category", event.target.value)}
      >
        <option value="">All categories</option>
        {options.categories.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>

      <div className="filter-pair">
        <label htmlFor="filter-min-bedrooms">Min bedrooms</label>
        <input
          id="filter-min-bedrooms"
          type="number"
          min="0"
          value={filters.minBedrooms}
          onChange={(event) => update("minBedrooms", event.target.value)}
        />
      </div>

      <div className="filter-pair">
        <label htmlFor="filter-min-bathrooms">Min bathrooms</label>
        <input
          id="filter-min-bathrooms"
          type="number"
          min="0"
          step="0.5"
          value={filters.minBathrooms}
          onChange={(event) => update("minBathrooms", event.target.value)}
        />
      </div>

      <div className="filter-pair">
        <label htmlFor="filter-min-area">Min area</label>
        <input
          id="filter-min-area"
          type="number"
          min="0"
          value={filters.minFloorArea}
          onChange={(event) => update("minFloorArea", event.target.value)}
        />
      </div>

      <div className="filter-pair">
        <label htmlFor="filter-max-area">Max area</label>
        <input
          id="filter-max-area"
          type="number"
          min="0"
          value={filters.maxFloorArea}
          onChange={(event) => update("maxFloorArea", event.target.value)}
        />
      </div>

      <div className="filter-pair">
        <label htmlFor="filter-min-price">Min FOB price</label>
        <input
          id="filter-min-price"
          type="number"
          min="0"
          value={filters.minPrice}
          onChange={(event) => update("minPrice", event.target.value)}
        />
      </div>

      <div className="filter-pair">
        <label htmlFor="filter-max-price">Max FOB price</label>
        <input
          id="filter-max-price"
          type="number"
          min="0"
          value={filters.maxPrice}
          onChange={(event) => update("maxPrice", event.target.value)}
        />
      </div>

      <label htmlFor="filter-target-market">Target market</label>
      <select
        id="filter-target-market"
        value={filters.targetMarket}
        onChange={(event) => update("targetMarket", event.target.value)}
      >
        <option value="">Any market</option>
        {options.targetMarkets.map((targetMarket) => (
          <option key={targetMarket} value={targetMarket}>
            {targetMarket}
          </option>
        ))}
      </select>

      <label htmlFor="filter-certification">Certification</label>
      <select
        id="filter-certification"
        value={filters.certification}
        onChange={(event) => update("certification", event.target.value)}
      >
        <option value="">Any certification</option>
        {options.certifications.map((certification) => (
          <option key={certification} value={certification}>
            {certification}
          </option>
        ))}
      </select>

      <button type="button" onClick={onReset}>
        Reset filters
      </button>
    </aside>
  );
}
