import { roleLabels } from "../../app/constants";
import { AuthPanel } from "../auth/AuthPanel";
import { AdminManufacturerReview } from "../manufacturers/AdminManufacturerReview";
import { ManufacturerWorkspace } from "../manufacturers/ManufacturerWorkspace";
import { AdminProductReview } from "../products/AdminProductReview";
import { ManufacturerProductList } from "../products/ManufacturerProductList";
import { AdminRFQManagement } from "../rfqs/AdminRFQManagement";
import { BuyerRFQDashboard } from "../rfqs/BuyerRFQDashboard";
import { ManufacturerRFQInbox } from "../rfqs/ManufacturerRFQInbox";
import type { AuthState } from "../../lib/auth";
import type { Role } from "../../types";

interface PortalDashboardProps {
  auth: AuthState;
  role: Role;
  onRoleChange: (role: Role) => void;
}

export function PortalDashboard({
  auth,
  role,
  onRoleChange,
}: PortalDashboardProps) {
  const hasPortalAccess = Boolean(auth.user && auth.user.role === role);

  return (
    <>
      {!auth.user && (
        <AuthPanel
          activeRole={role}
          authError={auth.error}
          authMode={auth.mode}
          isLoading={auth.isLoading}
          onLogin={auth.login}
          onRegister={auth.register}
        />
      )}

      {auth.user && !hasPortalAccess && (
        <section className="panel access-panel">
          <p className="eyebrow">Protected Portal</p>
          <h2>Role access required</h2>
          <p>
            You are signed in as {roleLabels[auth.user.role]}. Switch back to that portal or
            log out before entering {roleLabels[role]}.
          </p>
          <button onClick={() => onRoleChange(auth.user?.role ?? "buyer")}>
            Go to my portal
          </button>
        </section>
      )}

      {hasPortalAccess && (
        <>
          <section className="dashboard-grid">
            <div className="panel">
              <p className="eyebrow">{roleLabels[role]}</p>
              <h2>
                {role === "buyer"
                  ? "Buyer workspace"
                  : role === "manufacturer"
                    ? "Factory workspace"
                    : "Admin operations"}
              </h2>
              <p>
                Signed in as {auth.user?.email}. Portal access is role-gated while the
                production implementation moves data into Supabase.
              </p>
            </div>
          </section>

          {role === "buyer" && auth.user && (
            <BuyerRFQDashboard user={auth.user} authMode={auth.mode} />
          )}

          {role === "manufacturer" && auth.user && (
            <>
              <ManufacturerRFQInbox user={auth.user} authMode={auth.mode} />
              <ManufacturerWorkspace user={auth.user} authMode={auth.mode} />
              <ManufacturerProductList user={auth.user} authMode={auth.mode} />
            </>
          )}

          {role === "admin" && auth.user && (
            <>
              <AdminRFQManagement user={auth.user} authMode={auth.mode} />
              <AdminManufacturerReview authMode={auth.mode} />
              <AdminProductReview authMode={auth.mode} />
            </>
          )}
        </>
      )}
    </>
  );
}
