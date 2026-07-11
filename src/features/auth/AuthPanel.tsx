import { useEffect, useState, type FormEvent } from "react";
import { roleLabels } from "../../app/constants";
import type { AuthCredentials } from "../../lib/auth";
import type { Role } from "../../types";

interface AuthPanelProps {
  activeRole: Role;
  authError: string | null;
  authMode: "supabase" | "demo";
  isLoading: boolean;
  onLogin: (credentials: AuthCredentials) => Promise<void>;
  onRegister: (credentials: AuthCredentials) => Promise<void>;
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
  const [selectedRole, setSelectedRole] = useState<Role>(activeRole);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const registrationRoles: Role[] = ["buyer", "manufacturer"];

  useEffect(() => {
    if (formMode === "register" && selectedRole === "admin") {
      setSelectedRole("buyer");
    } else if (formMode === "login") {
      setSelectedRole(activeRole);
    }
  }, [activeRole, formMode, selectedRole]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    const credentials: AuthCredentials = {
      email,
      password,
      fullName,
      role: selectedRole,
    };

    try {
      if (formMode === "login") {
        await onLogin(credentials);
      } else {
        await onRegister(credentials);
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
        <p>
          Buyer and manufacturer registration is ready for Supabase. Admin access is supported as
          a role, but should be granted through an operator-controlled process.
        </p>
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
            required
          />
        </label>

        <label>
          Portal role
          <select
            value={selectedRole}
            onChange={(event) => setSelectedRole(event.target.value as Role)}
          >
            {(formMode === "register" ? registrationRoles : (Object.keys(roleLabels) as Role[])).map(
              (item) => (
                <option key={item} value={item}>
                  {roleLabels[item]}
                </option>
              )
            )}
          </select>
        </label>

        {authError && <p className="form-error">{authError}</p>}

        <button type="submit" disabled={isLoading || isSubmitting}>
          {isSubmitting ? "Working..." : formMode === "login" ? "Login" : "Register"}
        </button>
      </form>
    </section>
  );
}
