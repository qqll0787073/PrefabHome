import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Role } from "../types";

export type ProfileStatus = "active" | "pending" | "suspended";

export interface AdminUserRecord {
  profile_id: string;
  full_name: string | null;
  account_email: string;
  profile_role: Role;
  profile_status: ProfileStatus;
  profile_created_at: string;
  profile_updated_at: string;
  manufacturer_exists: boolean;
  manufacturer_application_status: string | null;
  manufacturer_name: string | null;
  total_count: number;
}
export interface AdminUserQuery {
  search?: string;
  role?: Role | "all";
  status?: ProfileStatus | "all";
  limit?: number;
  offset?: number;
}

export interface AdminDashboardSummary {
  total_users: number;
  active_buyers: number;
  active_manufacturers: number;
  active_admins: number;
  suspended_users: number;
  pending_users: number;
  manufacturer_reviews: number;
  product_reviews: number;
  actionable_rfqs: number;
  actionable_purchase_orders: number;
  contracts_in_review: number;
  open_invoices: number;
  shipping_handoffs: number;
  logistics_arrangements: number;
}

function clientOrThrow(client: SupabaseClient | null = supabase): SupabaseClient {
  if (!client) throw new Error("Admin services require an authenticated database connection.");
  return client;
}

export async function fetchAdminUsers(query: AdminUserQuery = {}, client: SupabaseClient | null = supabase) {
  const limit = Math.min(100, Math.max(1, query.limit ?? 25));
  const offset = Math.max(0, query.offset ?? 0);
  const { data, error } = await clientOrThrow(client).rpc("admin_list_users", {
    search_text: query.search?.trim() || null,
    role_filter: query.role && query.role !== "all" ? query.role : null,
    status_filter: query.status && query.status !== "all" ? query.status : null,
    page_limit: limit,
    page_offset: offset,
  });
  if (error) throw new Error("Admin users could not be loaded.");
  const users = (data ?? []) as AdminUserRecord[];
  return { users, total: Number(users[0]?.total_count ?? 0), limit, offset };
}

export async function setAdminProfileStatus(profileId: string, status: ProfileStatus, client: SupabaseClient | null = supabase) {
  const { data, error } = await clientOrThrow(client).rpc("admin_set_profile_status", {
    target_profile_id: profileId,
    new_status: status,
  });
  if (error || !data) throw new Error("Platform access status could not be updated.");
}

export async function fetchAdminDashboardSummary(client: SupabaseClient | null = supabase): Promise<AdminDashboardSummary> {
  const { data, error } = await clientOrThrow(client).rpc("admin_dashboard_summary");
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) throw new Error("Admin dashboard summary could not be loaded.");
  return row as AdminDashboardSummary;
}
