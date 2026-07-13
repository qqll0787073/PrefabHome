import { products as demoProducts } from "../data";
import type {
  MarketplaceFilterOptions,
  MarketplaceFilters,
  MarketplacePageResult,
  MarketplacePagination,
  MarketplaceProduct,
  MarketplaceProductImage,
  MarketplaceSort,
  PublicProductMediaRecord,
} from "../types";
import { createSignedPublicImageUrl, productImageBucket } from "./productMedia";
import { isSupabaseConfigured, supabase } from "./supabase";

type MarketplaceProductRow = {
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
  primary_media_id: string | null;
  primary_media_type: MarketplaceProductImage["media_type"] | null;
  primary_storage_bucket: string | null;
  primary_storage_path: string | null;
  primary_original_filename: string | null;
  primary_mime_type: string | null;
  primary_title: string | null;
  primary_alt_text: string | null;
  primary_sort_order: number | null;
  primary_is_primary: boolean | null;
};

export const marketplacePageSize = 12;
export const marketplaceMaxPageSize = 24;
export const marketplaceSignedUrlTtlSeconds = 60 * 10;

export const defaultMarketplaceFilters: MarketplaceFilters = {
  search: "",
  category: "",
  minBedrooms: "",
  minBathrooms: "",
  minFloorArea: "",
  maxFloorArea: "",
  minPrice: "",
  maxPrice: "",
  targetMarket: "",
  certification: "",
};

export const marketplaceSortLabels: Record<MarketplaceSort, string> = {
  newest: "Newest published",
  price_asc: "Price low to high",
  price_desc: "Price high to low",
  area_asc: "Floor area low to high",
  area_desc: "Floor area high to low",
};

const marketplaceEnv = (import.meta as ImportMeta & {
  env?: Record<string, string | undefined>;
}).env;

function nodeEnvValue(name: string): string | undefined {
  return typeof process !== "undefined"
    ? (process.env as Record<string, string | undefined>)[name]
    : undefined;
}

export function isMarketplaceDemoModeEnabled(
  env: Record<string, string | undefined> | undefined = marketplaceEnv
): boolean {
  return (env?.VITE_ENABLE_MARKETPLACE_DEMO ?? nodeEnvValue("VITE_ENABLE_MARKETPLACE_DEMO") ?? "")
    .trim()
    .toLowerCase() === "true";
}

export function isMarketplaceDemoActive(): boolean {
  return !isSupabaseConfigured && isMarketplaceDemoModeEnabled();
}

function ensureMarketplaceDataSource() {
  if (isSupabaseConfigured && supabase) return supabase;
  if (isMarketplaceDemoModeEnabled()) return null;
  throw new Error(
    "Marketplace Supabase configuration is missing. Configure Supabase or enable VITE_ENABLE_MARKETPLACE_DEMO=true for local development only."
  );
}

export function toReadableMarketplaceError(error: { message?: string }): Error {
  const message = error.message?.toLowerCase() ?? "";
  if (message.includes("permission denied") || message.includes("row-level security")) {
    return new Error("Marketplace data is not available for this session.");
  }
  if (message.includes("failed to fetch") || message.includes("network")) {
    return new Error("Marketplace data could not be loaded. Check your connection and try again.");
  }
  return new Error(error.message ?? "Marketplace data could not be loaded.");
}

export function marketplaceManufacturerCountry(product: MarketplaceProduct): string {
  return product.manufacturer_country ?? "";
}

export function marketplaceProductSlug(product: Pick<MarketplaceProduct, "id" | "slug">): string {
  return product.slug || product.id;
}

export function calculateTotalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function paginationRange(page: number, pageSize: number) {
  const safePage = Math.max(1, page);
  const safePageSize = sanitizeMarketplacePageSize(pageSize);
  const from = (safePage - 1) * safePageSize;
  return { from, to: from + safePageSize - 1 };
}

export function sanitizeMarketplacePageSize(pageSize: number | undefined): number {
  if (!pageSize || !Number.isFinite(pageSize)) return marketplacePageSize;
  return Math.min(marketplaceMaxPageSize, Math.max(1, Math.floor(pageSize)));
}

export function normalizeMarketplaceFilters(
  filters: Partial<MarketplaceFilters>
): MarketplaceFilters {
  return {
    ...defaultMarketplaceFilters,
    ...filters,
  };
}

export function marketplaceFiltersKey(filters: MarketplaceFilters): string {
  return JSON.stringify(filters);
}

