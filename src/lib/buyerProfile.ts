import type { ProfileRecord } from "../types";
import { supabase } from "./supabase";

export interface BuyerProfileView {
  profile: ProfileRecord;
  accountEmail: string;
}

interface AuthIdentity {
  id: string;
  email: string;
}

export interface BuyerProfileOperations {
  getAuthIdentity: () => Promise<AuthIdentity>;
  fetchProfile: (userId: string) => Promise<ProfileRecord | null>;
}

function normalizedEmail(value: string): string {
  return value.trim().toLocaleLowerCase();
}

async function getAuthIdentity(): Promise<AuthIdentity> {
  if (!supabase) throw new Error("Profile service is unavailable.");
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) throw new Error("Profile service is unavailable.");
  return { id: data.user.id, email: data.user.email };
}

async function fetchProfile(userId: string): Promise<ProfileRecord | null> {
  if (!supabase) throw new Error("Profile service is unavailable.");
  const { data, error } = await supabase
    .from("profiles")
    .select("id,role,full_name,email,status,created_at,updated_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error("Profile service is unavailable.");
  return data as ProfileRecord | null;
}

const defaultOperations: BuyerProfileOperations = { getAuthIdentity, fetchProfile };

export async function fetchBuyerProfile(
  expectedUserId: string,
  operations: BuyerProfileOperations = defaultOperations,
): Promise<BuyerProfileView> {
  try {
    const identity = await operations.getAuthIdentity();
    if (identity.id !== expectedUserId) throw new Error("Your account changed. Reload Profile and try again.");
    const profile = await operations.fetchProfile(identity.id);
    if (!profile || profile.id !== identity.id || profile.role !== "buyer" || profile.status !== "active") {
      throw new Error("Your Buyer profile is unavailable.");
    }
    if (normalizedEmail(profile.email) !== normalizedEmail(identity.email)) {
      throw new Error("Your account profile needs support before it can be edited.");
    }
    return { profile, accountEmail: identity.email };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (["Your account changed. Reload Profile and try again.", "Your Buyer profile is unavailable.", "Your account profile needs support before it can be edited."].includes(message)) throw error;
    throw new Error("Profile service is unavailable.");
  }
}
