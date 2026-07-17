import fs from "node:fs";
import path from "node:path";

export const MANIFEST_BASE_DIR = ".tmp/staging-fixtures";

export const MANIFEST_ID_FIELDS = [
  "authUserIds",
  "profileIds",
  "manufacturerIds",
  "productIds",
  "rfqIds",
  "quoteIds",
  "purchaseOrderIds",
  "contractIds",
  "invoiceIds",
  "shippingReadinessIds",
  "bookingRequestIds",
  "eventIds",
];

export function createFixtureManifest({ fixturePrefix, projectRef, now = new Date() }) {
  if (!fixturePrefix || !fixturePrefix.startsWith("lbr_live_")) {
    throw new Error("Fixture prefix must start with lbr_live_.");
  }
  if (!projectRef) {
    throw new Error("Manifest project ref is required.");
  }

  return {
    fixturePrefix,
    environmentProjectRef: projectRef,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    authUserIds: [],
    profileIds: [],
    manufacturerIds: [],
    productIds: [],
    rfqIds: [],
    quoteIds: [],
    purchaseOrderIds: [],
    contractIds: [],
    invoiceIds: [],
    shippingReadinessIds: [],
    bookingRequestIds: [],
    eventIds: [],
    dependencyMap: {},
  };
}

export function addManifestIds(manifest, field, ids, now = new Date()) {
  if (!MANIFEST_ID_FIELDS.includes(field)) {
    throw new Error(`Unsupported manifest id field: ${field}`);
  }

  const normalized = Array.isArray(ids) ? ids : [ids];
  for (const id of normalized.filter(Boolean)) {
    if (!manifest[field].includes(id)) {
      manifest[field].push(id);
    }
  }
  manifest.updatedAt = now.toISOString();
  return manifest;
}

export function manifestPath(fixturePrefix, baseDir = MANIFEST_BASE_DIR) {
  if (!fixturePrefix || fixturePrefix.includes("..") || fixturePrefix.includes("/") || fixturePrefix.includes("\\")) {
    throw new Error("Invalid fixture prefix for manifest path.");
  }
  return path.join(baseDir, `${fixturePrefix}.json`);
}

export function writeFixtureManifest(manifest, baseDir = MANIFEST_BASE_DIR) {
  fs.mkdirSync(baseDir, { recursive: true });
  const filePath = manifestPath(manifest.fixturePrefix, baseDir);
  fs.writeFileSync(filePath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  return filePath;
}

export function readFixtureManifest(filePath) {
  const manifest = JSON.parse(fs.readFileSync(filePath, "utf8"));
  validateFixtureManifest(manifest);
  return manifest;
}

export function validateFixtureManifest(manifest) {
  if (!manifest || typeof manifest !== "object") {
    throw new Error("Fixture manifest must be an object.");
  }
  if (!manifest.fixturePrefix?.startsWith("lbr_live_")) {
    throw new Error("Fixture manifest prefix is invalid.");
  }
  if (!manifest.environmentProjectRef) {
    throw new Error("Fixture manifest project ref is required.");
  }
  for (const field of MANIFEST_ID_FIELDS) {
    if (!Array.isArray(manifest[field])) {
      throw new Error(`Fixture manifest field ${field} must be an array.`);
    }
  }
  return true;
}
