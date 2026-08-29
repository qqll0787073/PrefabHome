import React, { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { roleLabels } from "../../app/constants";
import type { LoginCredentials, RegistrationCredentials } from "../../lib/auth";
import type { Role } from "../../types";
import { canSubmitRecoveredPassword, validateRecoveredPassword } from "../../lib/authRecovery";

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
  onResendConfirmation: (email: string) => Promise<string>;
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
  onResendConfirmation,
}: AuthPanelProps) {
  const [formMode, setFormMode] = useState<"login" | "register" | "forgot" | "resend">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      if (formMode === "login") {
        await onLogin(buildLoginCredentials(email, password, activeRole));
      } else if (formMode === "register") {
        await onRegister(buildRegistrationCredentials(email, password, fullName, registrationRole));
      } else if (formMode === "forgot") {
        setActionMessage(await onRequestPasswordRecovery(email));
      } else {
        setActionMessage(await onResendConfirmation(email));
      }
    } catch (caught) {
      if (formMode === "forgot" || formMode === "resend") {
        setActionError(caught instanceof Error ? caught.message : "The request could not be completed.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="auth-panel">
      <div>
        <p className="eyebrow">{authMode === "supabase" ? "Supabase Auth" : "Demo Auth"}</p>
        <h2>{formMode === "login" ? "Sign in to continue" : formMode === "register" ? "Create a portal account" : formMode === "forgot" ? "Recover your password" : "Resend confirmation email"}</h2>
        {formMode === "login" ? (
          <p>Use your existing account credentials to continue to the selected portal.</p>
        ) : formMode === "register" ? (
          <p>Create a Buyer or Manufacturer account. Account approval and access remain database-controlled.</p>
        ) : <p>Enter your account email. The response will not disclose whether an account exists.</p>}
      </div>

      <form onSubmit={handleSubmit} className="auth-form" aria-busy={isLoading || isSubmitting}>
        {(formMode === "login" || formMode === "register") && <div className="segmented-control">
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

        {formMode === "register" && (
          <label htmlFor="auth-full-name">
            Full name
            <input
              id="auth-full-name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Jane Smith"
              autoComplete="name"
              required
            />
          </label>
        )}

        <label htmlFor="auth-email">
          Email
          <input
            id="auth-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            autoComplete="email"
            aria-invalid={Boolean(authError)}
            aria-describedby={authError ? authErrorId : undefined}
            required
          />
        </label>

        {(formMode === "login" || formMode === "register") && <label htmlFor="auth-password">
          Password
          <input
            id="auth-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 6 characters"
            minLength={6}
            autoComplete={formMode === "login" ? "current-password" : "new-password"}
            aria-invalid={Boolean(authError)}
            aria-describedby={authError ? authErrorId : undefined}
            required
          />
        </label>}

        {formMode === "login" ? (
          <LoginPortalEntry activeRole={activeRole} />
        ) : formMode === "register" ? (
          <RegistrationRoleField value={registrationRole} onChange={setRegistrationRole} />
        ) : null}

        {authError && (
          <p id={authErrorId} ref={authErrorRef} className="form-error" role="alert" tabIndex={-1}>
            {authError}
          </p>
        )}

        {actionError && <p className="form-error" role="alert">{actionError}</p>}
        {actionMessage && <p className="form-notice" role="status">{actionMessage}</p>}

        <button type="submit" disabled={isLoading || isSubmitting}>
          {isSubmitting ? "Working..." : formMode === "login" ? "Login" : formMode === "register" ? "Register" : formMode === "forgot" ? "Send recovery email" : "Resend confirmation email"}
        </button>
        {formMode === "login" && <div className="auth-secondary-actions"><button type="button" className="ghost" onClick={() => setFormMode("forgot")}>Forgot password?</button><button type="button" className="ghost" onClick={() => setFormMode("resend")}>Resend confirmation email</button></div>}
        {(formMode === "forgot" || formMode === "resend") && <button type="button" className="ghost" onClick={() => { setFormMode("login"); setActionError(null); setActionMessage(null); }}>Back to Login</button>}
      </form>
    </section>
  );
}

interface PasswordRecoveryPanelProps {
  authMode: "supabase" | "demo";
  recoveryState: "idle" | "valid" | "updated";
  recoveryError: string | null;
  onUpdatePassword: (password: string) => Promise<void>;
  onClear: () => void;
}

export function PasswordRecoveryPanel({ authMode, recoveryState, recoveryError, onUpdatePassword, onClear }: PasswordRecoveryPanelProps) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validateRecoveredPassword(password, confirmation);
    setValidationErrors(errors);
    if (!canSubmitRecoveredPassword(errors, isSubmitting)) return;
    setIsSubmitting(true);
    try {
      await onUpdatePassword(password);
      setPassword("");
      setConfirmation("");
    } catch {
      // The Auth provider exposes a sanitized recovery error.
    } finally {
      setIsSubmitting(false);
    }
  }

  if (authMode === "demo") return <section className="auth-panel"><h2>Password recovery unavailable</h2><p>Password recovery requires real Supabase Auth and is not simulated in demo mode.</p><button type="button" onClick={onClear}>Back to Login</button></section>;
  if (recoveryState === "updated") return <section className="auth-panel"><h2>Password updated</h2><p>Your password was updated successfully. Sign in with the new password.</p><button type="button" onClick={onClear}>Return to Login</button></section>;
  if (recoveryState !== "valid") return <section className="auth-panel"><h2>Recovery link unavailable</h2><p>This recovery link is invalid, expired, already used, or does not have a valid recovery session.</p><button type="button" onClick={onClear}>Return to Login</button></section>;

  return <section className="auth-panel"><div><p className="eyebrow">Account recovery</p><h2>Choose a new password</h2><p>This changes your Supabase Auth credential only. Account role, status, and Manufacturer approval are unchanged.</p></div><form className="auth-form" onSubmit={submit} aria-busy={isSubmitting}><label htmlFor="recovery-password">New password<input id="recovery-password" type="password" autoComplete="new-password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required /></label><label htmlFor="recovery-confirmation">Confirm new password<input id="recovery-confirmation" type="password" autoComplete="new-password" minLength={6} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></label>{validationErrors.length > 0 && <div className="form-error" role="alert">{validationErrors.map((item) => <p key={item}>{item}</p>)}</div>}{recoveryError && <p className="form-error" role="alert">{recoveryError}</p>}<button type="submit" disabled={isSubmitting}>{isSubmitting ? "Updating..." : "Update password"}</button><button type="button" className="ghost" disabled={isSubmitting} onClick={onClear}>Cancel</button></form></section>;
}
