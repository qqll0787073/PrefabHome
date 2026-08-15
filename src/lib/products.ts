import { supabase } from "./supabase";
import type {
  ProductFormValues,
  ProductLifecycleStatus,
  ProductRecord,
  PublicProductRecord,
} from "../types";

export const productStatuses: ProductLifecycleStatus[] = [
  "draft",
  "submitted",
  "published",
  "rejected",
  "archived",
];

export const manufacturerEditableProductStatuses: ProductLifecycleStatus[] = [
  "draft",
  "rejected",
];

export const manufacturerSubmittableProductStatuses: ProductLifecycleStatus[] = [
  "draft",
  "rejected",
];

export type ManufacturerProductSort = "updated" | "name" | "created";

export function selectManufacturerProducts(
  products: ProductRecord[],
  search: string,
  status: ProductLifecycleStatus | "all",
  sort: ManufacturerProductSort,
): ProductRecord[] {
  const term = search.trim().toLocaleLowerCase();
  return products.filter((product) => {
    const matchesStatus = status === "all" || product.status === status;
    const haystack = [product.name, product.model_name, product.sku, product.category]
      .filter(Boolean).join(" ").toLocaleLowerCase();
    return matchesStatus && (!term || haystack.includes(term));
  }).sort((left, right) => {
    if (sort === "name") return (left.model_name || left.name).localeCompare(right.model_name || right.name) || left.id.localeCompare(right.id);
    const field = sort === "created" ? "created_at" : "updated_at";
    const leftDate = Date.parse(left[field]);
    const rightDate = Date.parse(right[field]);
    return (Number.isFinite(rightDate) ? rightDate : 0) - (Number.isFinite(leftDate) ? leftDate : 0) || left.id.localeCompare(right.id);
  });
}

export const productStatusLabels: Record<ProductLifecycleStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  published: "Published",
  rejected: "Rejected",
  archived: "Archived",
};

export function getAllowedAdminProductTransitions(
  currentStatus: ProductLifecycleStatus
): ProductLifecycleStatus[] {
  switch (currentStatus) {
    case "submitted":
      return ["published", "rejected"];
    case "published":
      return ["archived"];
    case "rejected":
      return ["draft"];
    case "draft":
    case "archived":
      return [];
  }
}

export function emptyProductForm(): ProductFormValues {
  return {
    sku: "",
    modelName: "",
    slug: "",
    category: "",
    shortDescription: "",
    description: "",
    tags: "",
    intendedUses: "",
    floorAreaSqFt: "",
    bedrooms: "",
    bathrooms: "",
    stories: "",
    lengthFt: "",
    widthFt: "",
    heightFt: "",
    structureMaterial: "",
    exteriorFinish: "",
    roofType: "",
    insulation: "",
    electricalStandard: "",
    plumbingStandard: "",
    windRating: "",
    snowLoadPsf: "",
    currency: "USD",
    fobPrice: "",
    priceUnit: "",
    minimumOrderQuantity: "",
    productionLeadTimeWeeks: "",
    portOfLoading: "",
    hsCode: "",
    certifications: "",
    targetMarkets: "",
    notes: "",
  };
}

