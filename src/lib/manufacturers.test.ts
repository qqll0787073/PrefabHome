import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  emptyManufacturerApplicationForm,
  isManufacturerApplicationStatus,
  manufacturerEditableStatuses,
  manufacturerSubmittableStatuses,
  toManufacturerInsertPayload,
  toManufacturerUpdatePayload,
  validateManufacturerApplication,
  companyProfileFromApplication,
  validateManufacturerCompanyProfile,
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

  it("allows incomplete drafts while preserving provided field validation", () => {
    const draftErrors = validateManufacturerApplication(emptyManufacturerApplicationForm(), {
      requireComplete: false,
    });
    const yearErrors = validateManufacturerApplication(
      {
        ...emptyManufacturerApplicationForm(),
        yearEstablished: "1700",
      },
      { requireComplete: false }
    );

    assert.deepEqual(draftErrors, []);
    assert.ok(yearErrors.some((error) => error.startsWith("Year established")));
  });

  it("allows manufacturers to submit only draft or rejected applications", () => {
    assert.deepEqual(manufacturerSubmittableStatuses, ["draft", "rejected"]);
    assert.deepEqual(manufacturerEditableStatuses, ["draft", "rejected"]);
    assert.equal(manufacturerSubmittableStatuses.includes("approved"), false);
    assert.equal(manufacturerSubmittableStatuses.includes("suspended"), false);
    assert.equal(manufacturerSubmittableStatuses.includes("under_review"), false);
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

  it("creates incomplete draft payloads without required submit fields", () => {
    const payload = toManufacturerInsertPayload(
      "profile-1",
      emptyManufacturerApplicationForm(),
      "draft"
    );

    assert.equal(payload.company_name, "Untitled manufacturer application");
    assert.equal(payload.country, "Unspecified");
    assert.equal(payload.application_status, "draft");
    assert.equal(payload.company_legal_name, null);
    assert.deepEqual(payload.product_categories, []);
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

describe("approved Manufacturer company profile helpers", () => {
  const values = {
    companyDisplayName: "Approved Modular",
    companyDescription: "Approved Manufacturer of modular homes.",
    website: "https://approved.example",
    city: "Toronto",
    province: "Ontario",
    contactPerson: "Alex Chen",
    contactTitle: "Director",
    email: "alex@example.test",
    phone: "+1 555 0100",
    streetAddress: "100 Factory Road",
    postalCode: "A1A 1A1",
  };

  it("validates required, URL, email, and length boundaries", () => {
    assert.deepEqual(validateManufacturerCompanyProfile(values), []);
    const errors = validateManufacturerCompanyProfile({ ...values, companyDisplayName: "", website: "javascript:alert(1)", email: "invalid" });
    assert.ok(errors.includes("Company display name is required."));
    assert.ok(errors.includes("Website must be a valid HTTP or HTTPS URL."));
    assert.ok(errors.includes("Enter a valid contact email."));
  });

  it("projects only the approved self-service fields from an application", () => {
    const application = {
      id: "m", owner_id: "owner", company_name: "Legacy", company_legal_name: "Locked Legal", company_display_name: values.companyDisplayName,
      contact_person: values.contactPerson, contact_title: values.contactTitle, email: values.email, phone: values.phone, website: values.website,
      country: "Canada", province: values.province, city: values.city, street_address: values.streetAddress, postal_code: values.postalCode,
      year_established: 2000, export_experience: "Locked", product_categories: ["ADU"], certifications: ["CSA"], company_description: values.companyDescription,
      application_status: "approved" as const, review_notes: null, reviewed_by: null, reviewed_at: null, submitted_at: null, created_at: "2026-01-01", updated_at: "2026-01-01",
    };
    assert.deepEqual(companyProfileFromApplication(application), values);
    const projected = companyProfileFromApplication(application) as unknown as Record<string, unknown>;
    for (const protectedField of ["companyLegalName", "country", "yearEstablished", "exportExperience", "productCategories", "certifications", "ownerId", "applicationStatus"]) assert.equal(protectedField in projected, false);
  });
});
