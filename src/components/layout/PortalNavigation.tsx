import { viewLabels } from "../../app/constants";
import type { View } from "../../types";

interface PortalNavigationProps {
  view: View;
  onViewChange: (view: View) => void;
}

export function PortalNavigation({ view, onViewChange }: PortalNavigationProps) {
  return (
    <nav className="nav-tabs" aria-label="Primary">
      {(Object.keys(viewLabels) as View[]).map((item) => (
        <button
          key={item}
          className={view === item ? "active" : ""}
          onClick={() => onViewChange(item)}
        >
          {viewLabels[item]}
        </button>
      ))}
    </nav>
  );
}
