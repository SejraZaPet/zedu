import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

type AppRole = "admin" | "teacher" | "lektor" | "rodic" | "user" | null;

interface AuthState {
  session: Session | null;
  user: User | null;
  role: AppRole;
  status: string | null;
  isLoggedIn: boolean;
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>;
  /** True role from DB, ignoring any admin "view as" override */
  realRole: AppRole;
  /** Admin-only: temporarily view the app as another role. null = no override */
  viewAsRole: AppRole;
  setViewAsRole: (role: AppRole) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const VIEW_AS_KEY = "zedu:view-as-role";
const VALID_VIEW_ROLES: AppRole[] = ["admin", "teacher", "user"];

const readViewAs = (): AppRole => {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(VIEW_AS_KEY) as AppRole;
  return VALID_VIEW_ROLES.includes(v) ? v : null;
};

// Priority order: highest-privilege / most-specific role wins when a user has multiple rows.
const ROLE_PRIORITY: Record<string, number> = {
  admin: 5,
  teacher: 4,
  lektor: 3,
  rodic: 2,
  user: 1,
};

const fetchRoleAndStatus = async (userId: string): Promise<{ role: AppRole; status: string | null }> => {
  const [rolesRes, profileRes] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("profiles").select("status").eq("id", userId).single(),
  ]);
  const roles = (rolesRes.data ?? []).map((r: any) => r.role as string);
  const best = roles.sort((a, b) => (ROLE_PRIORITY[b] ?? 0) - (ROLE_PRIORITY[a] ?? 0))[0];
  return {
    role: (best as AppRole) || "user",
    status: profileRes.data?.status ?? null,
  };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    role: null,
    status: null,
    isLoggedIn: false,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let mounted = true;

    const applySession = (session: Session | null) => {
      if (!mounted) return;
      if (session) {
        setState(prev => ({
          ...prev,
          session,
          user: session.user,
          isLoggedIn: true,
          loading: false,
          error: null,
        }));
        fetchRoleAndStatus(session.user.id).then(({ role, status }) => {
          if (mounted) {
            setState(prev => ({ ...prev, role, status }));
          }
        });
      } else {
        setState({ session: null, user: null, role: null, status: null, isLoggedIn: false, loading: false, error: null });
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => { applySession(session); }
    );

    const bootstrap = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        applySession(session);
      } catch (err: any) {
        if (mounted) {
          setState(prev => ({ ...prev, loading: false, error: err.message ?? "Auth error" }));
        }
      }
    };

    bootstrap();
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  const signOut = async () => { await supabase.auth.signOut(); };

  return (
    <AuthContext.Provider value={{ ...state, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
};
