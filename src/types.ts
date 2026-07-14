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

export type ProductLifecycleStatus =
  | "draft"
  | "submitted"
  | "published"
  | "rejected"
  | "archived";

export type ProductMediaType =
  | "exterior_image"
  | "interior_image"
  | "floor_plan"
  | "rendering"
  | "factory_photo"
  | "specification_sheet"
  | "catalog"
  | "installation_manual"
  | "certification"
  | "other_document";

export type ProductMediaVisibility = "public" | "private";

export interface ProductRecord {
  id: string;
  manufacturer_id: string;
  name: string;
  sku: string | null;
  model_name: string | null;
  slug: string | null;
  category: string;
  short_description: string | null;
  description: string | null;
  tags: string[];
  intended_uses: string[];
  floor_area_sq_ft: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  stories: number | null;
  length_ft: number | null;
  width_ft: number | null;
  height_ft: number | null;
  structure_material: string | null;
  exterior_finish: string | null;
  roof_type: string | null;
  insulation: string | null;
  electrical_standard: string | null;
  plumbing_standard: string | null;
  wind_rating: string | null;
  snow_load_psf: number | null;
  currency: string;
  fob_price: number | null;
  price_unit: string | null;
  minimum_order_quantity: number | null;
  production_lead_time_weeks: number | null;
  port_of_loading: string | null;
  hs_code: string | null;
  certifications: string[];
  target_markets: string[];
  notes: string | null;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  submitted_at: string | null;
  published_at: string | null;
  archived_at: string | null;
  status: ProductLifecycleStatus;
  created_at: string;
  updated_at: string;
}

export type PublicProductRecord = Omit<
  ProductRecord,
  | "notes"
  | "review_notes"
  | "reviewed_by"
  | "reviewed_at"
  | "submitted_at"
  | "archived_at"
>;

export interface ProductMediaRecord {
  id: string;
  product_id: string;
  media_type: ProductMediaType;
  storage_bucket: string;
  storage_path: string;
  original_filename: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  title: string | null;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
  visibility: ProductMediaVisibility;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type PublicProductMediaRecord = Omit<
  ProductMediaRecord,
  "created_by" | "updated_at"
>;

export interface MarketplaceProductImage {
  id: string;
  product_id: string;
  media_type: ProductMediaType;
  storage_bucket: string;
  storage_path: string;
  original_filename: string | null;
  mime_type: string | null;
  title: string | null;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
  signed_url: string | null;
}

export interface MarketplaceProduct {
  id: string;
  manufacturer_id: string;
  manufacturer_display_name: string;
  manufacturer_country: string | null;
  name: string;
  model_name: string | null;
  slug: string | null;
  category: string;
  short_description: string | null;
  description: string | null;
  tags: string[];
  intended_uses: string[];
  floor_area_sq_ft: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  stories: number | null;
  length_ft: number | null;
  width_ft: number | null;
  height_ft: number | null;
  structure_material: string | null;
  exterior_finish: string | null;
  roof_type: string | null;
  insulation: string | null;
  electrical_standard: string | null;
  plumbing_standard: string | null;
  wind_rating: string | null;
  snow_load_psf: number | null;
  currency: string;
  fob_price: number | null;
  price_unit: string | null;
  minimum_order_quantity: number | null;
  production_lead_time_weeks: number | null;
  port_of_loading: string | null;
  hs_code: string | null;
  certifications: string[];
  target_markets: string[];
  published_at: string | null;
  search_text: string | null;
  primary_image: MarketplaceProductImage | null;
  image_url: string | null;
}

export type MarketplaceSort =
  | "newest"
  | "price_asc"
  | "price_desc"
  | "area_asc"
  | "area_desc";

export interface MarketplaceFilters {
  search: string;
  category: string;
  minBedrooms: string;
  minBathrooms: string;
  minFloorArea: string;
  maxFloorArea: string;
  minPrice: string;
  maxPrice: string;
  targetMarket: string;
  certification: string;
}

export interface MarketplacePagination {
  page: number;
  pageSize: number;
}

export interface MarketplacePageResult {
  products: MarketplaceProduct[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface MarketplaceFilterOptions {
  categories: string[];
  targetMarkets: string[];
  certifications: string[];
}

export type RFQStatus =
  | "draft"
  | "submitted"
  | "manufacturer_review"
  | "quoted"
  | "buyer_review"
  | "accepted"
  | "declined"
  | "expired"
  | "cancelled";

export interface RFQRecord {
  id: string;
  buyer_id: string;
  manufacturer_id: string;
  product_id: string;
  product_snapshot: RFQProductSnapshot;
  status: RFQStatus;
  requested_quantity: number;
  requested_currency: string;
  incoterm: RFQIncoterm | null;
  destination_country: string;
  destination_port: string | null;
  target_delivery_date: string | null;
  buyer_message: string | null;
  created_at: string;
  updated_at: string;
}

export type RFQIncoterm = "FOB" | "CIF" | "EXW" | "DDP" | "DAP";

export interface RFQProductSnapshot {
  model_name?: string;
  name?: string;
  category?: string;
  bedrooms?: number;
  bathrooms?: number;
  floor_area_sq_ft?: number;
  currency?: string;
  fob_price?: number;
  manufacturer_display_name?: string;
  manufacturer_country?: string;
}

export interface RFQWithDetails extends RFQRecord {
  product?: Pick<ProductRecord, "id" | "name" | "model_name" | "category"> | null;
  manufacturer?: Pick<
    ManufacturerApplication,
    "id" | "company_name" | "company_display_name" | "country"
  > | null;
  buyer?: Pick<ProfileRecord, "id" | "full_name" | "email"> | null;
}

export interface RFQMessageRecord {
  id: string;
  rfq_id: string;
  sender_profile_id: string;
  sender_role: Role;
  message: string;
  attachment_path: string | null;
  created_at: string;
}

export interface RFQEventRecord {
  id: string;
  rfq_id: string;
  event_type: string;
  actor_profile_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface RFQFormValues {
  requestedQuantity: string;
  requestedCurrency: string;
  incoterm: string;
  destinationCountry: string;
  destinationPort: string;
  targetDeliveryDate: string;
  buyerMessage: string;
}

export interface ProfileRecord {
  id: string;
  role: Role;
  full_name: string | null;
  email: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ProductMediaUploadInput {
  productId: string;
  manufacturerId: string;
  file: File;
  mediaType: ProductMediaType;
  title?: string;
  altText?: string;
  sortOrder?: number;
  visibility?: ProductMediaVisibility;
}

export interface ProductFormValues {
  sku: string;
  modelName: string;
  slug: string;
  category: string;
  shortDescription: string;
  description: string;
  tags: string;
  intendedUses: string;
  floorAreaSqFt: string;
  bedrooms: string;
  bathrooms: string;
  stories: string;
  lengthFt: string;
  widthFt: string;
  heightFt: string;
  structureMaterial: string;
  exteriorFinish: string;
  roofType: string;
  insulation: string;
  electricalStandard: string;
  plumbingStandard: string;
  windRating: string;
  snowLoadPsf: string;
  currency: string;
  fobPrice: string;
  priceUnit: string;
  minimumOrderQuantity: string;
  productionLeadTimeWeeks: string;
  portOfLoading: string;
  hsCode: string;
  certifications: string;
  targetMarkets: string;
  notes: string;
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
