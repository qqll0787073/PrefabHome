import { lazy, Suspense, useState } from "react";
import { roleLabels } from "../../app/constants";
import { LoadingState } from "../../components/common/LoadingState";
import { AuthPanel } from "../auth/AuthPanel";
import { portalWorkspaceDefinition, type PortalWorkspace } from "../../lib/portalNavigation";
import type { AuthState } from "../../lib/auth";
import type { Role } from "../../types";
import { PortalOverview } from "./PortalOverview";
import { PortalWorkspaceNavigation } from "./PortalWorkspaceNavigation";

const BuyerRFQDashboard = lazy(() => import("../rfqs/BuyerRFQDashboard").then((module) => ({ default: module.BuyerRFQDashboard })));
const ManufacturerRFQInbox = lazy(() => import("../rfqs/ManufacturerRFQInbox").then((module) => ({ default: module.ManufacturerRFQInbox })));
const AdminRFQManagement = lazy(() => import("../rfqs/AdminRFQManagement").then((module) => ({ default: module.AdminRFQManagement })));
const BuyerPurchaseOrders = lazy(() => import("../purchase-orders/BuyerPurchaseOrders").then((module) => ({ default: module.BuyerPurchaseOrders })));
const ManufacturerPurchaseOrders = lazy(() => import("../purchase-orders/ManufacturerPurchaseOrders").then((module) => ({ default: module.ManufacturerPurchaseOrders })));
const AdminPurchaseOrderManagement = lazy(() => import("../purchase-orders/AdminPurchaseOrderManagement").then((module) => ({ default: module.AdminPurchaseOrderManagement })));
const BuyerContracts = lazy(() => import("../contracts/BuyerContracts").then((module) => ({ default: module.BuyerContracts })));
const ManufacturerContracts = lazy(() => import("../contracts/ManufacturerContracts").then((module) => ({ default: module.ManufacturerContracts })));
const AdminContractManagement = lazy(() => import("../contracts/AdminContractManagement").then((module) => ({ default: module.AdminContractManagement })));
const BuyerSignaturePreparation = lazy(() => import("../signatures/BuyerSignaturePreparation").then((module) => ({ default: module.BuyerSignaturePreparation })));
const ManufacturerSignaturePreparation = lazy(() => import("../signatures/ManufacturerSignaturePreparation").then((module) => ({ default: module.ManufacturerSignaturePreparation })));
const AdminSignaturePreparation = lazy(() => import("../signatures/AdminSignaturePreparation").then((module) => ({ default: module.AdminSignaturePreparation })));
const BuyerSignatureDelivery = lazy(() => import("../signature-delivery/BuyerSignatureDelivery").then((module) => ({ default: module.BuyerSignatureDelivery })));
const ManufacturerSignatureDelivery = lazy(() => import("../signature-delivery/ManufacturerSignatureDelivery").then((module) => ({ default: module.ManufacturerSignatureDelivery })));
const AdminSignatureDelivery = lazy(() => import("../signature-delivery/AdminSignatureDelivery").then((module) => ({ default: module.AdminSignatureDelivery })));
const BuyerInvoices = lazy(() => import("../invoices/BuyerInvoices").then((module) => ({ default: module.BuyerInvoices })));
const ManufacturerInvoices = lazy(() => import("../invoices/ManufacturerInvoices").then((module) => ({ default: module.ManufacturerInvoices })));
const AdminInvoices = lazy(() => import("../invoices/AdminInvoices").then((module) => ({ default: module.AdminInvoices })));
const BuyerPayments = lazy(() => import("../payments/BuyerPayments").then((module) => ({ default: module.BuyerPayments })));
const ManufacturerPayments = lazy(() => import("../payments/ManufacturerPayments").then((module) => ({ default: module.ManufacturerPayments })));
const AdminPayments = lazy(() => import("../payments/AdminPayments").then((module) => ({ default: module.AdminPayments })));
const BuyerShippingReadiness = lazy(() => import("../shipping-readiness/BuyerShippingReadiness").then((module) => ({ default: module.BuyerShippingReadiness })));
const ManufacturerShippingReadiness = lazy(() => import("../shipping-readiness/ManufacturerShippingReadiness").then((module) => ({ default: module.ManufacturerShippingReadiness })));
const AdminShippingReadiness = lazy(() => import("../shipping-readiness/AdminShippingReadiness").then((module) => ({ default: module.AdminShippingReadiness })));
const ParticipantLogisticsWorkspace = lazy(() => import("../logistics/ParticipantLogisticsWorkspace").then((module) => ({ default: module.ParticipantLogisticsWorkspace })));
const AdminLogisticsWorkspace = lazy(() => import("../logistics/AdminLogisticsWorkspace").then((module) => ({ default: module.AdminLogisticsWorkspace })));
const ManufacturerWorkspace = lazy(() => import("../manufacturers/ManufacturerWorkspace").then((module) => ({ default: module.ManufacturerWorkspace })));
const ManufacturerProductList = lazy(() => import("../products/ManufacturerProductList").then((module) => ({ default: module.ManufacturerProductList })));
const AdminManufacturerReview = lazy(() => import("../manufacturers/AdminManufacturerReview").then((module) => ({ default: module.AdminManufacturerReview })));
const AdminProductReview = lazy(() => import("../products/AdminProductReview").then((module) => ({ default: module.AdminProductReview })));

