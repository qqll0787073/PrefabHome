import type { Product } from "../../types";

interface ProductDetailsPanelProps {
  product: Product;
  onClose: () => void;
}

export function ProductDetailsPanel({ product, onClose }: ProductDetailsPanelProps) {
  return (
    <aside className="details-panel">
      <button className="close-button" onClick={onClose}>
        Close
      </button>
      <h2>{product.name}</h2>
      <p>{product.manufacturer}</p>
      <p>{product.location}</p>
      <ul>
        {product.compliance.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <button>Request Quote</button>
    </aside>
  );
}