export function productFormFromRecord(product: ProductRecord): ProductFormValues {
  return {
    sku: product.sku ?? "",
    modelName: product.model_name ?? product.name,
    slug: product.slug ?? "",
    category: product.category,
    shortDescription: product.short_description ?? "",
    description: product.description ?? "",
    tags: product.tags.join(", "),
    intendedUses: product.intended_uses.join(", "),
    floorAreaSqFt: product.floor_area_sq_ft?.toString() ?? "",
    bedrooms: product.bedrooms?.toString() ?? "",
    bathrooms: product.bathrooms?.toString() ?? "",
    stories: product.stories?.toString() ?? "",
    lengthFt: product.length_ft?.toString() ?? "",
    widthFt: product.width_ft?.toString() ?? "",
    heightFt: product.height_ft?.toString() ?? "",
    structureMaterial: product.structure_material ?? "",
    exteriorFinish: product.exterior_finish ?? "",
    roofType: product.roof_type ?? "",
    insulation: product.insulation ?? "",
    electricalStandard: product.electrical_standard ?? "",
    plumbingStandard: product.plumbing_standard ?? "",
    windRating: product.wind_rating ?? "",
    snowLoadPsf: product.snow_load_psf?.toString() ?? "",
    currency: product.currency,
    fobPrice: product.fob_price?.toString() ?? "",
    priceUnit: product.price_unit ?? "",
    minimumOrderQuantity: product.minimum_order_quantity?.toString() ?? "",
    productionLeadTimeWeeks: product.production_lead_time_weeks?.toString() ?? "",
    portOfLoading: product.port_of_loading ?? "",
    hsCode: product.hs_code ?? "",
    certifications: product.certifications.join(", "),
    targetMarkets: product.target_markets.join(", "),
    notes: product.notes ?? "",
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

function optionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return Number(trimmed);
}

function optionalInteger(value: string): number | null {
  const numericValue = optionalNumber(value);
  if (numericValue === null) return null;
  return Number.isInteger(numericValue) ? numericValue : Number.NaN;
}

function productName(values: ProductFormValues): string {
  return values.modelName.trim() || "Untitled product draft";
}

export function validateProductDraft(values: ProductFormValues): string[] {
  return validateProductForm(values, { requireComplete: false });
}

export function validateProductForSubmit(values: ProductFormValues): string[] {
  return validateProductForm(values, { requireComplete: true });
}

function validateProductForm(
  values: ProductFormValues,
  options: { requireComplete: boolean }
): string[] {
  const errors: string[] = [];

  if (options.requireComplete) {
    if (!values.modelName.trim()) errors.push("Model name is required.");
    if (!values.category.trim()) errors.push("Category is required.");
    if (!values.description.trim()) errors.push("Description is required.");
  }

  const nonNegativeFields: Array<[string, string, number | null]> = [
    ["FOB price", values.fobPrice, optionalNumber(values.fobPrice)],
    ["Floor area", values.floorAreaSqFt, optionalNumber(values.floorAreaSqFt)],
    ["Bedrooms", values.bedrooms, optionalInteger(values.bedrooms)],
    ["Bathrooms", values.bathrooms, optionalNumber(values.bathrooms)],
    ["Stories", values.stories, optionalInteger(values.stories)],
    ["Length", values.lengthFt, optionalNumber(values.lengthFt)],
    ["Width", values.widthFt, optionalNumber(values.widthFt)],
    ["Height", values.heightFt, optionalNumber(values.heightFt)],
    ["Snow load", values.snowLoadPsf, optionalNumber(values.snowLoadPsf)],
    ["Production lead time", values.productionLeadTimeWeeks, optionalInteger(values.productionLeadTimeWeeks)],
  ];

  for (const [label, raw, value] of nonNegativeFields) {
    if (raw.trim() && (!Number.isFinite(value) || value === null || value < 0)) {
      errors.push(`${label} must be a non-negative number.`);
    }
  }

  const moq = optionalInteger(values.minimumOrderQuantity);
  if (values.minimumOrderQuantity.trim() && (!Number.isFinite(moq) || moq === null || moq < 1)) {
    errors.push("Minimum order quantity must be at least 1.");
  }

  if (values.currency.trim() && !/^[A-Za-z]{3}$/.test(values.currency.trim())) {
    errors.push("Currency must be a 3-letter code.");
  }

  if (values.slug.trim() && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug.trim())) {
    errors.push("Slug must contain lowercase letters, numbers, and single hyphens only.");
  }

  const textLimits: Array<[string, string, number]> = [
    ["Model name", values.modelName, 200],
    ["Category", values.category, 120],
    ["Short description", values.shortDescription, 500],
    ["Description", values.description, 5000],
    ["Private notes", values.notes, 5000],
  ];
  for (const [label, value, limit] of textLimits) {
    if (value.length > limit) errors.push(`${label} must be ${limit} characters or fewer.`);
  }

  const listLimits: Array<[string, string]> = [
    ["Tags", values.tags], ["Intended uses", values.intendedUses],
    ["Certifications", values.certifications], ["Target markets", values.targetMarkets],
  ];
  for (const [label, value] of listLimits) {
    if (listFromText(value).length > 50) errors.push(`${label} must contain 50 items or fewer.`);
  }

  return errors;
}

