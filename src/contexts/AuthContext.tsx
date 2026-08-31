import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

type AppRole = "admin" | "school_admin" | "teacher" | "lektor" | "rodic" | "user" | null;

interface AuthState {
  session: Session | null;
  user: User | null;
  role: AppRole;
  /** All roles assigned to the user in user_roles */
  roles: string[];
  preferredView: "school_admin" | "teacher" | null;
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
  /** True when the user is both school_admin and teacher — allows a persistent view switch */
  canSwitchSchoolView: boolean;
  /** Persist the chosen view (school administration vs. own teaching) on the account */
  setPreferredView: (view: "school_admin" | "teacher") => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const VIEW_AS_KEY = "Bezli:view-as-role";
const VALID_VIEW_ROLES: AppRole[] = ["admin", "teacher", "user"];

const readViewAs = (): AppRole => {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(VIEW_AS_KEY) as AppRole;
  return VALID_VIEW_ROLES.includes(v) ? v : null;
};

// Priority order: highest-privilege / most-specific role wins when a user has multiple rows.
const ROLE_PRIORITY: Record<string, number> = {
  admin: 6,
  school_admin: 5,
  teacher: 4,
  lektor: 3,
  rodic: 2,
  user: 1,
};

const resolveBestRole = (roles: string[]): AppRole => {
  const best = roles.sort((a, b) => (ROLE_PRIORITY[b] ?? 0) - (ROLE_PRIORITY[a] ?? 0))[0];
  return (best as AppRole) || "user";
};

type RoleInfo = { role: AppRole; roles: string[]; status: string | null; preferredView: "school_admin" | "teacher" | null };

const normalizeView = (v: unknown): "school_admin" | "teacher" | null =>
  v === "school_admin" || v === "teacher" ? v : null;

const fetchRoleAndStatus = async (userId: string): Promise<RoleInfo> => {
  try {
    const [rolesRes, profileRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("status, preferred_view").eq("id", userId).single(),
    ]);

    if (rolesRes.error || profileRes.error) {
      throw rolesRes.error || profileRes.error;
    }

    const roles = (rolesRes.data ?? []).map((r: any) => r.role as string);
    return {
      role: resolveBestRole(roles),
      roles,
      status: profileRes.data?.status ?? null,
      preferredView: normalizeView((profileRes.data as any)?.preferred_view),
    };
  } catch {
    const { data, error } = await supabase.functions.invoke("get-user-auth-info", {
      body: { include_profile: true },
    });

    if (error) {
      return { role: null, roles: [], status: null, preferredView: null };
    }

    const roles = Array.isArray(data?.roles) ? data.roles.filter((role: unknown): role is string => typeof role === "string") : [];
    return {
      role: resolveBestRole(roles),
      roles,
      status: typeof data?.profile?.status === "string" ? data.profile.status : null,
      preferredView: normalizeView(data?.profile?.preferred_view),
    };
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    role: null,
    roles: [],
    preferredView: null,
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
        fetchRoleAndStatus(session.user.id).then(({ role, roles, status, preferredView }) => {
          if (mounted) {
            setState(prev => ({ ...prev, role, roles, status, preferredView }));
          }
        });
      } else {
        setState({ session: null, user: null, role: null, roles: [], preferredView: null, status: null, isLoggedIn: false, loading: false, error: null });
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

  const signOut = async () => {
    if (typeof window !== "undefined") window.localStorage.removeItem(VIEW_AS_KEY);
    await supabase.auth.signOut();
  };

  const [viewAsRole, setViewAsRoleState] = useState<AppRole>(() => readViewAs());
  const setViewAsRole = (role: AppRole) => {
    if (typeof window !== "undefined") {
      if (role) window.localStorage.setItem(VIEW_AS_KEY, role);
      else window.localStorage.removeItem(VIEW_AS_KEY);
    }
    setViewAsRoleState(role);
  };

  // Systémový admin se nikdy nesmí "degradovat" trvalou volbou školního pohledu —
  // pro přepínání rolí má vlastní mechanismus "Prohlížíš jako".
  const isGlobalAdmin = state.roles.includes("admin") || state.role === "admin";
  const canSwitchSchoolView =
    !isGlobalAdmin &&
    state.roles.includes("school_admin") &&
    (state.roles.includes("teacher") || state.roles.includes("lektor"));

  const setPreferredView = async (view: "school_admin" | "teacher") => {
    if (!state.user) return;
    // Trvalá volba pohledu má přednost před dočasným admin "view as" (jen u ne-adminů).
    if (!isGlobalAdmin) setViewAsRole(null);
    setState(prev => ({ ...prev, preferredView: view }));
    await supabase.from("profiles").update({ preferred_view: view }).eq("id", state.user.id);
  };

  // Trvalá volba pohledu pro člověka, který je zároveň školní admin i učitel.
  const switchedRole: AppRole = !canSwitchSchoolView
    ? state.role
    : state.preferredView === "teacher"
      ? (state.roles.includes("teacher") ? "teacher" : "lektor")
      : state.preferredView === "school_admin"
        ? "school_admin"
        : state.role;


  const effectiveRole: AppRole = isGlobalAdmin && viewAsRole ? viewAsRole : switchedRole;

  return (
    <AuthContext.Provider value={{
      ...state,
      role: effectiveRole,
      realRole: state.role,
      viewAsRole: isAdmin ? viewAsRole : null,
      setViewAsRole,
      canSwitchSchoolView,
      setPreferredView,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
};