interface PortalDashboardProps {
  auth: AuthState;
  role: Role;
  workspace: PortalWorkspace;
  selectedLogisticsRequestId: string | null;
  selectedWorkflowRecordId: string | null;
  onRoleChange: (role: Role) => void;
  onWorkspaceChange: (workspace: PortalWorkspace) => void;
  onLogisticsRequestChange: (requestId: string | null) => void;
  onWorkflowRecordChange: (recordId: string | null) => void;
}

function BetaPlaceholder({ title, children }: { title: string; children: string }) {
  return (
    <section className="panel beta-placeholder">
      <p className="eyebrow">Beta capability</p>
      <h3>{title}</h3>
      <p>{children}</p>
    </section>
  );
}

export function PortalDashboard({
  auth,
  role,
  workspace,
  selectedLogisticsRequestId,
  selectedWorkflowRecordId,
  onRoleChange,
  onWorkspaceChange,
  onLogisticsRequestChange,
  onWorkflowRecordChange,
}: PortalDashboardProps) {
  const hasPortalAccess = Boolean(auth.user && auth.user.role === role);
  const [preferredShippingReadinessId, setPreferredShippingReadinessId] = useState<string | null>(null);
  const definition = portalWorkspaceDefinition(role, workspace);

  function openLogistics(shippingReadinessId?: string) {
    setPreferredShippingReadinessId(shippingReadinessId ?? null);
    onWorkspaceChange("logistics");
  }

  function workspaceContent() {
    if (!auth.user) return null;
    if (workspace === "overview") return <PortalOverview role={role} onWorkspaceChange={onWorkspaceChange} />;

    if (role === "buyer") {
      if (workspace === "rfqs" || workspace === "quotes") return <BuyerRFQDashboard user={auth.user} authMode={auth.mode} showPurchaseOrders={false} selectedRFQId={selectedWorkflowRecordId} onSelectedRFQChange={onWorkflowRecordChange} />;
      if (workspace === "purchase-orders") return <BuyerPurchaseOrders authMode={auth.mode} />;
      if (workspace === "contracts") return <><BuyerContracts authMode={auth.mode} /><BuyerSignaturePreparation authMode={auth.mode} /><BuyerSignatureDelivery authMode={auth.mode} /></>;
      if (workspace === "invoices") return <><BuyerInvoices authMode={auth.mode} /><BuyerPayments authMode={auth.mode} /></>;
      if (workspace === "shipping") return <BuyerShippingReadiness authMode={auth.mode} />;
      if (workspace === "logistics") return <ParticipantLogisticsWorkspace authMode={auth.mode} role="buyer" selectedRequestId={selectedLogisticsRequestId} onSelectedRequestChange={onLogisticsRequestChange} />;
    }

    if (role === "manufacturer") {
      if (workspace === "company") return <ManufacturerWorkspace user={auth.user} authMode={auth.mode} />;
      if (workspace === "products") return <ManufacturerProductList user={auth.user} authMode={auth.mode} />;
      if (workspace === "rfqs" || workspace === "quotes") return <ManufacturerRFQInbox user={auth.user} authMode={auth.mode} selectedRFQId={selectedWorkflowRecordId} onSelectedRFQChange={onWorkflowRecordChange} />;
      if (workspace === "purchase-orders") return <ManufacturerPurchaseOrders authMode={auth.mode} />;
      if (workspace === "contracts") return <><ManufacturerContracts authMode={auth.mode} /><ManufacturerSignaturePreparation authMode={auth.mode} /><ManufacturerSignatureDelivery authMode={auth.mode} /></>;
      if (workspace === "invoices") return <><ManufacturerInvoices authMode={auth.mode} /><ManufacturerPayments authMode={auth.mode} /></>;
      if (workspace === "shipping") return <ManufacturerShippingReadiness authMode={auth.mode} onContinueToLogistics={openLogistics} />;
      if (workspace === "logistics") return <ParticipantLogisticsWorkspace authMode={auth.mode} role="manufacturer" selectedRequestId={selectedLogisticsRequestId} preferredShippingReadinessId={preferredShippingReadinessId} onSelectedRequestChange={onLogisticsRequestChange} />;
    }

    if (role === "admin") {
      if (workspace === "users") return <BetaPlaceholder title="User operations">Dedicated user search, suspension, and invitation services are not implemented. Authentication and role authority remain managed through Supabase and database policies.</BetaPlaceholder>;
      if (workspace === "manufacturers") return <AdminManufacturerReview authMode={auth.mode} />;
      if (workspace === "products") return <AdminProductReview authMode={auth.mode} />;
      if (workspace === "rfqs") return <AdminRFQManagement authMode={auth.mode} selectedRFQId={selectedWorkflowRecordId} onSelectedRFQChange={onWorkflowRecordChange} />;
      if (workspace === "purchase-orders") return <AdminPurchaseOrderManagement authMode={auth.mode} />;
      if (workspace === "contracts") return <><AdminContractManagement authMode={auth.mode} /><AdminSignaturePreparation authMode={auth.mode} /><AdminSignatureDelivery authMode={auth.mode} /></>;
      if (workspace === "invoices") return <><AdminInvoices authMode={auth.mode} /><AdminPayments authMode={auth.mode} /></>;
      if (workspace === "shipping") return <AdminShippingReadiness authMode={auth.mode} />;
      if (workspace === "logistics") return <AdminLogisticsWorkspace authMode={auth.mode} selectedRequestId={selectedLogisticsRequestId} onSelectedRequestChange={onLogisticsRequestChange} />;
    }

    return <BetaPlaceholder title="Workspace unavailable">This workspace is not available for the active portal role.</BetaPlaceholder>;
  }

  return (
    <>
      {!auth.user && (
        <AuthPanel activeRole={role} authError={auth.error} authMode={auth.mode} isLoading={auth.isLoading} onLogin={auth.login} onRegister={auth.register} />
      )}

      {auth.user && !hasPortalAccess && (
        <section className="panel access-panel">
          <p className="eyebrow">Protected Portal</p>
          <h2>Role access required</h2>
          <p>You are signed in as {roleLabels[auth.user.role]}. Switch back to that portal before opening {roleLabels[role]}.</p>
          <button type="button" onClick={() => onRoleChange(auth.user?.role ?? "buyer")}>Go to my portal</button>
        </section>
      )}

      {hasPortalAccess && (
        <section className="portal-shell">
          <header className="portal-shell-header">
            <div>
              <p className="eyebrow">{roleLabels[role]}</p>
              <h2>{definition.label}</h2>
              <p>{definition.description}</p>
            </div>
            <div className="portal-identity"><span>{auth.user?.fullName}</span><small>{auth.user?.email}</small></div>
          </header>
          <PortalWorkspaceNavigation role={role} workspace={workspace} onWorkspaceChange={onWorkspaceChange} />
          <div className="portal-workspace" key={`${role}-${workspace}`}>
            <Suspense fallback={<LoadingState message={`Loading ${definition.label.toLowerCase()}...`} />}>
              {workspaceContent()}
            </Suspense>
          </div>
        </section>
      )}
    </>
  );
}