export function marketplaceFilterPayload(filters: MarketplaceFilters) {
  const normalized = normalizeMarketplaceFilters(filters);
  return {
    search: normalized.search.trim(),
    category: normalized.category.trim(),
    minBedrooms: positiveNumber(normalized.minBedrooms),
    minBathrooms: positiveNumber(normalized.minBathrooms),
    minFloorArea: positiveNumber(normalized.minFloorArea),
    maxFloorArea: positiveNumber(normalized.maxFloorArea),
    minPrice: positiveNumber(normalized.minPrice),
    maxPrice: positiveNumber(normalized.maxPrice),
    targetMarket: normalized.targetMarket.trim(),
    certification: normalized.certification.trim(),
  };
}

export function marketplaceSortOrder(sort: MarketplaceSort) {
  switch (sort) {
    case "price_asc":
      return { column: "fob_price", ascending: true, nullsFirst: false };
    case "price_desc":
      return { column: "fob_price", ascending: false, nullsFirst: false };
    case "area_asc":
      return { column: "floor_area_sq_ft", ascending: true, nullsFirst: false };
    case "area_desc":
      return { column: "floor_area_sq_ft", ascending: false, nullsFirst: false };
    case "newest":
      return { column: "published_at", ascending: false, nullsFirst: false };
  }
}

export function mapMarketplaceProduct(row: MarketplaceProductRow): MarketplaceProduct {
  const primaryImage =
    row.primary_media_id &&
    row.primary_media_type &&
    row.primary_storage_bucket === productImageBucket &&
    row.primary_storage_path
      ? {
          id: row.primary_media_id,
          product_id: row.id,
          media_type: row.primary_media_type,
          storage_bucket: row.primary_storage_bucket,
          storage_path: row.primary_storage_path,
          original_filename: row.primary_original_filename,
          mime_type: row.primary_mime_type,
          title: row.primary_title,
          alt_text: row.primary_alt_text,
          sort_order: row.primary_sort_order ?? 0,
          is_primary: row.primary_is_primary ?? false,
          signed_url: null,
        }
      : null;

  return {
    id: row.id,
    manufacturer_id: row.manufacturer_id,
    manufacturer_display_name: row.manufacturer_display_name,
    manufacturer_country: row.manufacturer_country,
    name: row.name,
    model_name: row.model_name,
    slug: row.slug,
    category: row.category,
    short_description: row.short_description,
    description: row.description,
    tags: row.tags ?? [],
    intended_uses: row.intended_uses ?? [],
    floor_area_sq_ft: row.floor_area_sq_ft,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    stories: row.stories,
    length_ft: row.length_ft,
    width_ft: row.width_ft,
    height_ft: row.height_ft,
    structure_material: row.structure_material,
    exterior_finish: row.exterior_finish,
    roof_type: row.roof_type,
    insulation: row.insulation,
    electrical_standard: row.electrical_standard,
    plumbing_standard: row.plumbing_standard,
    wind_rating: row.wind_rating,
    snow_load_psf: row.snow_load_psf,
    currency: row.currency,
    fob_price: row.fob_price,
    price_unit: row.price_unit,
    minimum_order_quantity: row.minimum_order_quantity,
    production_lead_time_weeks: row.production_lead_time_weeks,
    port_of_loading: row.port_of_loading,
    hs_code: row.hs_code,
    certifications: row.certifications ?? [],
    target_markets: row.target_markets ?? [],
    published_at: row.published_at,
    search_text: row.search_text,
    primary_image: primaryImage,
    image_url: null,
  };
}

export async function resolveMarketplaceImageUrls(
  images: MarketplaceProductImage[],
  concurrency = 4
): Promise<MarketplaceProductImage[]> {
  const resolved: MarketplaceProductImage[] = [];
  for (let index = 0; index < images.length; index += concurrency) {
    const chunk = images.slice(index, index + concurrency);
    const chunkResults = await Promise.all(
      chunk.map(async (image) => {
        try {
          const signedUrl = await createSignedPublicImageUrl(
            toPublicMediaRecord(image),
            marketplaceSignedUrlTtlSeconds
          );
          return { ...image, signed_url: signedUrl };
        } catch {
          return { ...image, signed_url: null };
        }
      })
    );
    resolved.push(...chunkResults);
  }
  return resolved;
}

