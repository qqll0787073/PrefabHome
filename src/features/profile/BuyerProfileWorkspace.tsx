import React, { useCallback, useEffect, useRef, useState } from "react";
import type { AuthUser } from "../../lib/auth";
import {
  fetchBuyerProfile,
  type BuyerProfileView,
} from "../../lib/buyerProfile";

interface BuyerProfileWorkspaceProps {
  user: AuthUser;
  loadProfile?: typeof fetchBuyerProfile;
}

function formattedDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(date);
}

export function BuyerProfileLoadingState() {
  return <div className="logistics-workspace-state panel" role="status" aria-live="polite" aria-busy="true">Loading your profile...</div>;
}

export function BuyerProfileErrorState({ onRetry }: { onRetry: () => void }) {
  return <div className="logistics-workspace-state workspace-error" role="alert"><h3>Profile could not load</h3><p>Your account details are temporarily unavailable. Please try again.</p><button type="button" onClick={onRetry}>Retry</button></div>;
}

export function BuyerProfileDetails({ view }: { view: BuyerProfileView }) {
  return <>
    <section className="panel" aria-labelledby="account-details-heading">
      <h3 id="account-details-heading">Account details</h3>
      <dl className="internal-detail-grid">
        <div><dt>Email</dt><dd>{view.accountEmail}</dd></div>
        <div><dt>Full name</dt><dd>{view.profile.full_name?.trim() || "Not provided"}</dd></div>
        <div><dt>Role</dt><dd>Buyer</dd></div>
        <div><dt>Status</dt><dd>{view.profile.status}</dd></div>
        <div><dt>Member since</dt><dd>{formattedDate(view.profile.created_at)}</dd></div>
      </dl>
      <p className="form-notice">Profile fields are read-only until a column-restricted self-service update workflow is approved. Email, role, status, and account timestamps are system-managed.</p>
    </section>
    <section className="panel" aria-labelledby="deferred-settings-heading">
      <h3 id="deferred-settings-heading">Account security and preferences</h3>
      <p>Password management, email changes, MFA, passkeys, sessions, account deletion, notifications, language, and timezone preferences are not currently supported here.</p>
    </section>
  </>;
}

export function BuyerProfileWorkspace({ user, loadProfile = fetchBuyerProfile }: BuyerProfileWorkspaceProps) {
  const [view, setView] = useState<BuyerProfileView | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const generation = useRef(0);
  const active = useRef(true);

  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true); setLoadError(false); setView(null);
    try {
      const next = await loadProfile(user.id);
      if (active.current && request === generation.current) setView(next);
    } catch {
      if (active.current && request === generation.current) setLoadError(true);
    } finally {
      if (active.current && request === generation.current) setLoading(false);
    }
  }, [loadProfile, user.id]);

  useEffect(() => { active.current = true; void load(); return () => { active.current = false; generation.current += 1; }; }, [load]);

  return <section className="buyer-profile" aria-labelledby="buyer-profile-heading">
    <div className="workspace-toolbar"><div><p className="eyebrow">Buyer account</p><h3 id="buyer-profile-heading">Profile &amp; Account Settings</h3><p>Review account authority and maintain the profile information currently supported.</p></div></div>
    {loading && <BuyerProfileLoadingState />}
    {!loading && loadError && <BuyerProfileErrorState onRetry={() => void load()} />}
    {!loading && view && <BuyerProfileDetails view={view} />}
  </section>;
}
