import type { Product } from "../../types";
import { formatCurrency } from "../../lib/format";

interface CompareViewProps {
  comparedProducts: Product[];
  onToggleCompare: (productId: string) => void;
}

export function CompareView({ comparedProducts, onToggleCompare }: CompareViewProps) {
  return (
    <section className="panel">
      <h2>Compare Models</h2>
      <div className="comparison-table">
        {comparedProducts.map((product) => (
          <article key={product.id}>
            <h3>{product.name}</h3>
            <p>{formatCurrency(product.price)}</p>
            <p>{product.sizeSqFt} sq ft</p>
            <p>{product.leadTimeWeeks} week lead time</p>
            <button onClick={() => onToggleCompare(product.id)}>Remove</button>
          </article>
        ))}
      </div>
    </section>
  );
}
