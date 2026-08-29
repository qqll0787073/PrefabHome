import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buyerProductRFQPath, readPortalLocation } from "./portalNavigation";

const productId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

test("Product RFQ intent is a fixed internal Buyer RFQ destination with only safe context", () => {
  assert.equal(buyerProductRFQPath(productId), `/marketplace?view=dashboard&workspace=rfqs&product=${productId}`);
  assert.equal(buyerProductRFQPath("https://evil.example/path"), "/marketplace?view=dashboard&workspace=rfqs");
  assert.equal(buyerProductRFQPath("//evil.example"), "/marketplace?view=dashboard&workspace=rfqs");
  assert.equal(buyerProductRFQPath("javascript:alert(1)"), "/marketplace?view=dashboard&workspace=rfqs");
});

test("portal parsing accepts only UUID Product context scoped to RFQs and ignores redirect input", () => {
  assert.equal(readPortalLocation(`?view=dashboard&workspace=rfqs&product=${productId}`).productId, productId);
  assert.equal(readPortalLocation(`?view=dashboard&workspace=orders&product=${productId}`).productId ?? null, null);
  assert.equal(readPortalLocation("?view=dashboard&workspace=rfqs&product=bad&next=https://evil.example&return=//evil.example").productId ?? null, null);
});

test("auth return flow reuses the existing RFQ dialog without automatic creation or role authority", () => {
  const detail = readFileSync("src/features/marketplace/MarketplaceProductDetail.tsx", "utf8");
  const portal = readFileSync("src/app/PortalApplication.tsx", "utf8");
  const dashboard = readFileSync("src/features/rfqs/BuyerRFQDashboard.tsx", "utf8");
  const dialog = readFileSync("src/features/rfqs/RFQRequestDialog.tsx", "utf8");
  assert.match(detail, /buyerProductRFQPath\(product\.id\)/);
  assert.match(portal, /nextRole === "buyer" \? productRFQContextId : null/);
  assert.match(dashboard, /fetchMarketplaceProductById\(productContextId\)[\s\S]+RFQRequestDialog/);
  assert.match(dashboard, /onProductContextConsumed/);
  assert.doesNotMatch(dashboard, /persistProductRFQ|createRFQ|submitRFQ/);
  assert.match(dialog, /user\.role === "buyer" && user\.status !== "suspended"/);
  assert.match(dialog, /if \(savingRef\.current \|\| !canRequest \|\| !user\) return/);
});
