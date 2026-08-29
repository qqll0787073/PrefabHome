import { lazy } from "react";
import type { Role } from "../../types";
import type { PortalWorkspace } from "../../lib/portalNavigation";
import type { AuthUser } from "../../lib/auth";
import { BuyerOverview } from "./BuyerOverview";

const AdminOverview = lazy(() => import("./AdminOverview").then((module) => ({ default: module.AdminOverview })));

interface PortalOverviewProps {
  role: Role;
  user: AuthUser;
  onWorkspaceChange: (workspace: PortalWorkspace) => void;
  authMode: "supabase" | "demo";
}

export function PortalOverview({ role, user, onWorkspaceChange, authMode }: PortalOverviewProps) {
  if (role === "buyer") return <BuyerOverview user={user} />;
  if (role === "manufacturer") return <BuyerOverview user={user} variant="manufacturer" />;
  return <AdminOverview authMode={authMode} onWorkspaceChange={onWorkspaceChange} />;
}
