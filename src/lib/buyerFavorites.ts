import type { MarketplaceProduct } from "../types";
import { fetchMarketplaceProductsByIds } from "./marketplace";
import { isSupabaseConfigured, supabase } from "./supabase";

export type BuyerFavoriteSort = "latest" | "newest_product" | "manufacturer" | "alphabetical";

export interface BuyerFavorite {
  product: MarketplaceProduct;
  favoritedAt: string;
}

export const buyerFavoriteSortLabels: Record<BuyerFavoriteSort, string> = {
  latest: "Latest Favorited",
  newest_product: "Newest Product",
  manufacturer: "Manufacturer",
  alphabetical: "Alphabetical",
};

export function favoriteProductHref(product: Pick<MarketplaceProduct, "id" | "slug">): string {
  return `/products/${encodeURIComponent(product.slug || product.id)}`;
}

export function filterBuyerFavorites(favorites: BuyerFavorite[], search: string): BuyerFavorite[] {
  const query = search.trim().toLocaleLowerCase();
  if (!query) return [...favorites];
  return favorites.filter(({ product }) =>
    [product.name, product.model_name, product.manufacturer_display_name]
      .filter(Boolean)
      .some((value) => value!.toLocaleLowerCase().includes(query))
  );
}

export function sortBuyerFavorites(favorites: BuyerFavorite[], sort: BuyerFavoriteSort): BuyerFavorite[] {
  return favorites.map((favorite, index) => ({ favorite, index })).sort((left, right) => {
    const a = left.favorite;
    const b = right.favorite;
    let result = 0;
    if (sort === "latest") result = safeTimestamp(b.favoritedAt) - safeTimestamp(a.favoritedAt);
    if (sort === "newest_product") result = safeTimestamp(b.product.published_at) - safeTimestamp(a.product.published_at);
    if (sort === "manufacturer") result = compareText(a.product.manufacturer_display_name, b.product.manufacturer_display_name);
    if (sort === "alphabetical") result = compareText(a.product.model_name || a.product.name, b.product.model_name || b.product.name);
    return result || compareText(a.product.id, b.product.id) || left.index - right.index;
  }).map(({ favorite }) => favorite);
}

export function selectBuyerFavorites(favorites: BuyerFavorite[], search: string, sort: BuyerFavoriteSort): BuyerFavorite[] {
  return sortBuyerFavorites(filterBuyerFavorites(favorites, search), sort);
}

export function toBuyerFavoritesError(): Error {
  return new Error("Your favorite products could not be loaded. Please try again.");
}

export async function fetchBuyerFavorites(): Promise<BuyerFavorite[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  try {
    const buyerId = await requireActiveBuyer();
    const { data, error } = await supabase
      .from("saved_products")
      .select("product_id,created_at")
      .eq("buyer_id", buyerId)
      .order("created_at", { ascending: false })
      .order("product_id", { ascending: true });
    if (error) throw error;

    const rows = data ?? [];
    const products = await fetchMarketplaceProductsByIds(rows.map((row) => row.product_id));
    const productsById = new Map(products.map((product) => [product.id, product]));
    return rows.flatMap((row) => {
      const product = productsById.get(row.product_id);
      return product ? [{ product, favoritedAt: row.created_at }] : [];
    });
  } catch {
    throw toBuyerFavoritesError();
  }
}

export async function removeBuyerFavorite(productId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) throw toBuyerFavoritesError();
  try {
    const buyerId = await requireActiveBuyer();
    const { error } = await supabase
      .from("saved_products")
      .delete()
      .eq("buyer_id", buyerId)
      .eq("product_id", productId);
    if (error) throw error;
  } catch {
    throw toBuyerFavoritesError();
  }
}

async function requireActiveBuyer(): Promise<string> {
  if (!supabase) throw new Error("Authentication unavailable");
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error("Authentication required");
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,role,status")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profileError || !profile || profile.role !== "buyer" || profile.status !== "active") {
    throw new Error("Active Buyer profile required");
  }
  return authData.user.id;
}

function safeTimestamp(value: string | null): number {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}
