interface MarketplaceSearchProps {
  value: string;
  onChange: (value: string) => void;
  onAdvisorClick: () => void;
}

export function MarketplaceSearch({ value, onChange, onAdvisorClick }: MarketplaceSearchProps) {
  return (
    <div className="search-panel">
      <label htmlFor="listing-search">Search models</label>
      <input
        id="listing-search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search models, categories, descriptions..."
      />
      <button type="button" onClick={onAdvisorClick}>
        Ask AI Advisor
      </button>
    </div>
  );
}
