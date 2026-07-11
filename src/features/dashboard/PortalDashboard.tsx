import { roleLabels } from "../../app/constants";
import { AuthPanel } from "../auth/AuthPanel";
import { AdminManufacturerReview } from "../manufacturers/AdminManufacturerReview";
import { ManufacturerWorkspace } from "../manufacturers/ManufacturerWorkspace";
import { AdminProductReview } from "../products/AdminProductReview";
import { ManufacturerProductList } from "../products/ManufacturerProductList";
import type { AuthState } from "../../lib/auth";
import type { Message, QuoteRequest, Role } from "../../types";

interface PortalDashboardProps {
  auth: AuthState;
  role: Role;
  quoteRequests: QuoteRequest[];
  messages: Message[];
  onRoleChange: (role: Role) => void;
}

export function PortalDashboard({
  auth,
  role,
  quoteRequests,
  messages,
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
            <div className="panel">
              <h3>Quote Requests</h3>
              {quoteRequests.map((quote) => (
                <div className="list-item" key={quote.id}>
                  <strong>{quote.productName}</strong>
                  <span>{quote.status}</span>
                </div>
              ))}
            </div>
            <div className="panel">
              <h3>Messaging</h3>
              {messages.map((message) => (
                <div className="message" key={message.id}>
                  <strong>{message.from}</strong>
                  <p>{message.body}</p>
                </div>
              ))}
            </div>
          </section>

          {role === "manufacturer" && auth.user && (
            <>
              <ManufacturerWorkspace user={auth.user} authMode={auth.mode} />
              <ManufacturerProductList user={auth.user} authMode={auth.mode} />
            </>
          )}

          {role === "admin" && auth.user && (
            <>
              <AdminManufacturerReview authMode={auth.mode} />
              <AdminProductReview authMode={auth.mode} />
            </>
          )}
        </>
      )}
    </>
  );
}
