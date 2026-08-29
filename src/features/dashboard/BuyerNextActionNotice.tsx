import type { BuyerNextAction } from "../../lib/buyerNextActions";

export function BuyerNextActionNotice({ action }: { action: BuyerNextAction | null }) {
  if (!action) return null;
  return <aside className="form-notice" aria-label="Buyer next action"><strong>{action.label}</strong><p>{action.description}</p>{action.href && <a href={action.href}>{action.actionNeeded ? "Continue" : "View status"}</a>}</aside>;
}
