import React, { useCallback, useEffect, useRef, useState } from "react";
import type { AuthUser } from "../../lib/auth";
import {
  fetchBuyerProfile,
  updateBuyerFullName,
  validateBuyerFullName,
  type BuyerProfileView,
} from "../../lib/buyerProfile";

interface BuyerProfileWorkspaceProps {
  user: AuthUser;
  loadProfile?: typeof fetchBuyerProfile;
  saveProfile?: typeof updateBuyerFullName;
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

interface BuyerProfileDetailsProps {
  view: BuyerProfileView;
  fullName: string;
  saving: boolean;
  validationError: string | null;
  saveError: boolean;
  saved: boolean;
  onFullNameChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

export function BuyerProfileDetails({ view, fullName, saving, validationError, saveError, saved, onFullNameChange, onSubmit }: BuyerProfileDetailsProps) {
  const unchanged = fullName.trim() === (view.profile.full_name ?? "").trim();
  return <>
    <section className="panel" aria-labelledby="account-details-heading">
      <h3 id="account-details-heading">Account details</h3>
      <dl className="internal-detail-grid">
        <div><dt>Email <span className="sr-only">(read-only)</span></dt><dd>{view.accountEmail}</dd></div>
        <div><dt>Role <span className="sr-only">(read-only)</span></dt><dd>Buyer</dd></div>
        <div><dt>Status <span className="sr-only">(read-only)</span></dt><dd>{view.profile.status}</dd></div>
        <div><dt>Member since <span className="sr-only">(read-only)</span></dt><dd>{formattedDate(view.profile.created_at)}</dd></div>
      </dl>
      <p className="form-notice">Email, role, status, and account timestamps are read-only and system-managed.</p>
    </section>
    <section className="panel" aria-labelledby="profile-edit-heading">
      <h3 id="profile-edit-heading">Personal information</h3>
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <label htmlFor="buyer-profile-full-name">Full name
          <input id="buyer-profile-full-name" name="full_name" value={fullName} maxLength={160} autoComplete="name" aria-describedby="buyer-profile-full-name-help buyer-profile-save-status" aria-invalid={Boolean(validationError)} onChange={(event) => onFullNameChange(event.target.value)} />
        </label>
        <p id="buyer-profile-full-name-help">Required. Up to 160 characters.</p>
        {validationError && <p className="form-error" role="alert">{validationError}</p>}
        {saveError && <p className="form-error" role="alert">Profile could not be updated. Please try again.</p>}
        <div id="buyer-profile-save-status" role="status" aria-live="polite">
          {saving && <p>Saving profile...</p>}
          {saved && <p className="form-success">Profile updated.</p>}
        </div>
        <button type="submit" disabled={saving || unchanged || Boolean(validationError)}>{saving ? "Saving..." : "Save Changes"}</button>
      </form>
    </section>
    <section className="panel" aria-labelledby="deferred-settings-heading">
      <h3 id="deferred-settings-heading">Account security and preferences</h3>
      <p>Password management, email changes, MFA, passkeys, sessions, account deletion, notifications, language, and timezone preferences are not currently supported here.</p>
    </section>
  </>;
}

export function BuyerProfileWorkspace({ user, loadProfile = fetchBuyerProfile, saveProfile = updateBuyerFullName }: BuyerProfileWorkspaceProps) {
  const [view, setView] = useState<BuyerProfileView | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [fullName, setFullName] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saved, setSaved] = useState(false);
  const generation = useRef(0);
  const saveGeneration = useRef(0);
  const saveController = useRef<AbortController | null>(null);
  const active = useRef(true);

  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true); setLoadError(false); setView(null); setFullName(""); setSaveError(false); setSaved(false); setValidationError(null);
    try {
      const next = await loadProfile(user.id);
      if (active.current && request === generation.current) { setView(next); setFullName(next.profile.full_name ?? ""); }
    } catch {
      if (active.current && request === generation.current) setLoadError(true);
    } finally {
      if (active.current && request === generation.current) setLoading(false);
    }
  }, [loadProfile, user.id]);

  const changeFullName = useCallback((value: string) => {
    setFullName(value); setValidationError(validateBuyerFullName(value)); setSaveError(false); setSaved(false);
  }, []);

  const submit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const error = validateBuyerFullName(fullName);
    setValidationError(error); setSaveError(false); setSaved(false);
    if (error || !view || fullName.trim() === (view.profile.full_name ?? "").trim()) return;
    const request = ++saveGeneration.current;
    const controller = new AbortController();
    saveController.current?.abort();
    saveController.current = controller;
    setSaving(true);
    try {
      const next = await saveProfile(user.id, fullName, undefined, controller.signal);
      if (active.current && request === saveGeneration.current) { setView(next); setFullName(next.profile.full_name ?? ""); setSaved(true); }
    } catch {
      if (active.current && request === saveGeneration.current) setSaveError(true);
    } finally {
      if (active.current && request === saveGeneration.current) setSaving(false);
    }
  }, [fullName, saveProfile, saving, user.id, view]);

  useEffect(() => { active.current = true; void load(); return () => { active.current = false; generation.current += 1; saveGeneration.current += 1; saveController.current?.abort(); }; }, [load]);

  return <section className="buyer-profile" aria-labelledby="buyer-profile-heading">
    <div className="workspace-toolbar"><div><p className="eyebrow">Buyer account</p><h3 id="buyer-profile-heading">Profile &amp; Account Settings</h3><p>Review account authority and maintain the profile information currently supported.</p></div></div>
    {loading && <BuyerProfileLoadingState />}
    {!loading && loadError && <BuyerProfileErrorState onRetry={() => void load()} />}
    {!loading && view && <BuyerProfileDetails view={view} fullName={fullName} saving={saving} validationError={validationError} saveError={saveError} saved={saved} onFullNameChange={changeFullName} onSubmit={(event) => void submit(event)} />}
  </section>;
}