export async function fetchMarketplaceProducts(
  filters: Partial<MarketplaceFilters> = {},
  pagination: Partial<MarketplacePagination> = {},
  sort: MarketplaceSort = "newest"
): Promise<MarketplacePageResult> {
  const client = ensureMarketplaceDataSource();
  if (!client) {
    return demoMarketplaceProducts(filters, pagination, sort);
  }

  const page = Math.max(1, pagination.page ?? 1);
  const pageSize = sanitizeMarketplacePageSize(pagination.pageSize);
  const { from, to } = paginationRange(page, pageSize);
  const payload = marketplaceFilterPayload(normalizeMarketplaceFilters(filters));
  let query = client
    .from("marketplace_products")
    .select(marketplaceProductSelect, { count: "exact" });

  query = applyMarketplaceFilters(query, payload);

  const order = marketplaceSortOrder(sort);
  const { data, error, count } = await query
    .order(order.column, { ascending: order.ascending, nullsFirst: order.nullsFirst })
    .order("id", { ascending: true })
    .range(from, to);

  if (error) throw toReadableMarketplaceError(error);

  const products = (data ?? []).map((row) =>
    mapMarketplaceProduct(row as unknown as MarketplaceProductRow)
  );
  const images = await resolveMarketplaceImageUrls(
    products.flatMap((product) => (product.primary_image ? [product.primary_image] : []))
  );
  const imagesByProduct = new Map(images.map((image) => [image.product_id, image]));
  const productsWithImages = products.map((product) => {
    const image = imagesByProduct.get(product.id) ?? null;
    return {
      ...product,
      primary_image: image,
      image_url: image?.signed_url ?? null,
    };
  });

  return {
    products: productsWithImages,
    total: count ?? productsWithImages.length,
    page,
    pageSize,
    totalPages: calculateTotalPages(count ?? productsWithImages.length, pageSize),
  };
}

export async function fetchMarketplaceProductBySlug(
  slug: string
): Promise<MarketplaceProduct | null> {
  const client = ensureMarketplaceDataSource();
  if (!client) {
    const demo = demoMarketplaceRows()
      .map(mapMarketplaceProduct)
      .find((product) => marketplaceProductSlug(product) === slug);
    return demo ? withDemoImage(demo) : null;
  }

  const { data, error } = await client
    .from("marketplace_products")
    .select(marketplaceProductSelect)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw toReadableMarketplaceError(error);
  if (!data) return fetchMarketplaceProductById(slug);
  return resolveSingleMarketplaceProduct(mapMarketplaceProduct(data as unknown as MarketplaceProductRow));
}

export async function fetchMarketplaceProductById(id: string): Promise<MarketplaceProduct | null> {
  const client = ensureMarketplaceDataSource();
  if (!client) {
    const demo = demoMarketplaceRows()
      .map(mapMarketplaceProduct)
      .find((product) => product.id === id);
    return demo ? withDemoImage(demo) : null;
  }

  const { data, error } = await client
    .from("marketplace_products")
    .select(marketplaceProductSelect)
    .eq("id", id)
    .maybeSingle();

  if (error) throw toReadableMarketplaceError(error);
  if (!data) return null;
  return resolveSingleMarketplaceProduct(mapMarketplaceProduct(data as unknown as MarketplaceProductRow));
}

