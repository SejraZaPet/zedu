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

    const bootstrap = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!mounted) return;

        if (session) {
          const role = await fetchRole(session.user.id);
          if (!mounted) return;
          setState({ session, user: session.user, role, isLoggedIn: true, loading: false, error: null });
        } else {
          setState({ session: null, user: null, role: null, isLoggedIn: false, loading: false, error: null });
        }
      } catch (err: any) {
        if (mounted) {
          setState(prev => ({ ...prev, loading: false, error: err.message ?? "Auth error" }));
        }
      }
    };

    // Set up listener BEFORE getSession (Supabase best practice)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;
        if (session) {
          const role = await fetchRole(session.user.id);
          if (!mounted) return;
          setState({ session, user: session.user, role, isLoggedIn: true, loading: false, error: null });
        } else {
          setState({ session: null, user: null, role: null, isLoggedIn: false, loading: false, error: null });
        }
      }
    );

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
