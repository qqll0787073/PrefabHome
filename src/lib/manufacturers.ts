import { supabase } from "./supabase";
import type {
  ManufacturerApplication,
  ManufacturerAccount,
  ManufacturerApplicationFormValues,
  ManufacturerApplicationStatus,
} from "../types";

export interface ManufacturerCompanyProfileValues {
  companyDisplayName: string;
  companyDescription: string;
  website: string;
  city: string;
  province: string;
  contactPerson: string;
  contactTitle: string;
  email: string;
  phone: string;
  streetAddress: string;
  postalCode: string;
}

export const manufacturerApplicationStatuses: ManufacturerApplicationStatus[] = [
  "draft",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "suspended",
];

export const adminReviewStatuses: ManufacturerApplicationStatus[] = [
  "draft",
  "under_review",
  "approved",
  "rejected",
  "suspended",
];

export const statusLabels: Record<ManufacturerApplicationStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
  suspended: "Suspended",
};

export const manufacturerEditableStatuses: ManufacturerApplicationStatus[] = [
  "draft",
  "rejected",
];

export const manufacturerSubmittableStatuses = manufacturerEditableStatuses;

export function isManufacturerApplicationStatus(
  value: unknown
): value is ManufacturerApplicationStatus {
  return (
    typeof value === "string" &&
    manufacturerApplicationStatuses.includes(value as ManufacturerApplicationStatus)
  );
}

export function emptyManufacturerApplicationForm(
  email = ""
): ManufacturerApplicationFormValues {
  return {
    companyLegalName: "",
    companyDisplayName: "",
    contactPerson: "",
    contactTitle: "",
    email,
    phone: "",
    website: "",
    country: "",
    province: "",
    city: "",
    streetAddress: "",
    postalCode: "",
    yearEstablished: "",
    exportExperience: "",
    productCategories: "",
    certifications: "",
    companyDescription: "",
  };
}

export function formFromApplication(
  application: ManufacturerApplication
): ManufacturerApplicationFormValues {
  return {
    companyLegalName: application.company_legal_name ?? application.company_name,
    companyDisplayName: application.company_display_name ?? application.company_name,
    contactPerson: application.contact_person ?? "",
    contactTitle: application.contact_title ?? "",
    email: application.email ?? "",
    phone: application.phone ?? "",
    website: application.website ?? "",
    country: application.country,
    province: application.province ?? "",
    city: application.city ?? "",
    streetAddress: application.street_address ?? "",
    postalCode: application.postal_code ?? "",
    yearEstablished: application.year_established?.toString() ?? "",
    exportExperience: application.export_experience ?? "",
    productCategories: application.product_categories.join(", "),
    certifications: application.certifications.join(", "),
    companyDescription: application.company_description ?? "",
  };
}

export function companyProfileFromApplication(application: ManufacturerApplication): ManufacturerCompanyProfileValues {
  return {
    companyDisplayName: application.company_display_name ?? application.company_name,
    companyDescription: application.company_description ?? "",
    website: application.website ?? "",
    city: application.city ?? "",
    province: application.province ?? "",
    contactPerson: application.contact_person ?? "",
    contactTitle: application.contact_title ?? "",
    email: application.email ?? "",
    phone: application.phone ?? "",
    streetAddress: application.street_address ?? "",
    postalCode: application.postal_code ?? "",
  };
}

