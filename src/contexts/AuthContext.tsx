import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

type AppRole = "admin" | "teacher" | "user" | null;

interface AuthState {
  session: Session | null;
  user: User | null;
  role: AppRole;
  isLoggedIn: boolean;
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const fetchRole = async (userId: string): Promise<AppRole> => {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .limit(1);
  return (data?.[0]?.role as AppRole) || "user";
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    role: null,
    isLoggedIn: false,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let mounted = true;

    const applySession = (session: Session | null) => {
      if (!mounted) return;
      if (session) {
        // Set basic auth state immediately (non-blocking)
        setState(prev => ({
          ...prev,
          session,
          user: session.user,
          isLoggedIn: true,
          loading: false,
          error: null,
        }));
        // Fetch role in background (fire-and-forget)
        fetchRole(session.user.id).then(role => {
          if (mounted) {
            setState(prev => ({ ...prev, role }));
          }
        });
      } else {
        setState({ session: null, user: null, role: null, isLoggedIn: false, loading: false, error: null });
      }
    };

    // Set up listener BEFORE getSession (Supabase best practice)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        applySession(session);
      }
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

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

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
