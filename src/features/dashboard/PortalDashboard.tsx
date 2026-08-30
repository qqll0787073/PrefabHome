import { lazy, Suspense, useState, type ComponentType } from "react";
import { roleLabels } from "../../app/constants";
import { LoadingState } from "../../components/common/LoadingState";
import { AuthPanel } from "../auth/AuthPanel";
import { portalWorkspaceDefinition, type PortalWorkspace } from "../../lib/portalNavigation";
import type { AuthState } from "../../lib/auth";
import type { Role } from "../../types";
import { PortalOverview } from "./PortalOverview";
import { PortalWorkspaceNavigation } from "./PortalWorkspaceNavigation";

function lazyNamed<T extends ComponentType<any>>(loader: () => Promise<unknown>, name: string) {
  return lazy(async () => ({ default: (await loader() as Record<string, T>)[name] }));
}

const BuyerRFQDashboard = lazyNamed(() => import("../rfqs/BuyerRFQDashboard"), "BuyerRFQDashboard");
const BuyerFavoritesWorkspace = lazyNamed(() => import("../favorites/BuyerFavoritesWorkspace"), "BuyerFavoritesWorkspace");
const BuyerMessagesWorkspace = lazyNamed(() => import("../messages/BuyerMessagesWorkspace"), "BuyerMessagesWorkspace");
const BuyerProfileWorkspace = lazyNamed(() => import("../profile/BuyerProfileWorkspace"), "BuyerProfileWorkspace");
const BuyerManufacturersWorkspace = lazyNamed(() => import("../manufacturers/ManufacturerWorkspace"), "BuyerManufacturersWorkspace");
const ManufacturerRFQInbox = lazyNamed(() => import("../rfqs/ManufacturerRFQInbox"), "ManufacturerRFQInbox");
const AdminRFQManagement = lazyNamed(() => import("../rfqs/AdminRFQManagement"), "AdminRFQManagement");
const BuyerPurchaseOrders = lazyNamed(() => import("../purchase-orders/BuyerPurchaseOrders"), "BuyerPurchaseOrders");
const ManufacturerPurchaseOrders = lazyNamed(() => import("../purchase-orders/ManufacturerPurchaseOrders"), "ManufacturerPurchaseOrders");
const AdminPurchaseOrderManagement = lazyNamed(() => import("../purchase-orders/AdminPurchaseOrderManagement"), "AdminPurchaseOrderManagement");
const BuyerContracts = lazyNamed(() => import("../contracts/BuyerContracts"), "BuyerContracts");
const ManufacturerContracts = lazyNamed(() => import("../contracts/ManufacturerContracts"), "ManufacturerContracts");
const AdminContractManagement = lazyNamed(() => import("../contracts/AdminContractManagement"), "AdminContractManagement");
const BuyerSignaturePreparation = lazyNamed(() => import("../signatures/BuyerSignaturePreparation"), "BuyerSignaturePreparation");
const ManufacturerSignaturePreparation = lazyNamed(() => import("../signatures/ManufacturerSignaturePreparation"), "ManufacturerSignaturePreparation");
const AdminSignaturePreparation = lazyNamed(() => import("../signatures/AdminSignaturePreparation"), "AdminSignaturePreparation");
const BuyerSignatureDelivery = lazyNamed(() => import("../signature-delivery/BuyerSignatureDelivery"), "BuyerSignatureDelivery");
const ManufacturerSignatureDelivery = lazyNamed(() => import("../signature-delivery/ManufacturerSignatureDelivery"), "ManufacturerSignatureDelivery");
const AdminSignatureDelivery = lazyNamed(() => import("../signature-delivery/AdminSignatureDelivery"), "AdminSignatureDelivery");
const BuyerInvoices = lazyNamed(() => import("../invoices/BuyerInvoices"), "BuyerInvoices");
const ManufacturerInvoices = lazyNamed(() => import("../invoices/ManufacturerInvoices"), "ManufacturerInvoices");
const AdminInvoices = lazyNamed(() => import("../invoices/AdminInvoices"), "AdminInvoices");
const BuyerPayments = lazyNamed(() => import("../payments/BuyerPayments"), "BuyerPayments");
const ManufacturerPayments = lazyNamed(() => import("../payments/ManufacturerPayments"), "ManufacturerPayments");
const AdminPayments = lazyNamed(() => import("../payments/AdminPayments"), "AdminPayments");
const BuyerShippingReadiness = lazyNamed(() => import("../shipping-readiness/BuyerShippingReadiness"), "BuyerShippingReadiness");
const ManufacturerShippingReadiness = lazyNamed(() => import("../shipping-readiness/ManufacturerShippingReadiness"), "ManufacturerShippingReadiness");
const AdminShippingReadiness = lazyNamed(() => import("../shipping-readiness/AdminShippingReadiness"), "AdminShippingReadiness");
const ParticipantLogisticsWorkspace = lazyNamed(() => import("../logistics/ParticipantLogisticsWorkspace"), "ParticipantLogisticsWorkspace");
const AdminLogisticsWorkspace = lazyNamed(() => import("../logistics/AdminLogisticsWorkspace"), "AdminLogisticsWorkspace");
const ManufacturerWorkspace = lazyNamed(() => import("../manufacturers/ManufacturerWorkspace"), "ManufacturerWorkspace");
const ManufacturerProductList = lazyNamed(() => import("../products/ManufacturerProductList"), "ManufacturerProductList");
const AdminManufacturerReview = lazyNamed(() => import("../manufacturers/AdminManufacturerReview"), "AdminManufacturerReview");
const AdminProductReview = lazyNamed(() => import("../products/AdminProductReview"), "AdminProductReview");
const AdminUsersWorkspace = lazyNamed(() => import("../admin/AdminUsersWorkspace"), "AdminUsersWorkspace");

