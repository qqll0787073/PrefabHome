interface MarketplaceErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function MarketplaceErrorState({ message, onRetry }: MarketplaceErrorStateProps) {
  return (
    <section className="panel marketplace-state" role="alert">
      <h3>Marketplace could not load</h3>
      <p>{message}</p>
      <button type="button" onClick={onRetry}>
        Retry
      </button>
    </section>
  );
}
