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
  recoveryState?: "idle" | "valid";
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
}

interface AuthFieldProps {
  id: string; label: string;
  type?: "text" | "email" | "password"; autoComplete: string; placeholder?: string;
  describedBy?: string; invalid?: boolean; minLength?: number;
}

function AuthField({ id, label, type = "text", autoComplete, placeholder, describedBy, invalid, minLength }: AuthFieldProps) {
  return <label htmlFor={id}>{label}<input id={id} name={id} type={type} autoComplete={autoComplete} placeholder={placeholder} aria-invalid={invalid} aria-describedby={describedBy} minLength={minLength} required /></label>;
}

export function RegistrationRoleField({ value }: RegistrationRoleFieldProps) {
  return (
    <label htmlFor="registration-account-role">
      Account role
      <select
        id="registration-account-role"
        name="registration-account-role"
        defaultValue={value}
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<[string, boolean] | null>(null);
  const authErrorId = useId();
  const authErrorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (authError) authErrorRef.current?.focus();
  }, [authError]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const email = fields["auth-email"] ?? "";
    const password = fields["auth-password"] ?? "";

    try {
      if (recovering && onUpdatePassword) {
        const errors = validateRecoveredPassword(password, fields["recovery-confirmation"] ?? "");
        if (errors.length > 0) {
          setFeedback([errors.join(" "), true]);
          return;
        }
        await onUpdatePassword(password);
        form.reset();
        setFeedback(["Password updated. Sign in with your new password.", false]);
      } else if (formMode === "login") {
        await onLogin(buildLoginCredentials(email, password, activeRole));
      } else if (formMode === "register") {
        await onRegister(buildRegistrationCredentials(email, password, fields["auth-full-name"] ?? "", fields["registration-account-role"] as RegistrationRole));
      } else if (formMode === "forgot") {
        setFeedback([await onRequestPasswordRecovery(email), false]);
      }
    } catch (caught) {
      if (recovering || formMode === "forgot") {
        setFeedback([caught instanceof Error ? caught.message : "The request could not be completed.", true]);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (recovering && (authMode === "demo" || recoveryState !== "valid")) {
    const demo = authMode === "demo";
    return <section className="auth-panel"><h2>{demo ? "Password recovery unavailable" : "Recovery link unavailable"}</h2><p>{demo ? "Password recovery requires real Supabase Auth and is not simulated in demo mode." : "The link is invalid, expired, already used, or has no recovery session."}</p><button type="button" onClick={onClearRecovery}>Return to Login</button></section>;
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
          <AuthField id="auth-full-name" label="Full name" placeholder="Jane Smith" autoComplete="name" />
        )}

        {!recovering && <AuthField id="auth-email" label="Email" type="email" placeholder="name@example.com" autoComplete="email" invalid={Boolean(authError)} describedBy={authError ? authErrorId : undefined} />}

        {(recovering || formMode === "login" || formMode === "register") && <AuthField id="auth-password" label={recovering ? "New password" : "Password"} type="password" placeholder="At least 6 characters" minLength={6} autoComplete={recovering || formMode === "register" ? "new-password" : "current-password"} invalid={Boolean(authError)} describedBy={authError ? authErrorId : undefined} />}

        {recovering && <AuthField id="recovery-confirmation" label="Confirm new password" type="password" minLength={6} autoComplete="new-password" />}

        {!recovering && (formMode === "login" ? (
          <LoginPortalEntry activeRole={activeRole} />
        ) : formMode === "register" ? (
          <RegistrationRoleField key={activeRole} value={activeRole === "manufacturer" ? "manufacturer" : "buyer"} />
        ) : null)}

        {!recovering && authError && (
          <p id={authErrorId} ref={authErrorRef} className="form-error" role="alert" tabIndex={-1}>
            {authError}
          </p>
        )}

        {feedback && <p className={feedback[1] ? "form-error" : "form-notice"} role={feedback[1] ? "alert" : "status"}>{feedback[0]}</p>}

        <button type="submit" disabled={isLoading || isSubmitting}>
          {isSubmitting ? "Working..." : recovering ? "Update password" : formMode === "login" ? "Login" : formMode === "register" ? "Register" : "Send recovery email"}
        </button>
        {!recovering && formMode === "login" && <button type="button" className="ghost" onClick={() => setFormMode("forgot")}>Forgot password?</button>}
        {!recovering && formMode === "forgot" && <button type="button" className="ghost" onClick={() => { setFormMode("login"); setFeedback(null); }}>Back to Login</button>}
        {recovering && <button type="button" className="ghost" disabled={isSubmitting} onClick={onClearRecovery}>Cancel</button>}
      </form>
    </section>
  );
}
