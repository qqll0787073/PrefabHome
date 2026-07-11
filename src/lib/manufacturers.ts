import { supabase } from "./supabase";
import type {
  ManufacturerApplication,
  ManufacturerApplicationFormValues,
  ManufacturerApplicationStatus,
} from "../types";

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

export const manufacturerSubmittableStatuses: ManufacturerApplicationStatus[] = [
  "draft",
  "rejected",
];

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

  return new Error(error.message ?? "Unable to save manufacturer application.");
}

export async function fetchOwnManufacturerApplication(
  ownerId: string
): Promise<ManufacturerApplication | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("manufacturers")
    .select("*")
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error) throw error;
  return data as ManufacturerApplication | null;
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

export async function createManufacturerApplication(
  ownerId: string,
  values: ManufacturerApplicationFormValues,
  status: Extract<ManufacturerApplicationStatus, "draft" | "submitted">
): Promise<ManufacturerApplication> {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const payload = toManufacturerInsertPayload(ownerId, values, status);
  const { data, error } = await supabase
    .from("manufacturers")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw toReadableManufacturerError(error);
  return data as ManufacturerApplication;
}

export async function updateManufacturerApplication(
  applicationId: string,
  values: ManufacturerApplicationFormValues
): Promise<ManufacturerApplication> {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase
    .from("manufacturers")
    .update(toManufacturerUpdatePayload(values))
    .eq("id", applicationId)
    .select("*")
    .single();

  if (error) throw toReadableManufacturerError(error);
  return data as ManufacturerApplication;
}

export async function submitManufacturerApplication(
  applicationId: string,
  values: ManufacturerApplicationFormValues
): Promise<ManufacturerApplication> {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase
    .from("manufacturers")
    .update({
      ...toManufacturerUpdatePayload(values),
      application_status: "submitted",
    })
    .eq("id", applicationId)
    .select("*")
    .single();

  if (error) throw toReadableManufacturerError(error);
  return data as ManufacturerApplication;
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