interface PortalDashboardProps {
  auth: AuthState;
  role: Role;
  workspace: PortalWorkspace;
  selectedLogisticsRequestId: string | null;
  selectedWorkflowRecordId: string | null;
  productRFQContextId: string | null;
  onRoleChange: (role: Role) => void;
  onWorkspaceChange: (workspace: PortalWorkspace) => void;
  onLogisticsRequestChange: (requestId: string | null) => void;
  onWorkflowRecordChange: (recordId: string | null) => void;
  onProductRFQContextConsumed: () => void;
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
  productRFQContextId,
  onRoleChange,
  onWorkspaceChange,
  onLogisticsRequestChange,
  onWorkflowRecordChange,
  onProductRFQContextConsumed,
}: PortalDashboardProps) {
  const hasPortalAccess = Boolean(auth.user && auth.user.role === role && auth.user.status !== "suspended");
  const [preferredShippingReadinessId, setPreferredShippingReadinessId] = useState<string | null>(null);
  const definition = portalWorkspaceDefinition(role, workspace);

  function openLogistics(shippingReadinessId?: string) {
    setPreferredShippingReadinessId(shippingReadinessId ?? null);
    onWorkspaceChange("logistics");
  }

  function workspaceContent() {
    if (!auth.user) return null;
    if (workspace === "overview") return <PortalOverview role={role} user={auth.user} authMode={auth.mode} onWorkspaceChange={onWorkspaceChange} />;

    if (role === "buyer") {
      if (workspace === "manufacturers") return <BuyerManufacturersWorkspace selectedManufacturerId={selectedWorkflowRecordId} onSelectedManufacturerChange={onWorkflowRecordChange} />;
      if (workspace === "favorites") return <BuyerFavoritesWorkspace />;
      if (workspace === "messages") return <BuyerMessagesWorkspace key={auth.user.id} selectedConversationId={selectedWorkflowRecordId} onSelectedConversationChange={onWorkflowRecordChange} />;
      if (workspace === "profile") return <BuyerProfileWorkspace key={auth.user.id} user={auth.user} />;
      if (workspace === "rfqs" || workspace === "quotes") return <BuyerRFQDashboard user={auth.user} authMode={auth.mode} selectedRFQId={selectedWorkflowRecordId} onSelectedRFQChange={onWorkflowRecordChange} productContextId={productRFQContextId} onProductContextConsumed={onProductRFQContextConsumed} />;
      if (workspace === "orders" || workspace === "purchase-orders") return <BuyerPurchaseOrders key={auth.user.id} authMode={auth.mode} selectedPOId={selectedWorkflowRecordId} onSelectedPOChange={onWorkflowRecordChange} onWorkspaceChange={onWorkspaceChange} />;
      if (workspace === "contracts") return <><BuyerContracts authMode={auth.mode} selectedContractId={selectedWorkflowRecordId} /><BuyerSignaturePreparation authMode={auth.mode} /><BuyerSignatureDelivery authMode={auth.mode} /></>;
      if (workspace === "invoices") return <><BuyerInvoices authMode={auth.mode} selectedInvoiceId={selectedWorkflowRecordId} /><BuyerPayments authMode={auth.mode} /></>;
      if (workspace === "shipping") return <BuyerShippingReadiness authMode={auth.mode} selectedShippingId={selectedWorkflowRecordId} />;
      if (workspace === "logistics") return <ParticipantLogisticsWorkspace authMode={auth.mode} role="buyer" selectedRequestId={selectedLogisticsRequestId} onSelectedRequestChange={onLogisticsRequestChange} />;
    }

    if (role === "manufacturer") {
      if (workspace === "company") return <ManufacturerWorkspace user={auth.user} authMode={auth.mode} />;
      if (workspace === "products") return <ManufacturerProductList key={auth.user.id} user={auth.user} authMode={auth.mode} selectedProductId={selectedWorkflowRecordId} onSelectedProductChange={onWorkflowRecordChange} />;
      if (workspace === "rfqs" || workspace === "quotes") return <ManufacturerRFQInbox user={auth.user} authMode={auth.mode} selectedRFQId={selectedWorkflowRecordId} onSelectedRFQChange={onWorkflowRecordChange} />;
      if (workspace === "purchase-orders") return <ManufacturerPurchaseOrders authMode={auth.mode} />;
      if (workspace === "contracts") return <><ManufacturerContracts authMode={auth.mode} /><ManufacturerSignaturePreparation authMode={auth.mode} /><ManufacturerSignatureDelivery authMode={auth.mode} /></>;
      if (workspace === "invoices") return <><ManufacturerInvoices authMode={auth.mode} /><ManufacturerPayments authMode={auth.mode} /></>;
      if (workspace === "shipping") return <ManufacturerShippingReadiness authMode={auth.mode} onContinueToLogistics={openLogistics} />;
      if (workspace === "logistics") return <ParticipantLogisticsWorkspace authMode={auth.mode} role="manufacturer" selectedRequestId={selectedLogisticsRequestId} preferredShippingReadinessId={preferredShippingReadinessId} onSelectedRequestChange={onLogisticsRequestChange} />;
    }

    if (role === "admin") {
      if (workspace === "users") return <AdminUsersWorkspace authMode={auth.mode} />;
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
      {auth.recoveryState !== "none" && (
        <AuthPanel activeRole={role} authError={auth.error} authMode={auth.mode} isLoading={auth.isLoading} onLogin={auth.login} onRegister={auth.register} onRequestPasswordRecovery={auth.requestPasswordRecovery} recoveryState={auth.recoveryState} onUpdatePassword={auth.updateRecoveredPassword} onClearRecovery={auth.clearRecovery} />
      )}

      {auth.recoveryState === "none" && !auth.user && (
        <AuthPanel activeRole={role} authError={auth.error} authMode={auth.mode} isLoading={auth.isLoading} onLogin={auth.login} onRegister={auth.register} onRequestPasswordRecovery={auth.requestPasswordRecovery} />
      )}

      {auth.recoveryState === "none" && auth.user && !hasPortalAccess && (
        <section className="panel access-panel">
          <p className="eyebrow">Protected Portal</p>
          <h2>Role access required</h2>
          <p>You are signed in as {roleLabels[auth.user.role]}. Switch back to that portal before opening {roleLabels[role]}.</p>
          <button type="button" onClick={() => onRoleChange(auth.user?.role ?? "buyer")}>Go to my portal</button>
        </section>
      )}

      {auth.recoveryState === "none" && hasPortalAccess && (
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
