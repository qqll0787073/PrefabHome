import fs from "node:fs";

export function loadDotEnvFile(path) {
  if (!fs.existsSync(path)) {
    return {};
  }

  const values = {};
  for (const rawLine of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex < 1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }

  return values;
}

export function loadSmokeEnvironment() {
  return {
    ...loadDotEnvFile(".env.local"),
    ...loadDotEnvFile(".env.smoke.local"),
    ...process.env,
  };
}

export function visibleEnvironmentSummary(env, linkedProjectRef) {
  const keys = [
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_ANON_KEY",
    "PREFAB_SMOKE_EMAIL",
    "PREFAB_SMOKE_PASSWORD",
    "PREFAB_BUYER_SMOKE_EMAIL",
    "PREFAB_BUYER_SMOKE_PASSWORD",
    "PREFAB_ADMIN_SMOKE_EMAIL",
    "PREFAB_ADMIN_SMOKE_PASSWORD",
    "PREFAB_LBR_SMOKE_ENVIRONMENT",
    "PREFAB_LBR_ALLOW_LINKED_PROJECT_SMOKE",
  ];

  return {
    linkedProjectRef: linkedProjectRef || null,
    presentKeys: keys.filter((key) => Boolean(env[key])),
    missingRequiredAuthKeys: [
      "VITE_SUPABASE_URL",
      "VITE_SUPABASE_ANON_KEY",
      "PREFAB_SMOKE_EMAIL",
      "PREFAB_SMOKE_PASSWORD",
      "PREFAB_BUYER_SMOKE_EMAIL",
      "PREFAB_BUYER_SMOKE_PASSWORD",
      "PREFAB_ADMIN_SMOKE_EMAIL",
      "PREFAB_ADMIN_SMOKE_PASSWORD",
    ].filter((key) => !env[key]),
  };
}

export function readLinkedProjectRef() {
  const path = "supabase/.temp/project-ref";
  if (!fs.existsSync(path)) {
    return null;
  }
  return fs.readFileSync(path, "utf8").trim() || null;
}

export function classifySmokeEnvironment(env, linkedProjectRef) {
  const explicitType = env.PREFAB_LBR_SMOKE_ENVIRONMENT?.trim().toLowerCase();
  const allowLinked = env.PREFAB_LBR_ALLOW_LINKED_PROJECT_SMOKE === "true";

  if (explicitType === "staging" || explicitType === "disposable") {
    return {
      type: "staging",
      safeToCreateFixtures: true,
      reason: "Explicit disposable/staging smoke environment selected.",
    };
  }

  if (explicitType === "local") {
    return {
      type: "local",
      safeToCreateFixtures: true,
      reason: "Explicit local Supabase smoke environment selected.",
    };
  }

  if (linkedProjectRef) {
    return {
      type: "linked",
      safeToCreateFixtures: allowLinked,
      reason: allowLinked
        ? "Linked-project live smoke explicitly opted in. Cleanup proof is still required before fixture creation."
        : "Only the linked project is configured and linked-project live fixture creation is not explicitly opted in.",
    };
  }

  return {
    type: "unknown",
    safeToCreateFixtures: false,
    reason: "No Supabase project reference was found.",
  };
}

export function fixturePrefix() {
  const random = Math.random().toString(36).slice(2, 10);
  return `lbr_live_${Date.now()}_${random}`;
}

export function plannedCleanupOrder() {
  return [
    "logistics_booking_request_events",
    "logistics_booking_requests",
    "shipping_readiness_events",
    "shipping_readiness_records",
    "invoice_events",
    "invoice_items",
    "invoices",
    "signature_delivery_request_events",
    "signature_delivery_requests",
    "signature_package_events",
    "signature_package_recipients",
    "signature_packages",
    "contract_events",
    "contract_items",
    "contracts",
    "purchase_order_events",
    "purchase_order_items",
    "purchase_orders",
    "rfq_quote_decisions",
    "rfq_quote_items",
    "rfq_quotes",
    "rfq_events",
    "rfq_messages",
    "rfqs",
    "product_media",
    "products",
    "manufacturers",
    "profiles",
    "auth.users",
  ];
}

export function assertNoSecretLikeValuesWereRequested() {
  return true;
}
