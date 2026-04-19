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
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const fetchRoleAndStatus = async (userId: string): Promise<{ role: AppRole; status: string | null }> => {
  const [rolesRes, profileRes] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId).limit(1),
    supabase.from("profiles").select("status").eq("id", userId).single(),
  ]);
  return {
    role: (rolesRes.data?.[0]?.role as AppRole) || "user",
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
