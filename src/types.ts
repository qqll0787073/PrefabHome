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
  | "revision_requested"
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

export type RFQQuoteStatus =
  | "draft"
  | "submitted"
  | "superseded"
  | "accepted"
  | "rejected"
  | "revision_requested"
  | "expired"
  | "withdrawn";

export type RFQQuoteDecisionValue = "accepted" | "rejected" | "revision_requested";

export type RFQQuoteItemType =
  | "product"
  | "customization"
  | "packaging"
  | "freight"
  | "insurance"
  | "tax"
  | "discount"
  | "other";

export interface RFQQuoteRecord {
  id: string;
  rfq_id: string;
  manufacturer_id: string;
  version: number;
  status: RFQQuoteStatus;
  currency: string;
  unit_price: number | null;
  quantity: number | null;
  subtotal: number;
  incoterm: RFQIncoterm | null;
  origin_port: string | null;
  destination_port: string | null;
  production_lead_days: number | null;
  shipping_lead_days: number | null;
  valid_until: string | null;
  manufacturer_note: string | null;
  created_by: string;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RFQQuoteItemRecord {
  id: string;
  quote_id: string;
  line_order: number;
  item_type: RFQQuoteItemType;
  description: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  amount: number;
  created_at: string;
  updated_at: string;
}

export interface RFQQuoteWithItems extends RFQQuoteRecord {
  items: RFQQuoteItemRecord[];
}

export interface RFQQuoteDecisionRecord {
  id: string;
  rfq_id: string;
  quote_id: string;
  buyer_id: string;
  decision: RFQQuoteDecisionValue;
  reason: string | null;
  created_at: string;
}

export interface RFQQuoteFormValues {
  currency: string;
  incoterm: string;
  originPort: string;
  destinationPort: string;
  productionLeadDays: string;
  shippingLeadDays: string;
  validUntil: string;
  manufacturerNote: string;
}

export interface RFQQuoteItemFormValues {
  lineOrder: string;
  itemType: RFQQuoteItemType;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
}

export type PurchaseOrderStatus =
  | "draft"
  | "submitted"
  | "manufacturer_review"
  | "revision_requested"
  | "confirmed"
  | "rejected"
  | "cancelled";

export type PurchaseOrderDecisionValue = "confirmed" | "rejected" | "revision_requested";

export interface PurchaseOrderRecord {
  id: string;
  po_number: string;
  rfq_id: string;
  quote_id: string;
  quote_decision_id: string;
  buyer_id: string;
  manufacturer_id: string;
  status: PurchaseOrderStatus;
  currency: string;
  subtotal: number;
  incoterm: RFQIncoterm | null;
  origin_port: string | null;
  destination_port: string | null;
  production_lead_days: number | null;
  shipping_lead_days: number | null;
  requested_delivery_date: string | null;
  buyer_reference: string | null;
  buyer_note: string | null;
  quote_snapshot: Record<string, unknown>;
  buyer_snapshot: Record<string, unknown>;
  manufacturer_snapshot: Record<string, unknown>;
  product_snapshot: RFQProductSnapshot;
  created_by: string;
  submitted_at: string | null;
  last_submitted_at: string | null;
  cancelled_at: string | null;
  confirmed_at: string | null;
  rejected_at: string | null;
  review_round: number;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderDecisionRecord {
  id: string;
  purchase_order_id: string;
  review_round: number;
  manufacturer_id: string;
  actor_profile_id: string;
  decision: PurchaseOrderDecisionValue;
  reason: string | null;
  created_at: string;
}

export interface PurchaseOrderItemRecord {
  id: string;
  purchase_order_id: string;
  source_quote_item_id: string | null;
  line_order: number;
  item_type: RFQQuoteItemType;
  description: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  amount: number;
  created_at: string;
}

export interface PurchaseOrderEventRecord {
  id: string;
  purchase_order_id: string;
  event_type:
    | "po_created"
    | "po_submitted"
    | "po_cancelled"
    | "po_manufacturer_opened"
    | "po_confirmed"
    | "po_rejected"
    | "po_revision_requested"
    | "po_resubmitted";
  actor_profile_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface PurchaseOrderWithItems extends PurchaseOrderRecord {
  items: PurchaseOrderItemRecord[];
}

export interface PurchaseOrderDraftValues {
  buyerReference: string;
  buyerNote: string;
  requestedDeliveryDate: string;
}

export type ContractStatus =
  | "draft"
  | "ready"
  | "participant_review"
  | "revision_requested"
  | "accepted"
  | "rejected";

export type ContractEventType =
  | "contract_created"
  | "contract_updated"
  | "contract_ready"
  | "contract_participant_opened"
  | "contract_revision_requested"
  | "contract_resubmitted"
  | "contract_accepted"
  | "contract_rejected";

export type ContractReviewDecisionValue = "accepted" | "rejected" | "revision_requested";

export interface ContractRecord {
  id: string;
  contract_number: string;
  purchase_order_id: string;
  po_number: string;
  rfq_id: string;
  quote_id: string;
  quote_decision_id: string;
  buyer_id: string;
  manufacturer_id: string;
  status: ContractStatus;
  currency: string;
  subtotal: number;
  contract_title: string | null;
  governing_law: string | null;
  contract_terms: string | null;
  buyer_reference: string | null;
  buyer_note: string | null;
  purchase_order_snapshot: Record<string, unknown>;
  buyer_snapshot: Record<string, unknown>;
  manufacturer_snapshot: Record<string, unknown>;
  quote_snapshot: Record<string, unknown>;
  product_snapshot: Record<string, unknown>;
  line_items_snapshot: Array<Record<string, unknown>>;
  created_by: string;
  ready_at: string | null;
  review_round: number;
  first_ready_at: string | null;
  last_ready_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContractReviewDecisionRecord {
  id: string;
  contract_id: string;
  review_round: number;
  manufacturer_id: string;
  actor_profile_id: string;
  decision: ContractReviewDecisionValue;
  reason: string | null;
  created_at: string;
}

export interface ContractEventRecord {
  id: string;
  contract_id: string;
  event_type: ContractEventType;
  actor_profile_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ContractDraftValues {
  contractTitle: string;
  governingLaw: string;
  contractTerms: string;
}

export type SignaturePackageStatus = "draft" | "ready_to_send";

export type SignatureParticipantRole = "buyer_signer" | "manufacturer_signer";

export type SignatureParticipantStatus = "pending";

export type SignaturePackageEventType =
  | "signature_package_created"
  | "signature_participant_updated"
  | "signature_package_ready";

export interface SignaturePackageRecord {
  id: string;
  package_number: string;
  contract_id: string;
  contract_number: string;
  buyer_id: string;
  manufacturer_id: string;
  status: SignaturePackageStatus;
  version: number;
  contract_snapshot: Record<string, unknown>;
  buyer_snapshot: Record<string, unknown>;
  manufacturer_snapshot: Record<string, unknown>;
  decision_snapshot: Record<string, unknown>;
  signing_content_snapshot: Record<string, unknown>;
  created_by: string;
  ready_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SignatureParticipantRecord {
  id: string;
  signature_package_id: string;
  participant_role: SignatureParticipantRole;
  profile_id: string | null;
  organization_id: string | null;
  full_name: string | null;
  email: string | null;
  title: string | null;
  signing_order: number;
  status: SignatureParticipantStatus;
  created_at: string;
  updated_at: string;
}

export interface SignaturePackageEventRecord {
  id: string;
  signature_package_id: string;
  event_type: SignaturePackageEventType;
  actor_profile_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SignatureParticipantValues {
  fullName: string;
  email: string;
  title: string;
}

export type SignatureDeliveryStatus = "delivery_draft" | "queued" | "cancelled";

export type SignatureDeliveryProviderKey = "unconfigured";

export type SignatureDeliveryRecipientStatus = "pending";

export type SignatureDeliveryEventType =
  | "signature_delivery_created"
  | "signature_delivery_queued"
  | "signature_delivery_cancelled";

export interface SignatureDeliveryRequestRecord {
  id: string;
  delivery_number: string;
  signature_package_id: string;
  package_number: string;
  contract_id: string;
  contract_number: string;
  buyer_id: string;
  manufacturer_id: string;
  status: SignatureDeliveryStatus;
  provider_key: SignatureDeliveryProviderKey;
  package_snapshot: Record<string, unknown>;
  recipient_snapshot: unknown[];
  request_payload_snapshot: Record<string, unknown>;
  created_by: string;
  queued_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface SignatureDeliveryRecipientRecord {
  id: string;
  delivery_request_id: string;
  source_participant_id: string;
  participant_role: SignatureParticipantRole;
  profile_id: string | null;
  organization_id: string | null;
  full_name: string;
  email: string;
  title: string | null;
  signing_order: number;
  delivery_status: SignatureDeliveryRecipientStatus;
  created_at: string;
}

export interface SignatureDeliveryEventRecord {
  id: string;
  delivery_request_id: string;
  event_type: SignatureDeliveryEventType;
  actor_profile_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type InvoiceStatus = "draft" | "issued" | "cancelled";

export type InvoiceEventType =
  | "invoice_created"
  | "invoice_updated"
  | "invoice_issued"
  | "invoice_cancelled";

export interface InvoiceRecord {
  id: string;
  invoice_number: string;
  contract_id: string;
  contract_number: string;
  purchase_order_id: string;
  purchase_order_number: string;
  buyer_id: string;
  manufacturer_id: string;
  status: InvoiceStatus;
  version: number;
  currency: string;
  subtotal: number;
  tax_amount: number;
  shipping_amount: number;
  discount_amount: number;
  total_amount: number;
  issue_date: string | null;
  due_date: string | null;
  billing_name: string | null;
  billing_email: string | null;
  billing_address: Record<string, unknown> | null;
  contract_snapshot: Record<string, unknown>;
  purchase_order_snapshot: Record<string, unknown>;
  buyer_snapshot: Record<string, unknown>;
  manufacturer_snapshot: Record<string, unknown>;
  line_items_snapshot: Array<Record<string, unknown>>;
  amount_snapshot: Record<string, unknown>;
  created_by: string;
  issued_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceLineItemRecord {
  id: string;
  invoice_id: string;
  line_number: number;
  source_po_item_id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  line_subtotal: number;
  created_at: string;
}

export interface InvoiceEventRecord {
  id: string;
  invoice_id: string;
  event_type: InvoiceEventType;
  actor_profile_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface InvoiceDraftValues {
  issueDate: string;
  dueDate: string;
  billingName: string;
  billingEmail: string;
  billingAddress: string;
  taxAmount: string;
  shippingAmount: string;
  discountAmount: string;
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
