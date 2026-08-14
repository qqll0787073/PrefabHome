import { createClient } from "@supabase/supabase-js";

export const AUTH_PAGE_SIZE = 1000;
export const AUTH_PAGE_SAFETY_CEILING = 10000;

export class BuyerInventoryError extends Error {
  constructor(message, cause) { super(message, { cause }); this.name = "BuyerInventoryError"; this.code = "INVENTORY_INCOMPLETE"; }
}

export async function findAllAuthUsersByEmail(admin, email, { perPage = AUTH_PAGE_SIZE, pageSafetyCeiling = AUTH_PAGE_SAFETY_CEILING } = {}) {
  const matches = []; const seenPages = new Set(); let observed = 0;
  for (let page = 1; page <= pageSafetyCeiling; page += 1) {
    let response;
    try { response = await admin.listUsers({ page, perPage }); }
    catch (error) { throw new BuyerInventoryError(`Auth inventory failed on page ${page}.`, error); }
    if (response?.error) throw new BuyerInventoryError(`Auth inventory failed on page ${page}.`, response.error);
    const data = response?.data; const users = data?.users;
    if (!Array.isArray(users)) throw new BuyerInventoryError(`Auth inventory returned malformed page ${page}.`);
    if (users.length === 0) return matches;
    const pageSignature = users.map((user) => user?.id).join("|");
    if (!pageSignature || seenPages.has(pageSignature)) throw new BuyerInventoryError(`Auth inventory repeated or returned invalid page ${page}.`);
    seenPages.add(pageSignature); observed += users.length;
    matches.push(...users.filter((user) => user.email?.trim().toLowerCase() === email));
    const total = data.total;
    if (total !== undefined && total !== null && (!Number.isSafeInteger(total) || total < 0)) throw new BuyerInventoryError(`Auth inventory returned invalid total metadata on page ${page}.`);
    for (const field of ["nextPage", "lastPage"]) {
      const value = data[field];
      if (value !== undefined && value !== null && (!Number.isSafeInteger(value) || value < 0)) throw new BuyerInventoryError(`Auth inventory returned invalid ${field} metadata on page ${page}.`);
    }
    if (Number.isSafeInteger(data.nextPage) && data.nextPage !== page + 1) throw new BuyerInventoryError(`Auth inventory returned non-sequential nextPage metadata on page ${page}.`);
    if (Number.isSafeInteger(data.lastPage) && data.lastPage > 0 && data.lastPage < page) throw new BuyerInventoryError(`Auth inventory returned stale lastPage metadata on page ${page}.`);
    if (Number.isSafeInteger(total) && total > 0) {
      if (observed > total) throw new BuyerInventoryError(`Auth inventory exceeded its declared total on page ${page}.`);
      if (observed === total) return matches;
    }
    if (users.length < perPage) return matches;
  }
  throw new BuyerInventoryError(`Auth inventory exceeded the ${pageSafetyCeiling}-page safety ceiling before proving exhaustion.`);
}

export function createBuyerProvisioningAdapter({ url, serviceRoleKey, client: injectedClient }) {
  const client = injectedClient ?? createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const escapeLike = (value) => value.replace(/[\\%_]/g, "\\$&");
  return {
    async findAuthUsersByEmail(email) {
      return findAllAuthUsersByEmail(client.auth.admin, email);
    },
    async findProfilesByEmail(email) {
      const { data, error } = await client.from("profiles").select("id,email,role,status").ilike("email", escapeLike(email)); if (error) throw error;
      return (data ?? []).filter((profile) => profile.email.trim().toLowerCase() === email);
    },
    async createAuthUser({ email, password, emailConfirm, metadata }) {
      const { data, error } = await client.auth.admin.createUser({ email, password, email_confirm: emailConfirm, user_metadata: metadata }); if (error) throw error; return data.user;
    },
    async requestPasswordRecovery(email) { const { error } = await client.auth.resetPasswordForEmail(email); if (error) throw error; },
    async waitForProfile(attempt) { await new Promise((resolve) => setTimeout(resolve, Math.min(250 * 2 ** attempt, 3000))); },
  };
}