export function toProductPayload(values: ProductFormValues) {
  const modelName = productName(values);
  return {
    name: modelName,
    model_name: modelName,
    sku: optionalText(values.sku),
    slug: optionalText(values.slug),
    category: values.category.trim() || "Uncategorized",
    short_description: optionalText(values.shortDescription),
    description: optionalText(values.description),
    tags: listFromText(values.tags),
    intended_uses: listFromText(values.intendedUses),
    floor_area_sq_ft: optionalNumber(values.floorAreaSqFt),
    bedrooms: optionalInteger(values.bedrooms),
    bathrooms: optionalNumber(values.bathrooms),
    stories: optionalInteger(values.stories),
    length_ft: optionalNumber(values.lengthFt),
    width_ft: optionalNumber(values.widthFt),
    height_ft: optionalNumber(values.heightFt),
    structure_material: optionalText(values.structureMaterial),
    exterior_finish: optionalText(values.exteriorFinish),
    roof_type: optionalText(values.roofType),
    insulation: optionalText(values.insulation),
    electrical_standard: optionalText(values.electricalStandard),
    plumbing_standard: optionalText(values.plumbingStandard),
    wind_rating: optionalText(values.windRating),
    snow_load_psf: optionalNumber(values.snowLoadPsf),
    currency: values.currency.trim().toUpperCase() || "USD",
    fob_price: optionalNumber(values.fobPrice),
    price_unit: optionalText(values.priceUnit),
    minimum_order_quantity: optionalInteger(values.minimumOrderQuantity),
    production_lead_time_weeks: optionalInteger(values.productionLeadTimeWeeks),
    port_of_loading: optionalText(values.portOfLoading),
    hs_code: optionalText(values.hsCode),
    certifications: listFromText(values.certifications),
    target_markets: listFromText(values.targetMarkets),
    notes: optionalText(values.notes),
    base_price: optionalNumber(values.fobPrice),
    size_sqft: optionalInteger(values.floorAreaSqFt),
    lead_time_weeks: optionalInteger(values.productionLeadTimeWeeks),
  };
}

export function toReadableProductError(error: { code?: string; message?: string }): Error {
  const message = error.message?.toLowerCase() ?? "";

  if (error.code === "23505" && message.includes("products_manufacturer_sku_key")) {
    return new Error("A product with this SKU already exists for this manufacturer.");
  }

  if (error.code === "23505" && message.includes("products_slug_key")) {
    return new Error("A product with this slug already exists.");
  }

  if (message.includes("approved before creating products")) {
    return new Error("Only approved manufacturers can create products.");
  }

  if (message.includes("draft or rejected")) {
    return new Error("This product is locked. Only draft or rejected products can be edited or submitted.");
  }

  if (message.includes("only submit")) {
    return new Error("Invalid product status transition.");
  }

  if (message.includes("invalid admin product lifecycle transition")) {
    return new Error("Invalid admin product status transition.");
  }

  if (message.includes("permission denied") || message.includes("violates row-level security")) {
    return new Error("You are not authorized to access this product.");
  }

  if (message.includes("field limit") || message.includes("invalid product")) {
    return new Error("One or more Product fields are invalid.");
  }
  if (message.includes("product unavailable")) return new Error("Product unavailable.");
  return new Error("Unable to save Product. Please try again.");
}

function ensureSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

export async function fetchPublishedProducts(): Promise<PublicProductRecord[]> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from("published_products")
    .select("id,manufacturer_id,name,sku,model_name,slug,category,short_description,description,tags,intended_uses,floor_area_sq_ft,bedrooms,bathrooms,stories,length_ft,width_ft,height_ft,structure_material,exterior_finish,roof_type,insulation,electrical_standard,plumbing_standard,wind_rating,snow_load_psf,currency,fob_price,price_unit,minimum_order_quantity,production_lead_time_weeks,port_of_loading,hs_code,certifications,target_markets,published_at,status,created_at,updated_at")
    .order("published_at", { ascending: false });

  if (error) throw toReadableProductError(error);
  return (data ?? []) as PublicProductRecord[];
}