export async function fetchMarketplaceProductImages(
  productId: string,
  cachedImages: MarketplaceProductImage[] = []
): Promise<MarketplaceProductImage[]> {
  const client = ensureMarketplaceDataSource();
  if (!client) return [];

  const { data, error } = await client
    .from("published_product_media")
    .select("id,product_id,media_type,storage_bucket,storage_path,original_filename,mime_type,title,alt_text,sort_order,is_primary,visibility,created_at")
    .eq("product_id", productId)
    .order("is_primary", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw toReadableMarketplaceError(error);

  const cachedById = new Map(cachedImages.map((image) => [image.id, image]));
  const images = ((data ?? []) as PublicProductMediaRecord[])
    .filter((item) => item.storage_bucket === productImageBucket)
    .map((item) => ({
      id: item.id,
      product_id: item.product_id,
      media_type: item.media_type,
      storage_bucket: item.storage_bucket,
      storage_path: item.storage_path,
      original_filename: item.original_filename,
      mime_type: item.mime_type,
      title: item.title,
      alt_text: item.alt_text,
      sort_order: item.sort_order,
      is_primary: item.is_primary,
      signed_url: null,
    }));

  const reusedImages = images.map((image) => {
    const cached = cachedById.get(image.id);
    return cached?.signed_url ? { ...image, signed_url: cached.signed_url } : image;
  });
  const unresolvedImages = reusedImages.filter((image) => !image.signed_url);
  const resolvedImages = await resolveMarketplaceImageUrls(unresolvedImages);
  const resolvedById = new Map(resolvedImages.map((image) => [image.id, image]));
  return reusedImages.map((image) => resolvedById.get(image.id) ?? image);
}

export async function fetchMarketplaceFilterOptions(): Promise<MarketplaceFilterOptions> {
  const client = ensureMarketplaceDataSource();
  if (!client) {
    const rows = demoMarketplaceRows();
    return optionsFromProducts(rows.map(mapMarketplaceProduct));
  }

  const { data, error } = await client
    .from("marketplace_products")
    .select("category,target_markets,certifications");

  if (error) throw toReadableMarketplaceError(error);
  return optionsFromProducts((data ?? []) as MarketplaceProduct[]);
}

async function resolveSingleMarketplaceProduct(
  product: MarketplaceProduct
): Promise<MarketplaceProduct> {
  const [image] = await resolveMarketplaceImageUrls(product.primary_image ? [product.primary_image] : []);
  return {
    ...product,
    primary_image: image ?? null,
    image_url: image?.signed_url ?? null,
  };
}

function applyMarketplaceFilters(query: any, filters: ReturnType<typeof marketplaceFilterPayload>) {
  let next = query;

  if (filters.search) {
    const search = escapePostgrestSearch(filters.search);
    next = next.ilike("search_text", `%${search}%`);
  }
  if (filters.category) next = next.eq("category", filters.category);
  if (filters.minBedrooms !== null) next = next.gte("bedrooms", filters.minBedrooms);
  if (filters.minBathrooms !== null) next = next.gte("bathrooms", filters.minBathrooms);
  if (filters.minFloorArea !== null) next = next.gte("floor_area_sq_ft", filters.minFloorArea);
  if (filters.maxFloorArea !== null) next = next.lte("floor_area_sq_ft", filters.maxFloorArea);
  if (filters.minPrice !== null) next = next.gte("fob_price", filters.minPrice);
  if (filters.maxPrice !== null) next = next.lte("fob_price", filters.maxPrice);
  if (filters.targetMarket) next = next.contains("target_markets", [filters.targetMarket]);
  if (filters.certification) next = next.contains("certifications", [filters.certification]);

  return next;
}

function positiveNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function escapePostgrestSearch(value: string): string {
  return value.trim().replace(/[,%_()]/g, " ").replace(/\s+/g, " ");
}

function toPublicMediaRecord(image: MarketplaceProductImage): PublicProductMediaRecord {
  return {
    id: image.id,
    product_id: image.product_id,
    media_type: image.media_type,
    storage_bucket: image.storage_bucket,
    storage_path: image.storage_path,
    original_filename: image.original_filename,
    mime_type: image.mime_type,
    file_size_bytes: null,
    title: image.title,
    alt_text: image.alt_text,
    sort_order: image.sort_order,
    is_primary: image.is_primary,
    visibility: "public",
    created_at: "",
  };
}

function optionsFromProducts(products: Array<Pick<MarketplaceProduct, "category" | "target_markets" | "certifications">>): MarketplaceFilterOptions {
  return {
    categories: uniqueSorted(products.map((product) => product.category)),
    targetMarkets: uniqueSorted(products.flatMap((product) => product.target_markets ?? [])),
    certifications: uniqueSorted(products.flatMap((product) => product.certifications ?? [])),
  };
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function demoMarketplaceProducts(
  filters: Partial<MarketplaceFilters>,
  pagination: Partial<MarketplacePagination>,
  sort: MarketplaceSort
): MarketplacePageResult {
  const normalized = marketplaceFilterPayload(normalizeMarketplaceFilters(filters));
  const page = Math.max(1, pagination.page ?? 1);
  const pageSize = sanitizeMarketplacePageSize(pagination.pageSize);
  const { from, to } = paginationRange(page, pageSize);
  const rows = demoMarketplaceRows().map(mapMarketplaceProduct).map(withDemoImage);
  const filtered = rows.filter((product) => demoMatches(product, normalized));
  const sorted = sortDemoProducts(filtered, sort);
  const pageProducts = sorted.slice(from, to + 1);

  return {
    products: pageProducts,
    total: sorted.length,
    page,
    pageSize,
    totalPages: calculateTotalPages(sorted.length, pageSize),
  };
}

function demoMarketplaceRows(): MarketplaceProductRow[] {
  return demoProducts.map((product) => ({
    id: product.id,
    manufacturer_id: `demo-${product.manufacturer.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    manufacturer_display_name: product.manufacturer,
    manufacturer_country: "China",
    name: product.name,
    model_name: product.name,
    slug: product.id,
    category: product.category,
    short_description: product.description,
    description: product.description,
    tags: product.tags,
    intended_uses: [],
    floor_area_sq_ft: product.sizeSqFt,
    bedrooms: null,
    bathrooms: null,
    stories: null,
    length_ft: null,
    width_ft: null,
    height_ft: null,
    structure_material: null,
    exterior_finish: null,
    roof_type: null,
    insulation: null,
    electrical_standard: null,
    plumbing_standard: null,
    wind_rating: null,
    snow_load_psf: null,
    currency: "USD",
    fob_price: product.price,
    price_unit: "unit",
    minimum_order_quantity: 1,
    production_lead_time_weeks: product.leadTimeWeeks,
    port_of_loading: null,
    hs_code: null,
    certifications: product.compliance,
    target_markets: ["United States"],
    published_at: new Date(0).toISOString(),
    search_text: [
      product.name,
      product.name,
      product.category,
      product.description,
      product.tags.join(" "),
    ].join(" "),
    primary_media_id: `${product.id}-demo-image`,
    primary_media_type: "exterior_image",
    primary_storage_bucket: productImageBucket,
    primary_storage_path: product.imageUrl,
    primary_original_filename: null,
    primary_mime_type: "image/jpeg",
    primary_title: product.name,
    primary_alt_text: product.name,
    primary_sort_order: 0,
    primary_is_primary: true,
  }));
}

function withDemoImage(product: MarketplaceProduct): MarketplaceProduct {
  return {
    ...product,
    image_url: product.primary_image?.storage_path ?? null,
    primary_image: product.primary_image
      ? { ...product.primary_image, signed_url: product.primary_image.storage_path }
      : null,
  };
}

function demoMatches(
  product: MarketplaceProduct,
  filters: ReturnType<typeof marketplaceFilterPayload>
): boolean {
  const haystack = [
    product.name,
    product.model_name,
    product.category,
    product.short_description,
    product.description,
    product.tags.join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (filters.search && !haystack.includes(filters.search.toLowerCase())) return false;
  if (filters.category && product.category !== filters.category) return false;
  if (filters.minBedrooms !== null && (product.bedrooms ?? 0) < filters.minBedrooms) return false;
  if (filters.minBathrooms !== null && (product.bathrooms ?? 0) < filters.minBathrooms) return false;
  if (filters.minFloorArea !== null && (product.floor_area_sq_ft ?? 0) < filters.minFloorArea) return false;
  if (filters.maxFloorArea !== null && (product.floor_area_sq_ft ?? Infinity) > filters.maxFloorArea) return false;
  if (filters.minPrice !== null && (product.fob_price ?? 0) < filters.minPrice) return false;
  if (filters.maxPrice !== null && (product.fob_price ?? Infinity) > filters.maxPrice) return false;
  if (filters.targetMarket && !product.target_markets.includes(filters.targetMarket)) return false;
  if (filters.certification && !product.certifications.includes(filters.certification)) return false;
  return true;
}

function sortDemoProducts(products: MarketplaceProduct[], sort: MarketplaceSort): MarketplaceProduct[] {
  const copy = [...products];
  const value = (product: MarketplaceProduct, field: "fob_price" | "floor_area_sq_ft") =>
    product[field] ?? Number.POSITIVE_INFINITY;

  switch (sort) {
    case "price_asc":
      return copy.sort((a, b) => value(a, "fob_price") - value(b, "fob_price"));
    case "price_desc":
      return copy.sort((a, b) => value(b, "fob_price") - value(a, "fob_price"));
    case "area_asc":
      return copy.sort((a, b) => value(a, "floor_area_sq_ft") - value(b, "floor_area_sq_ft"));
    case "area_desc":
      return copy.sort((a, b) => value(b, "floor_area_sq_ft") - value(a, "floor_area_sq_ft"));
    case "newest":
      return copy.sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));
  }
}

const marketplaceProductSelect = [
  "id",
  "manufacturer_id",
  "manufacturer_display_name",
  "manufacturer_country",
  "name",
  "model_name",
  "slug",
  "category",
  "short_description",
  "description",
  "tags",
  "intended_uses",
  "floor_area_sq_ft",
  "bedrooms",
  "bathrooms",
  "stories",
  "length_ft",
  "width_ft",
  "height_ft",
  "structure_material",
  "exterior_finish",
  "roof_type",
  "insulation",
  "electrical_standard",
  "plumbing_standard",
  "wind_rating",
  "snow_load_psf",
  "currency",
  "fob_price",
  "price_unit",
  "minimum_order_quantity",
  "production_lead_time_weeks",
  "port_of_loading",
  "hs_code",
  "certifications",
  "target_markets",
  "published_at",
  "search_text",
  "primary_media_id",
  "primary_media_type",
  "primary_storage_bucket",
  "primary_storage_path",
  "primary_original_filename",
  "primary_mime_type",
  "primary_title",
  "primary_alt_text",
  "primary_sort_order",
  "primary_is_primary",
].join(",");
