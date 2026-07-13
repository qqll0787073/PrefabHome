interface MarketplaceEmptyStateProps {
  onReset: () => void;
}

export function MarketplaceEmptyState({ onReset }: MarketplaceEmptyStateProps) {
  return (
    <section className="panel marketplace-state">
      <h3>No published products matched</h3>
      <p>
        Try broadening the search or clearing filters. Only approved manufacturer products
        that are published are shown here.
      </p>
      <button type="button" onClick={onReset}>
        Reset filters
      </button>
    </section>
  );
}
