import React, { useEffect, useState, type FormEvent } from "react";
import { roleLabels } from "../../app/constants";
import type { LoginCredentials, RegistrationCredentials } from "../../lib/auth";
import type { Role } from "../../types";

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
    <label>
      Account role
      <select
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
}: AuthPanelProps) {
  const [formMode, setFormMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [registrationRole, setRegistrationRole] = useState<RegistrationRole>(
    activeRole === "manufacturer" ? "manufacturer" : "buyer",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (formMode === "register") {
      setRegistrationRole(activeRole === "manufacturer" ? "manufacturer" : "buyer");
    }
  }, [activeRole, formMode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      if (formMode === "login") {
        await onLogin(buildLoginCredentials(email, password, activeRole));
      } else {
        await onRegister(buildRegistrationCredentials(email, password, fullName, registrationRole));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="auth-panel">
      <div>
        <p className="eyebrow">{authMode === "supabase" ? "Supabase Auth" : "Demo Auth"}</p>
        <h2>{formMode === "login" ? "Sign in to continue" : "Create a portal account"}</h2>
        {formMode === "login" ? (
          <p>Use your existing account credentials to continue to the selected portal.</p>
        ) : (
          <p>Create a Buyer or Manufacturer account. Account approval and access remain database-controlled.</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="segmented-control">
          <button
            type="button"
            className={formMode === "login" ? "active" : ""}
            onClick={() => setFormMode("login")}
          >
            Login
          </button>
          <button
            type="button"
            className={formMode === "register" ? "active" : ""}
            onClick={() => setFormMode("register")}
          >
            Register
          </button>
        </div>

        {formMode === "register" && (
          <label>
            Full name
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Jane Smith"
              autoComplete="name"
              required
            />
          </label>
        )}

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            autoComplete="email"
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 6 characters"
            minLength={6}
            autoComplete={formMode === "login" ? "current-password" : "new-password"}
            required
          />
        </label>

        {formMode === "login" ? (
          <LoginPortalEntry activeRole={activeRole} />
        ) : (
          <RegistrationRoleField value={registrationRole} onChange={setRegistrationRole} />
        )}

        {authError && <p className="form-error">{authError}</p>}

        <button type="submit" disabled={isLoading || isSubmitting}>
          {isSubmitting ? "Working..." : formMode === "login" ? "Login" : "Register"}
        </button>
      </form>
    </section>
  );
}
