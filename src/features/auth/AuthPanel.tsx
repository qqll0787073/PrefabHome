import React, { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { roleLabels } from "../../app/constants";
import type { LoginCredentials, RegistrationCredentials } from "../../lib/auth";
import type { Role } from "../../types";
import { validateRecoveredPassword } from "../../lib/authRecovery";

type RegistrationRole = Exclude<Role, "admin">;

export function buildLoginCredentials(
  email: string,
  password: string,
  intendedPortal: Role,
): LoginCredentials {
  return { email, password, intendedPortal };
}

export function buildRegistrationCredentials(
  email: string,
  password: string,
  fullName: string,
  role: RegistrationRole,
): RegistrationCredentials {
  return { email, password, fullName, role };
}

interface AuthPanelProps {
  activeRole: Role;
  authError: string | null;
  authMode: "supabase" | "demo";
  isLoading: boolean;
  onLogin: (credentials: LoginCredentials) => Promise<void>;
  onRegister: (credentials: RegistrationCredentials) => Promise<void>;
  onRequestPasswordRecovery: (email: string) => Promise<string>;
  recoveryState?: "idle" | "valid" | "updated";
  onUpdatePassword?: (password: string) => Promise<void>;
  onClearRecovery?: () => void;
}

interface LoginPortalEntryProps {
  activeRole: Role;
}

export function LoginPortalEntry({ activeRole }: LoginPortalEntryProps) {
  return (
    <div className="auth-portal-entry" role="status" aria-live="polite">
      <strong>Signing in to: {roleLabels[activeRole]}</strong>
      <span>Your actual access is determined by your approved account role.</span>
    </div>
  );
}

interface RegistrationRoleFieldProps {
  value: RegistrationRole;
  onChange: (role: RegistrationRole) => void;
}

interface AuthFieldProps {
  id: string; label: string; value: string; onChange: (value: string) => void;
  type?: "text" | "email" | "password"; autoComplete: string; placeholder?: string;
  describedBy?: string; invalid?: boolean; minLength?: number;
}

function AuthField({ id, label, value, onChange, type = "text", autoComplete, placeholder, describedBy, invalid, minLength }: AuthFieldProps) {
  return <label htmlFor={id}>{label}<input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} placeholder={placeholder} aria-invalid={invalid} aria-describedby={describedBy} minLength={minLength} required /></label>;
}

export function RegistrationRoleField({ value, onChange }: RegistrationRoleFieldProps) {
  return (
    <label htmlFor="registration-account-role">
      Account role
      <select
        id="registration-account-role"
        value={value}
        onChange={(event) => onChange(event.target.value as RegistrationRole)}
      >
        <option value="buyer">{roleLabels.buyer}</option>
        <option value="manufacturer">{roleLabels.manufacturer}</option>
      </select>
      <span className="auth-field-help">
        Admin access is granted only through an operator-controlled process.
      </span>
    </label>
  );
}

