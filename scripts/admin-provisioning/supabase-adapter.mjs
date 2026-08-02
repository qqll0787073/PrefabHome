import { createClient } from "@supabase/supabase-js";

export function createSupabaseAdminAdapter({ url, serviceRoleKey }) {
  const client = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const escapeLike = (value) => value.replace(/[\\%_]/g, "\\$&");
  return {
    async findAuthUsersByEmail(email) {
      const matches = [];
      for (let page = 1; page <= 100; page += 1) {
        const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        matches.push(...data.users.filter((user) => user.email?.trim().toLowerCase() === email));
        if (data.users.length < 1000) break;
      }
      return matches;
    },
    async findProfilesByEmail(email) {
      const { data, error } = await client.from("profiles").select("id,email,role,status").ilike("email", escapeLike(email));
      if (error) throw error;
      return (data ?? []).filter((profile) => profile.email.trim().toLowerCase() === email);
    },
    async findAdminProfilesByEmail(email) {
      const { data, error } = await client.from("profiles").select("id,email,role,status").ilike("email", escapeLike(email)).eq("role", "admin");
      if (error) throw error;
      return data ?? [];
    },
    async countManufacturerBusinessRecords(profileId) {
      const { count, error } = await client.from("manufacturers").select("id", { count: "exact", head: true }).eq("owner_id", profileId);
      if (error) throw error;
      return count ?? 0;
    },
    async promoteProfileConditional({ id, email, expectedRole, expectedStatus }) {
      const { data, error } = await client.from("profiles").update({ role: "admin" }).eq("id", id).ilike("email", escapeLike(email)).eq("role", expectedRole).eq("status", expectedStatus).select("id,email,role,status");
      if (error) throw error;
      return data ?? [];
    },
    async createAuthUser({ email, password, emailConfirm, metadata }) {
      const { data, error } = await client.auth.admin.createUser({ email, password, email_confirm: emailConfirm, user_metadata: metadata });
      if (error) throw error;
      return data.user;
    },
    async waitForProfile(attempt) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(250 * 2 ** attempt, 2000)));
    },
  };
}