export function validateManufacturerCompanyProfile(values: ManufacturerCompanyProfileValues): string[] {
  const errors: string[] = [];
  const required: Array<[string, string, number]> = [
    [values.companyDisplayName, "Company display name", 120],
    [values.companyDescription, "Company description", 2000],
    [values.city, "City", 120],
    [values.contactPerson, "Contact person", 120],
  ];
  for (const [value, label, maximum] of required) {
    if (!value.trim()) errors.push(`${label} is required.`);
    else if (value.trim().length > maximum) errors.push(`${label} must be ${maximum} characters or fewer.`);
  }
  if (!values.email.trim() || values.email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.push("Enter a valid contact email.");
  if (values.website.trim()) {
    try {
      const url = new URL(values.website.trim());
      if (!["http:", "https:"].includes(url.protocol) || values.website.trim().length > 500) throw new Error();
    } catch { errors.push("Website must be a valid HTTP or HTTPS URL."); }
  }
  const optionalLimits: Array<[string, string, number]> = [
    [values.province, "Province or state", 120], [values.contactTitle, "Contact title", 120],
    [values.phone, "Phone", 40], [values.streetAddress, "Street address", 300], [values.postalCode, "Postal code", 32],
  ];
  for (const [value, label, maximum] of optionalLimits) if (value.trim().length > maximum) errors.push(`${label} must be ${maximum} characters or fewer.`);
  return errors;
}

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function listFromText(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function yearFromText(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const year = Number(trimmed);
  return Number.isInteger(year) ? year : Number.NaN;
}

export function validateManufacturerApplication(
  values: ManufacturerApplicationFormValues,
  options: { requireComplete: boolean } = { requireComplete: true }
): string[] {
  const errors: string[] = [];

  if (options.requireComplete) {
    if (!values.companyLegalName.trim()) errors.push("Company legal name is required.");
    if (!values.companyDisplayName.trim()) errors.push("Company display name is required.");
    if (!values.contactPerson.trim()) errors.push("Contact person is required.");
    if (!values.email.trim()) errors.push("Email is required.");
    if (!values.country.trim()) errors.push("Country is required.");
    if (!values.city.trim()) errors.push("City is required.");
    if (!values.companyDescription.trim()) errors.push("Company description is required.");
  }

  const year = yearFromText(values.yearEstablished);
  const currentYear = new Date().getFullYear();
  if (Number.isNaN(year) || (year && (year < 1800 || year > currentYear))) {
    errors.push(`Year established must be between 1800 and ${currentYear}.`);
  }

  if (options.requireComplete && listFromText(values.productCategories).length === 0) {
    errors.push("At least one product category is required.");
  }

  return errors;
}

function fallbackCompanyName(values: ManufacturerApplicationFormValues): string {
  return (
    values.companyDisplayName.trim() ||
    values.companyLegalName.trim() ||
    "Untitled manufacturer application"
  );
}

export function toManufacturerInsertPayload(
  ownerId: string,
  values: ManufacturerApplicationFormValues,
  status: Extract<ManufacturerApplicationStatus, "draft" | "submitted">
) {
  return {
    owner_id: ownerId,
    company_name: fallbackCompanyName(values),
    company_legal_name: optionalText(values.companyLegalName),
    company_display_name: optionalText(values.companyDisplayName),
    contact_person: optionalText(values.contactPerson),
    contact_title: optionalText(values.contactTitle),
    email: optionalText(values.email),
    phone: optionalText(values.phone),
    website: optionalText(values.website),
    country: values.country.trim() || "Unspecified",
    province: optionalText(values.province),
    city: optionalText(values.city),
    street_address: optionalText(values.streetAddress),
    postal_code: optionalText(values.postalCode),
    year_established: yearFromText(values.yearEstablished),
    export_experience: optionalText(values.exportExperience),
    product_categories: listFromText(values.productCategories),
    certifications: listFromText(values.certifications),
    company_description: optionalText(values.companyDescription),
    application_status: status,
  };
}

export function toManufacturerUpdatePayload(values: ManufacturerApplicationFormValues) {
  return {
    company_name: fallbackCompanyName(values),
    company_legal_name: optionalText(values.companyLegalName),
    company_display_name: optionalText(values.companyDisplayName),
    contact_person: optionalText(values.contactPerson),
    contact_title: optionalText(values.contactTitle),
    email: optionalText(values.email),
    phone: optionalText(values.phone),
    website: optionalText(values.website),
    country: values.country.trim() || "Unspecified",
    province: optionalText(values.province),
    city: optionalText(values.city),
    street_address: optionalText(values.streetAddress),
    postal_code: optionalText(values.postalCode),
    year_established: yearFromText(values.yearEstablished),
    export_experience: optionalText(values.exportExperience),
    product_categories: listFromText(values.productCategories),
    certifications: listFromText(values.certifications),
    company_description: optionalText(values.companyDescription),
  };
}

function toReadableManufacturerError(error: { code?: string; message?: string }): Error {
  if (error.code === "23505" || error.message?.toLowerCase().includes("duplicate key")) {
    return new Error("A manufacturer application already exists for this account.");
  }

  if (error.message?.includes("not editable")) return new Error("This application is not editable in its current status.");
  if (error.message?.includes("Active Manufacturer")) return new Error("An active Manufacturer account is required.");
  return new Error("Unable to save manufacturer application. Please try again.");
}

export async function fetchOwnManufacturerAccount(): Promise<ManufacturerAccount> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data: identityData, error: identityError } = await supabase.auth.getUser();
  if (identityError || !identityData.user) throw new Error("Manufacturer sign-in required.");
  const { data, error } = await supabase.rpc("get_my_manufacturer_account");
  if (error) throw new Error("Unable to load Manufacturer account. Please try again.");
  const row = data?.[0];
  if (!row || row.profile_id !== identityData.user.id || row.profile_role !== "manufacturer") {
    throw new Error("Manufacturer account access is unavailable.");
  }
  const manufacturer: ManufacturerApplication | null = row.id ? {
    id: row.id,
    owner_id: row.profile_id,
    company_name: row.company_name ?? "Untitled manufacturer application",
    company_legal_name: row.company_legal_name,
    company_display_name: row.company_display_name,
    contact_person: row.contact_person,
    contact_title: row.contact_title,
    email: row.email,
    phone: row.phone,
    website: row.website,
    country: row.country ?? "Unspecified",
    province: row.province,
    city: row.city,
    street_address: row.street_address,
    postal_code: row.postal_code,
    year_established: row.year_established,
    export_experience: row.export_experience,
    product_categories: row.product_categories ?? [],
    certifications: row.certifications ?? [],
    company_description: row.company_description,
    application_status: isManufacturerApplicationStatus(row.application_status) ? row.application_status : "draft",
    review_notes: null,
    reviewed_by: null,
    reviewed_at: null,
    submitted_at: row.submitted_at,
    created_at: row.created_at ?? row.profile_created_at,
    updated_at: row.updated_at ?? row.profile_created_at,
  } : null;
  return {
    profile_id: row.profile_id,
    profile_status: row.profile_status,
    manufacturer,
  };
}