export function AuthPanel({
  activeRole,
  authError,
  authMode,
  isLoading,
  onLogin,
  onRegister,
  onRequestPasswordRecovery,
  recoveryState,
  onUpdatePassword,
  onClearRecovery,
}: AuthPanelProps) {
  const recovering = recoveryState !== undefined;
  const [formMode, setFormMode] = useState<"login" | "register" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [fullName, setFullName] = useState("");
  const [registrationRole, setRegistrationRole] = useState<RegistrationRole>(
    activeRole === "manufacturer" ? "manufacturer" : "buyer",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const authErrorId = useId();
  const authErrorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (formMode === "register") {
      setRegistrationRole(activeRole === "manufacturer" ? "manufacturer" : "buyer");
    }
  }, [activeRole, formMode]);

  useEffect(() => {
    if (authError) authErrorRef.current?.focus();
  }, [authError]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setActionMessage(null);
    setActionError(null);

    try {
      if (recovering && onUpdatePassword) {
        const errors = validateRecoveredPassword(password, confirmation);
        if (errors.length > 0) {
          setActionError(errors.join(" "));
          return;
        }
        await onUpdatePassword(password);
        setPassword("");
        setConfirmation("");
      } else if (formMode === "login") {
        await onLogin(buildLoginCredentials(email, password, activeRole));
      } else if (formMode === "register") {
        await onRegister(buildRegistrationCredentials(email, password, fullName, registrationRole));
      } else if (formMode === "forgot") {
        setActionMessage(await onRequestPasswordRecovery(email));
      }
    } catch (caught) {
      if (recovering || formMode === "forgot") {
        setActionError(caught instanceof Error ? caught.message : "The request could not be completed.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (recovering && (authMode === "demo" || recoveryState !== "valid")) {
    const demo = authMode === "demo";
    const updated = recoveryState === "updated";
    return <section className="auth-panel"><h2>{demo ? "Password recovery unavailable" : updated ? "Password updated" : "Recovery link unavailable"}</h2><p>{demo ? "Password recovery requires real Supabase Auth and is not simulated in demo mode." : updated ? "Sign in with your new password." : "The link is invalid, expired, already used, or has no recovery session."}</p><button type="button" onClick={onClearRecovery}>{demo ? "Back to Login" : "Return to Login"}</button></section>;
  }

  return (
    <section className="auth-panel">
      <div>
        <p className="eyebrow">{authMode === "supabase" ? "Supabase Auth" : "Demo Auth"}</p>
        <h2>{recovering ? "Choose a new password" : formMode === "login" ? "Sign in to continue" : formMode === "register" ? "Create a portal account" : "Recover your password"}</h2>
        {recovering ? <p>This changes your credential only; role, status, and Manufacturer approval are unchanged.</p> : formMode === "login" ? (
          <p>Use your existing account credentials to continue to the selected portal.</p>
        ) : formMode === "register" ? (
          <p>Create a Buyer or Manufacturer account. Account approval and access remain database-controlled.</p>
        ) : <p>Enter your account email. The response will not disclose whether an account exists.</p>}
      </div>

      <form onSubmit={handleSubmit} className="auth-form" aria-busy={isLoading || isSubmitting}>
        {!recovering && (formMode === "login" || formMode === "register") && <div className="segmented-control">
          <button
            type="button"
            className={formMode === "login" ? "active" : ""}
            aria-pressed={formMode === "login"}
            onClick={() => setFormMode("login")}
          >
            Login
          </button>
          <button
            type="button"
            className={formMode === "register" ? "active" : ""}
            aria-pressed={formMode === "register"}
            onClick={() => setFormMode("register")}
          >
            Register
          </button>
        </div>}

        {!recovering && formMode === "register" && (
          <AuthField id="auth-full-name" label="Full name" value={fullName} onChange={setFullName} placeholder="Jane Smith" autoComplete="name" />
        )}

        {!recovering && <AuthField id="auth-email" label="Email" type="email" value={email} onChange={setEmail} placeholder="name@example.com" autoComplete="email" invalid={Boolean(authError)} describedBy={authError ? authErrorId : undefined} />}

        {(recovering || formMode === "login" || formMode === "register") && <AuthField id="auth-password" label={recovering ? "New password" : "Password"} type="password" value={password} onChange={setPassword} placeholder="At least 6 characters" minLength={6} autoComplete={recovering || formMode === "register" ? "new-password" : "current-password"} invalid={Boolean(authError)} describedBy={authError ? authErrorId : undefined} />}

        {recovering && <AuthField id="recovery-confirmation" label="Confirm new password" type="password" value={confirmation} onChange={setConfirmation} minLength={6} autoComplete="new-password" />}

        {!recovering && (formMode === "login" ? (
          <LoginPortalEntry activeRole={activeRole} />
        ) : formMode === "register" ? (
          <RegistrationRoleField value={registrationRole} onChange={setRegistrationRole} />
        ) : null)}

        {!recovering && authError && (
          <p id={authErrorId} ref={authErrorRef} className="form-error" role="alert" tabIndex={-1}>
            {authError}
          </p>
        )}

        {actionError && <p className="form-error" role="alert">{actionError}</p>}
        {!recovering && actionMessage && <p className="form-notice" role="status">{actionMessage}</p>}

        <button type="submit" disabled={isLoading || isSubmitting}>
          {isSubmitting ? "Working..." : recovering ? "Update password" : formMode === "login" ? "Login" : formMode === "register" ? "Register" : "Send recovery email"}
        </button>
        {!recovering && formMode === "login" && <button type="button" className="ghost" onClick={() => setFormMode("forgot")}>Forgot password?</button>}
        {!recovering && formMode === "forgot" && <button type="button" className="ghost" onClick={() => { setFormMode("login"); setActionError(null); setActionMessage(null); }}>Back to Login</button>}
        {recovering && <button type="button" className="ghost" disabled={isSubmitting} onClick={onClearRecovery}>Cancel</button>}
      </form>
    </section>
  );
}
