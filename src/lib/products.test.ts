import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  emptyProductForm,
  getAllowedAdminProductTransitions,
  manufacturerEditableProductStatuses,
  manufacturerSubmittableProductStatuses,
  toProductPayload,
  toReadableProductError,
  validateProductDraft,
  validateProductForSubmit,
} from "./products";

describe("product database helpers", () => {
  it("maps product form values into database payload fields", () => {
    const payload = toProductPayload({
      ...emptyProductForm(),
      sku: " ADU-20 ",
      modelName: "Compact ADU",
      slug: "compact-adu",
      category: "ADU",
      tags: "modular, backyard",
      intendedUses: "rental, guest house",
      floorAreaSqFt: "420",
      fobPrice: "45000",
      productionLeadTimeWeeks: "8",
      minimumOrderQuantity: "1",
      certifications: "CE, ISO 9001",
    });

    assert.equal(payload.name, "Compact ADU");
    assert.equal(payload.sku, "ADU-20");
    assert.equal(payload.currency, "USD");
    assert.equal(payload.floor_area_sq_ft, 420);
    assert.equal(payload.base_price, 45000);
    assert.deepEqual(payload.tags, ["modular", "backyard"]);
    assert.deepEqual(payload.certifications, ["CE", "ISO 9001"]);
  });

  it("allows incomplete drafts but validates malformed provided values", () => {
    assert.deepEqual(validateProductDraft(emptyProductForm()), []);

    const errors = validateProductDraft({
      ...emptyProductForm(),
      fobPrice: "-1",
      currency: "US",
    });

    assert.ok(errors.includes("FOB price must be a non-negative number."));
    assert.ok(errors.includes("Currency must be a 3-letter code."));
  });

  it("requires core fields before submit", () => {
    const errors = validateProductForSubmit(emptyProductForm());

    assert.ok(errors.includes("Model name is required."));
    assert.ok(errors.includes("Category is required."));
    assert.ok(errors.includes("Description is required."));
  });

  it("keeps manufacturer editable and submittable statuses narrow", () => {
    assert.deepEqual(manufacturerEditableProductStatuses, ["draft", "rejected"]);
    assert.deepEqual(manufacturerSubmittableProductStatuses, ["draft", "rejected"]);
    assert.equal(manufacturerEditableProductStatuses.includes("submitted"), false);
    assert.equal(manufacturerEditableProductStatuses.includes("published"), false);
    assert.equal(manufacturerEditableProductStatuses.includes("archived"), false);
  });

  it("defines admin review transitions by current product status", () => {
    assert.deepEqual(getAllowedAdminProductTransitions("draft"), []);
    assert.deepEqual(getAllowedAdminProductTransitions("submitted"), [
      "published",
      "rejected",
    ]);
    assert.deepEqual(getAllowedAdminProductTransitions("published"), ["archived"]);
    assert.deepEqual(getAllowedAdminProductTransitions("rejected"), ["draft"]);
    assert.deepEqual(getAllowedAdminProductTransitions("archived"), []);
  });

  it("maps database errors into readable product messages", () => {
    assert.equal(
      toReadableProductError({
        code: "23505",
        message: "duplicate key violates unique constraint products_manufacturer_sku_key",
      }).message,
      "A product with this SKU already exists for this manufacturer."
    );
    assert.equal(
      toReadableProductError({
        message: "Manufacturer must be approved before creating products.",
      }).message,
      "Only approved manufacturers can create products."
    );
    assert.equal(
      toReadableProductError({
        message: "new row violates row-level security policy",
      }).message,
      "You are not authorized to access this product."
    );
  });
});