export async function fetchOwnProducts(ownerId: string): Promise<ProductRecord[]> {
  const client = ensureSupabase();
  const { data: identity, error: identityError } = await client.auth.getUser();
  if (identityError || !identity.user || identity.user.id !== ownerId) throw new Error("Manufacturer sign-in required.");
  const { data, error } = await client.rpc("get_my_manufacturer_products");
  if (error) throw toReadableProductError(error);
  return (data ?? []).map((row: any) => ({
    ...row,
    review_notes: null,
    reviewed_by: null,
    reviewed_at: null,
  })) as ProductRecord[];
}

export async function fetchAllProductsForAdmin(): Promise<ProductRecord[]> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from("products")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw toReadableProductError(error);
  return (data ?? []) as ProductRecord[];
}

export async function fetchProductById(productId: string): Promise<ProductRecord | null> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from("products")
    .select("*")
    .eq("id", productId)
    .maybeSingle();

  if (error) throw toReadableProductError(error);
  return data as ProductRecord | null;
}

export async function createProductDraft(
  _manufacturerId: string,
  values: ProductFormValues,
  status: Extract<ProductLifecycleStatus, "draft" | "submitted"> = "draft"
): Promise<ProductRecord> {
  return saveManufacturerProduct(null, values, status === "submitted");
}

export async function updateProductDraft(
  productId: string,
  values: ProductFormValues
): Promise<ProductRecord> {
  return saveManufacturerProduct(productId, values, false);
}

export async function submitProduct(
  productId: string,
  values: ProductFormValues
): Promise<ProductRecord> {
  return saveManufacturerProduct(productId, values, true);
}

async function saveManufacturerProduct(productId: string | null, values: ProductFormValues, submit: boolean): Promise<ProductRecord> {
  const client = ensureSupabase();
  const payload = toProductPayload(values);
  const { data, error } = await client.rpc("save_my_manufacturer_product", {
    product_uuid: productId,
    sku_text: values.sku,
    model_name_text: values.modelName,
    slug_text: values.slug,
    category_text: values.category,
    short_description_text: values.shortDescription,
    description_text: values.description,
    tags_value: payload.tags,
    intended_uses_value: payload.intended_uses,
    floor_area_value: payload.floor_area_sq_ft,
    bedrooms_value: payload.bedrooms,
    bathrooms_value: payload.bathrooms,
    stories_value: payload.stories,
    length_value: payload.length_ft,
    width_value: payload.width_ft,
    height_value: payload.height_ft,
    structure_material_text: values.structureMaterial,
    exterior_finish_text: values.exteriorFinish,
    roof_type_text: values.roofType,
    insulation_text: values.insulation,
    electrical_standard_text: values.electricalStandard,
    plumbing_standard_text: values.plumbingStandard,
    wind_rating_text: values.windRating,
    snow_load_value: payload.snow_load_psf,
    currency_text: values.currency,
    fob_price_value: payload.fob_price,
    price_unit_text: values.priceUnit,
    minimum_order_quantity_value: payload.minimum_order_quantity,
    production_lead_time_value: payload.production_lead_time_weeks,
    port_of_loading_text: values.portOfLoading,
    hs_code_text: values.hsCode,
    certifications_value: payload.certifications,
    target_markets_value: payload.target_markets,
    notes_text: values.notes,
    submit_product: submit,
  });
  if (error) throw toReadableProductError(error);
  const products = await fetchOwnProducts((await client.auth.getUser()).data.user?.id ?? "");
  const saved = products.find((product) => product.id === data);
  if (!saved) throw new Error("Unable to reload Product.");
  return saved;
}

export async function adminReviewProduct(
  productId: string,
  currentStatus: ProductLifecycleStatus,
  status: ProductLifecycleStatus,
  reviewNotes: string
): Promise<ProductRecord> {
  const allowedStatuses = getAllowedAdminProductTransitions(currentStatus);
  if (status !== currentStatus && !allowedStatuses.includes(status)) {
    throw new Error("Invalid admin product status transition.");
  }

  const client = ensureSupabase();
  const { data, error } = await client
    .from("products")
    .update({
      status,
      review_notes: reviewNotes.trim() || null,
    })
    .eq("id", productId)
    .select("*")
    .single();

  if (error) throw toReadableProductError(error);
  return data as ProductRecord;
}

export async function archiveProduct(
  productId: string,
  currentStatus: ProductLifecycleStatus
): Promise<ProductRecord> {
  return adminReviewProduct(productId, currentStatus, "archived", "Archived by admin.");
}
