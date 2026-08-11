import type { SupabaseClient } from "@supabase/supabase-js";
import type { MarketplaceProduct } from "../types";
import { mapMarketplaceProduct } from "./marketplace";
import { supabase } from "./supabase";

export interface BuyerManufacturer {
  id: string;
  displayName: string;
  description: string | null;
  website: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  certifications: string[];
  publishedProductCount: number;
}
export type BuyerManufacturerSort = "name" | "products";

const directoryProjection = "id,display_name,description,website,city,region,country,certifications,published_product_count";
const productProjection = "id,manufacturer_id,manufacturer_display_name,manufacturer_country,name,model_name,slug,category,short_description,description,tags,intended_uses,floor_area_sq_ft,bedrooms,bathrooms,stories,length_ft,width_ft,height_ft,structure_material,exterior_finish,roof_type,insulation,electrical_standard,plumbing_standard,wind_rating,snow_load_psf,currency,fob_price,price_unit,minimum_order_quantity,production_lead_time_weeks,port_of_loading,hs_code,certifications,target_markets,published_at,search_text,primary_media_id,primary_media_type,primary_storage_bucket,primary_storage_path,primary_original_filename,primary_mime_type,primary_title,primary_alt_text,primary_sort_order,primary_is_primary";

export async function fetchBuyerManufacturers(client: SupabaseClient | null = supabase): Promise<BuyerManufacturer[]> {
  if (!client) throw new Error("Unavailable");
  const { data, error } = await client.from("buyer_manufacturer_directory").select(directoryProjection).order("display_name", { ascending: true }).order("id", { ascending: true });
  if (error) throw new Error("Unable to load manufacturers.");
  return (data ?? []).map((row: any) => ({
    id: row.id,
    displayName: row.display_name,
    description: row.description,
    website: safeWebsite(row.website),
    city: row.city,
    region: row.region,
    country: row.country,
    certifications: Array.isArray(row.certifications) ? row.certifications.filter((value: unknown): value is string => typeof value === "string" && Boolean(value.trim())) : [],
    publishedProductCount: Number.isFinite(row.published_product_count) ? Math.max(0, row.published_product_count) : 0,
  }));
}

export async function fetchBuyerManufacturerProducts(manufacturerId: string, client: SupabaseClient | null = supabase): Promise<MarketplaceProduct[]> {
  if (!client) throw new Error("Unavailable");
  const { data, error } = await client.from("marketplace_products").select(productProjection).eq("manufacturer_id", manufacturerId).order("published_at", { ascending: false }).order("id", { ascending: true });
  if (error) throw new Error("Unable to load manufacturers.");
  return (data ?? []).map((row: any) => mapMarketplaceProduct(row));
}

export function selectBuyerManufacturers(items: BuyerManufacturer[], search: string, country: string, sort: BuyerManufacturerSort): BuyerManufacturer[] {
  const term = search.trim().toLocaleLowerCase();
  return items.filter((item) => {
    const matchesCountry = !country || item.country === country;
    const haystack = [item.displayName, item.description, item.city, item.region, item.country, ...item.certifications].filter(Boolean).join(" ").toLocaleLowerCase();
    return matchesCountry && (!term || haystack.includes(term));
  }).sort((a, b) => {
    if (sort === "products") {
      const count = b.publishedProductCount - a.publishedProductCount;
      if (count) return count;
    }
    return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }) || a.id.localeCompare(b.id);
  });
}

export function safeWebsite(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim().match(/^https?:\/\//i) ? value.trim() : `https://${value.trim()}`);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

export function manufacturerLocation(item: BuyerManufacturer): string {
  return [item.city, item.region, item.country].filter(Boolean).join(", ") || "Location not listed";
}