export async function fetchManufacturerApplications(): Promise<ManufacturerApplication[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("manufacturers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ManufacturerApplication[];
}

export async function saveManufacturerApplication(values: ManufacturerApplicationFormValues, submit: boolean): Promise<ManufacturerApplication> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const yearText = values.yearEstablished.trim();
  const { error } = await supabase.rpc("save_my_manufacturer_application", {
    company_legal_name_text: values.companyLegalName,
    company_display_name_text: values.companyDisplayName,
    contact_person_text: values.contactPerson,
    contact_title_text: values.contactTitle,
    contact_email_text: values.email,
    contact_phone_text: values.phone,
    website_text: values.website,
    country_text: values.country,
    region_text: values.province,
    city_text: values.city,
    street_address_text: values.streetAddress,
    postal_code_text: values.postalCode,
    year_established_value: yearText ? Number(yearText) : null,
    export_experience_text: values.exportExperience,
    product_categories_value: listFromText(values.productCategories),
    certifications_value: listFromText(values.certifications),
    company_description_text: values.companyDescription,
    submit_application: submit,
  });
  if (error) throw toReadableManufacturerError(error);
  const refreshed = await fetchOwnManufacturerAccount();
  if (!refreshed.manufacturer) throw new Error("Unable to reload Manufacturer application.");
  return refreshed.manufacturer;
}

export async function updateManufacturerCompanyProfile(values: ManufacturerCompanyProfileValues): Promise<ManufacturerApplication> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.rpc("update_my_manufacturer_company_profile", {
    company_display_name_text: values.companyDisplayName,
    company_description_text: values.companyDescription,
    website_text: values.website,
    city_text: values.city,
    region_text: values.province,
    contact_person_text: values.contactPerson,
    contact_title_text: values.contactTitle,
    contact_email_text: values.email,
    contact_phone_text: values.phone,
    street_address_text: values.streetAddress,
    postal_code_text: values.postalCode,
  });
  if (error) {
    if (error.message?.includes("Approved Manufacturer") || error.message?.includes("Active Manufacturer")) throw new Error("Company profile editing is unavailable for this account.");
    throw new Error("Unable to save company profile. Please try again.");
  }
  const refreshed = await fetchOwnManufacturerAccount();
  if (!refreshed.manufacturer || refreshed.manufacturer.application_status !== "approved") throw new Error("Unable to reload company profile.");
  return refreshed.manufacturer;
}

export async function reviewManufacturerApplication(
  applicationId: string,
  applicationStatus: ManufacturerApplicationStatus,
  reviewNotes: string
): Promise<ManufacturerApplication> {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase
    .from("manufacturers")
    .update({
      application_status: applicationStatus,
      review_notes: reviewNotes.trim() || null,
    })
    .eq("id", applicationId)
    .select("*")
    .single();

  if (error) throw error;
  return data as ManufacturerApplication;
}
