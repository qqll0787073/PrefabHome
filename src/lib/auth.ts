import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "./supabase";
import {
  isDemoFallbackAllowed,
  runtimeConfig,
  runtimeConfigMessages,
} from "./runtimeConfig";
import { isRole, sanitizeRegistrationRole } from "./authRoles";
import type { Role } from "../types";
import {
  fixedRecoveryRedirect,
  isRecoveryRoute,
  neutralRecoveryMessage,
  recoveryErrorMessage,
} from "./authRecovery";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  status?: "active" | "pending" | "suspended";
}

export interface LoginCredentials {
  email: string;
  password: string;
  intendedPortal: Role;
}

export interface RegistrationCredentials {
  email: string;
  password: string;
  fullName?: string;
  role: Exclude<Role, "admin">;
}

export interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
  mode: "supabase" | "demo";
  recoveryState: "idle" | "valid" | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegistrationCredentials) => Promise<void>;
  requestPasswordRecovery: (email: string) => Promise<string>;
  updateRecoveredPassword: (password: string) => Promise<void>;
  clearRecovery: () => void;
  logout: () => Promise<void>;
}

const demoStorageKey = "prefab_demo_auth_user";
const demoAuthAllowed = isDemoFallbackAllowed(runtimeConfig);
const unavailableAuthMessage =
  runtimeConfigMessages(runtimeConfig).join(" ") ||
  "Supabase authentication is unavailable for this production deployment.";

function getDemoUser(): AuthUser | null {
  try {
    const raw = window.localStorage.getItem(demoStorageKey);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function setDemoUser(user: AuthUser | null) {
  if (!user) {
    window.localStorage.removeItem(demoStorageKey);
    return;
  }

  window.localStorage.setItem(demoStorageKey, JSON.stringify(user));
}

async function loadSupabaseProfile(userId: string, email: string): Promise<AuthUser> {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,status")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    id: userId,
    email: data?.email ?? email,
    fullName: data?.full_name ?? email.split("@")[0],
    role: isRole(data?.role) ? data.role : "buyer",
    status: data?.status === "pending" || data?.status === "suspended" ? data.status : "active",
  };
}

export function useAuth(): AuthState {
  const mode = useMemo(
    () => (isSupabaseConfigured || !demoAuthAllowed ? "supabase" : "demo"),
    []
  );
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recoveryState, setRecoveryState] = useState<"idle" | "valid" | null>(
    () => typeof window !== "undefined" && isRecoveryRoute(window.location.search) ? "idle" : null,
  );

  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      setIsLoading(true);
      setError(null);

      try {
        if (!supabase) {
          if (isMounted) {
            setUser(demoAuthAllowed ? getDemoUser() : null);
            if (!demoAuthAllowed) setError(unavailableAuthMessage);
          }
          return;
        }

        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        const sessionUser = data.session?.user;
        if (sessionUser?.email) {
          const profile = await loadSupabaseProfile(sessionUser.id, sessionUser.email);
          if (isMounted) setUser(profile);
        } else if (isMounted) {
          setUser(null);
        }
      } catch (authError) {
        if (isMounted) {
          setError(authError instanceof Error ? authError.message : "Unable to load session.");
          setUser(null);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    initialize();

    if (!supabase) {
      return () => {
        isMounted = false;
      };
    }

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (event === "PASSWORD_RECOVERY") {
          setRecoveryState("valid");
        }
        if (session?.user.email) {
          const profile = await loadSupabaseProfile(session.user.id, session.user.email);
          if (isMounted) setUser(profile);
        } else if (isMounted) {
          setUser(null);
        }
      } catch (authError) {
        if (isMounted) {
          setError(authError instanceof Error ? authError.message : "Unable to sync session.");
          setUser(null);
        }
      }
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function login({ email, password, intendedPortal }: LoginCredentials) {
    setError(null);

    if (!supabase) {
      if (!demoAuthAllowed) {
        const configurationError = new Error(unavailableAuthMessage);
        setError(configurationError.message);
        throw configurationError;
      }
      const demoUser: AuthUser = {
        id: `demo-${intendedPortal}`,
        email,
        fullName: email.split("@")[0],
        role: intendedPortal,
        status: "active",
      };
      setDemoUser(demoUser);
      setUser(demoUser);
      return;
    }

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      throw signInError;
    }

    if (data.user?.email) {
      setUser(await loadSupabaseProfile(data.user.id, data.user.email));
    }
  }

  async function register({ email, password, fullName, role }: RegistrationCredentials) {
    setError(null);
    const registrationRole = sanitizeRegistrationRole(role);

    if (!supabase) {
      if (!demoAuthAllowed) {
        const configurationError = new Error(unavailableAuthMessage);
        setError(configurationError.message);
        throw configurationError;
      }
      const demoUser: AuthUser = {
        id: `demo-${Date.now()}`,
        email,
        fullName: fullName?.trim() || email.split("@")[0],
        role: registrationRole,
        status: "active",
      };
      setDemoUser(demoUser);
      setUser(demoUser);
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: registrationRole,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      throw signUpError;
    }

    if (data.user && data.session) {
      // public.handle_new_auth_user creates the profile in the Auth transaction.
      // Browser clients intentionally have no direct public.profiles write grant.
      setUser({
        id: data.user.id,
        email,
        fullName: fullName?.trim() || email.split("@")[0],
        role: registrationRole,
        status: "active",
      });
    } else if (data.user) {
      setError("Registration created. Check your email to confirm the account before signing in.");
    }
  }

  async function logout() {
    setError(null);

    if (supabase) {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        setError(signOutError.message);
        throw signOutError;
      }
    } else {
      setDemoUser(null);
    }

    setUser(null);
  }

  async function requestPasswordRecovery(email: string): Promise<string> {
    if (!supabase) {
      if (demoAuthAllowed) throw new Error("Password recovery requires Supabase Auth and is unavailable in demo mode.");
      throw new Error(unavailableAuthMessage);
    }
    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: fixedRecoveryRedirect(window.location.origin),
      });
    } catch {
      // Keep the response neutral even when the provider rejects the request.
    }
    return neutralRecoveryMessage;
  }

  async function updateRecoveredPassword(password: string): Promise<void> {
    if (!supabase || recoveryState !== "valid") {
      throw new Error(recoveryErrorMessage());
    }
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) throw new Error(recoveryErrorMessage());
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      throw new Error("Password updated, but sign-out failed. Sign out before continuing.");
    }
    setUser(null);
    clearRecovery();
  }

  function clearRecovery() {
    setRecoveryState(null);
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", "/marketplace");
    }
  }

  return {
    user,
    isLoading,
    error,
    mode,
    recoveryState,
    login,
    register,
    requestPasswordRecovery,
    updateRecoveredPassword,
    clearRecovery,
    logout,
  };
}
