import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  emptyManufacturerApplicationForm,
  isManufacturerApplicationStatus,
  toManufacturerInsertPayload,
  toManufacturerUpdatePayload,
  validateManufacturerApplication,
} from "./manufacturers";

describe("manufacturer onboarding helpers", () => {
  it("recognizes only supported application statuses", () => {
    assert.equal(isManufacturerApplicationStatus("draft"), true);
    assert.equal(isManufacturerApplicationStatus("approved"), true);
    assert.equal(isManufacturerApplicationStatus("pending"), false);
    assert.equal(isManufacturerApplicationStatus(null), false);
  });

  it("validates required onboarding fields", () => {
    const errors = validateManufacturerApplication(emptyManufacturerApplicationForm());

    assert.ok(errors.includes("Company legal name is required."));
    assert.ok(errors.includes("Company display name is required."));
    assert.ok(errors.includes("At least one product category is required."));
  });

  it("creates insert payloads without privileged review fields", () => {
    const values = {
      ...emptyManufacturerApplicationForm("contact@example.com"),
      companyLegalName: "Prefab Legal Ltd.",
      companyDisplayName: "Prefab Display",
      contactPerson: "Lin Chen",
      country: "China",
      city: "Shenzhen",
      yearEstablished: "2012",
      productCategories: "ADU, Container House",
      certifications: "ISO 9001, CE",
      companyDescription: "Factory producing modular homes for export.",
    };

    const payload = toManufacturerInsertPayload("profile-1", values, "submitted");

    assert.equal(payload.owner_id, "profile-1");
    assert.equal(payload.company_name, "Prefab Display");
    assert.equal(payload.application_status, "submitted");
    assert.deepEqual(payload.product_categories, ["ADU", "Container House"]);
    assert.deepEqual(payload.certifications, ["ISO 9001", "CE"]);
    assert.equal("reviewed_by" in payload, false);
    assert.equal("review_notes" in payload, false);
  });

  it("keeps manufacturer updates away from approval status", () => {
    const values = {
      ...emptyManufacturerApplicationForm(),
      companyLegalName: "Updated Legal Ltd.",
      companyDisplayName: "Updated Display",
      contactPerson: "Alex Kim",
      email: "alex@example.com",
      country: "Canada",
      city: "Vancouver",
      productCategories: "Panelized",
      companyDescription: "Updated manufacturing profile.",
    };

    const payload = toManufacturerUpdatePayload(values);

    assert.equal(payload.company_name, "Updated Display");
    assert.equal("application_status" in payload, false);
    assert.equal("reviewed_at" in payload, false);
  });
});
