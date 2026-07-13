interface MarketplacePaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function MarketplacePagination({
  page,
  totalPages,
  total,
  onPageChange,
}: MarketplacePaginationProps) {
  if (totalPages <= 1) {
    return <p className="marketplace-count">{total} published products</p>;
  }

  return (
    <nav className="marketplace-pagination" aria-label="Marketplace pagination">
      <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        Previous
      </button>
      <span>
        Page {page} of {totalPages} ({total} products)
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}
