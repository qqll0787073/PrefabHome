import { useEffect, useRef, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import { fetchAdminUsers, setAdminProfileStatus, type AdminUserRecord, type ProfileStatus } from "../../lib/adminUsers";
import type { Role } from "../../types";

const pageSize = 20;

export function AdminUsersWorkspace({ authMode }: { authMode: "supabase" | "demo" }) {
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<Role | "all">("all");
  const [status, setStatus] = useState<ProfileStatus | "all">("all");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(authMode === "supabase");
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestGeneration = useRef(0);

  async function load() {
    const generation = ++requestGeneration.current;
    setLoading(true);
    setError(null);
    if (authMode === "demo") {
      setUsers([]); setTotal(0); setLoading(false); return;
    }
    try {
      const result = await fetchAdminUsers({ search, role, status, limit: pageSize, offset: page * pageSize });
      if (generation !== requestGeneration.current) return;
      setUsers(result.users); setTotal(result.total);
    } catch (cause) {
      if (generation === requestGeneration.current) setError(cause instanceof Error ? cause.message : "Admin users could not be loaded.");
    } finally {
      if (generation === requestGeneration.current) setLoading(false);
    }
  }

  useEffect(() => { const handle = window.setTimeout(() => void load(), 200); return () => window.clearTimeout(handle); }, [authMode, search, role, status, page]);
  useEffect(() => { setPage(0); }, [search, role, status]);

  async function changeStatus(user: AdminUserRecord, next: ProfileStatus) {
    setSaving(user.profile_id); setError(null);
    try { await setAdminProfileStatus(user.profile_id, next); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Platform access status could not be updated."); }
    finally { setSaving(null); }
  }

  return <section className="workspace-section">
    <section className="panel">
      <p className="eyebrow">Admin User Management</p><h2>Users</h2>
      <p>Account identity is read-only. Platform access status is managed separately; roles, email, passwords, and Auth identities cannot be changed here.</p>
      <div className="queue-controls">
        <label>Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, account email, or company" /></label>
        <label>Role<select value={role} onChange={(event) => setRole(event.target.value as Role | "all")}><option value="all">All roles</option><option value="buyer">Buyer</option><option value="manufacturer">Manufacturer</option><option value="admin">Admin</option></select></label>
        <label>Status<select value={status} onChange={(event) => setStatus(event.target.value as ProfileStatus | "all")}><option value="all">All statuses</option><option value="active">Active</option><option value="pending">Pending</option><option value="suspended">Suspended</option></select></label>
      </div>
      <ErrorList errors={error ? [error] : []} />{loading && <LoadingState message="Loading authoritative user records..." />}
      {!loading && users.length === 0 && <p>No users match the current search and filters.</p>}
      <div className="review-list">{users.map((user) => <article className="review-item" key={user.profile_id}>
        <div><p className="eyebrow">{user.profile_role} · {user.profile_status}</p><h3>{user.full_name || "Unnamed account"}</h3>
          <dl className="status-list compact"><div><dt>Account email (read-only)</dt><dd>{user.account_email}</dd></div><div><dt>Created</dt><dd>{new Date(user.profile_created_at).toLocaleDateString()}</dd></div><div><dt>Updated</dt><dd>{new Date(user.profile_updated_at).toLocaleDateString()}</dd></div>{user.manufacturer_exists && <div><dt>Manufacturer</dt><dd>{user.manufacturer_name || "Company record"} · {user.manufacturer_application_status}</dd></div>}</dl>
        </div>
        <div className="actions">{user.profile_status === "active" ? <button disabled={saving === user.profile_id} onClick={() => void changeStatus(user, "suspended")}>Suspend access</button> : <button disabled={saving === user.profile_id} onClick={() => void changeStatus(user, "active")}>Activate access</button>}</div>
      </article>)}</div>
      <div className="actions"><button className="ghost" disabled={page === 0 || loading} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page + 1} · {total} users</span><button className="ghost" disabled={(page + 1) * pageSize >= total || loading} onClick={() => setPage((value) => value + 1)}>Next</button></div>
    </section>
  </section>;
}
