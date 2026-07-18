import { roleLabels } from "../../app/constants";
import type { AuthState } from "../../lib/auth";
import type { Role } from "../../types";

interface AppHeaderProps {
  auth: AuthState;
  role: Role;
  onRoleChange: (role: Role) => void;
}

export function AppHeader({ auth, role, onRoleChange }: AppHeaderProps) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">China Factories x U.S. Buyers</p>
        <h1>PrefabHome Marketplace</h1>
      </div>
      <div className="role-switcher" aria-label="Portal role">
        {(Object.keys(roleLabels) as Role[]).map((item) => (
          <button
            key={item}
            className={role === item ? "active" : ""}
            onClick={() => onRoleChange(item)}
          >
            {roleLabels[item]}
          </button>
        ))}
      </div>
      <div className="auth-summary">
        {auth.user ? (
          <>
            <span>{auth.user.fullName}</span>
            <small>{roleLabels[auth.user.role]}</small>
            <button onClick={() => void auth.logout()}>Logout</button>
          </>
        ) : (
          <>
            <span>{auth.mode === "supabase" ? "Supabase Auth" : "Demo Auth"}</span>
            <small>{auth.isLoading ? "Checking session" : "Not signed in"}</small>
          </>
        )}
      </div>
    </header>
  );
}
