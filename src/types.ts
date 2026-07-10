export type Role = "buyer" | "manufacturer" | "admin";

export type View =
  | "browse"
  | "dashboard"
  | "compare"
  | "advisor"
  | "import-center";

export type ManufacturerApplicationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "suspended";

export interface ManufacturerApplication {
  id: string;
  owner_id: string;
  company_name: string;
  company_legal_name: string | null;
  company_display_name: string | null;
  contact_person: string | null;
  contact_title: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  country: string;
  province: string | null;
  city: string | null;
  street_address: string | null;
  postal_code: string | null;
  year_established: number | null;
  export_experience: string | null;
  product_categories: string[];
  certifications: string[];
  company_description: string | null;
  application_status: ManufacturerApplicationStatus;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ManufacturerApplicationFormValues {
  companyLegalName: string;
  companyDisplayName: string;
  contactPerson: string;
  contactTitle: string;
  email: string;
  phone: string;
  website: string;
  country: string;
  province: string;
  city: string;
  streetAddress: string;
  postalCode: string;
  yearEstablished: string;
  exportExperience: string;
  productCategories: string;
  certifications: string;
  companyDescription: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  manufacturer: string;
  location: string;
  price: number;
  sizeSqFt: number;
  leadTimeWeeks: number;
  imageUrl: string;
  tags: string[];
  description: string;
  compliance: string[];
}

export interface QuoteRequest {
  id: string;
  productId: string;
  productName: string;
  buyerName: string;
  manufacturer: string;
  status: "submitted" | "reviewing" | "quoted" | "ordered";
  budget: number;
}

export interface Message {
  id: string;
  from: string;
  body: string;
  time: string;
}
