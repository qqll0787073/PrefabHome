import { assertStagingSafety, PRODUCTION_PROJECT_REF } from "./staging-safety.mjs";
import { readFixtureManifest, validateFixtureManifest } from "./fixture-manifest.mjs";
import { pathToFileURL } from "node:url";

export const CLEANUP_PLAN = [
  ["logistics_booking_request_events", "eventIds"],
  ["logistics_booking_requests", "bookingRequestIds"],
  ["shipping_readiness_events", "eventIds"],
  ["shipping_readiness_records", "shippingReadinessIds"],
  ["invoice_events", "eventIds"],
  ["invoice_items", "invoiceIds"],
  ["invoices", "invoiceIds"],
  ["signature_delivery_request_events", "eventIds"],
  ["signature_delivery_requests", "eventIds"],
  ["signature_package_events", "eventIds"],
  ["signature_package_recipients", "eventIds"],
  ["signature_packages", "eventIds"],
  ["contract_events", "eventIds"],
  ["contract_items", "contractIds"],
  ["contracts", "contractIds"],
  ["purchase_order_events", "eventIds"],
  ["purchase_order_items", "purchaseOrderIds"],
  ["purchase_orders", "purchaseOrderIds"],
  ["rfq_quote_decisions", "quoteIds"],
  ["rfq_quote_items", "quoteIds"],
  ["rfq_quotes", "quoteIds"],
  ["rfq_events", "eventIds"],
  ["rfq_messages", "rfqIds"],
  ["rfqs", "rfqIds"],
  ["product_media", "productIds"],
  ["products", "productIds"],
  ["manufacturers", "manufacturerIds"],
  ["profiles", "profileIds"],
  ["auth.users", "authUserIds"],
];

export function buildCleanupPlan(manifest) {
  validateFixtureManifest(manifest);
  if (manifest.environmentProjectRef === PRODUCTION_PROJECT_REF) {
    throw new Error("Production project ref is denied for cleanup.");
  }

  return CLEANUP_PLAN.map(([table, field]) => ({
    table,
    idField: field,
    ids: [...new Set(manifest[field] ?? [])],
  })).filter((step) => step.ids.length > 0);
}

export function verifyManifestProject(manifest, expectedProjectRef) {
  validateFixtureManifest(manifest);
  if (!expectedProjectRef) {
    throw new Error("Expected project ref is required.");
  }
  if (expectedProjectRef === PRODUCTION_PROJECT_REF) {
    throw new Error("Production project ref is denied.");
  }
  if (manifest.environmentProjectRef !== expectedProjectRef) {
    throw new Error("Manifest project ref does not match staging environment.");
  }
  return true;
}

export function summarizeCleanupPlan(plan) {
  return plan.map((step) => ({
    table: step.table,
    count: step.ids.length,
  }));
}

export function main() {
  const manifestArg = process.argv[2];
  if (!manifestArg) {
    console.error("Usage: node scripts/test-infrastructure/cleanup-staging-fixture.mjs <manifest-path>");
    process.exit(2);
    return;
  }

  try {
    const safety = assertStagingSafety(process.env);
    const manifest = readFixtureManifest(manifestArg);
    verifyManifestProject(manifest, safety.projectRef);
    const plan = buildCleanupPlan(manifest);
    console.log(JSON.stringify({
      mode: "plan_only",
      projectRef: safety.projectRef,
      fixturePrefix: manifest.fixturePrefix,
      cleanupSteps: summarizeCleanupPlan(plan),
      remoteDeletesExecuted: 0,
    }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({
      safetyDecision: "unsafe",
      message: error.message,
      report: error.report,
    }, null, 2));
    process.exit(2);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
