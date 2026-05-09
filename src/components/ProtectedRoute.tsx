import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: Props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, user, role, status, loading: authLoading } = useAuth();
  const [state, setState] = useState<"loading" | "ok" | "pending" | "blocked">("loading");

  useEffect(() => {
    if (authLoading) return;

    if (!isLoggedIn || !user) {
      setState("loading"); // will redirect below
      return;
    }

    // Prefer status from AuthContext (already fetched). Avoid re-querying to prevent
    // race conditions where RLS-protected fetch returns null briefly after login.
    if (status === "approved") {
      setState("ok");
      return;
    }
    if (status === "blocked") {
      setState("blocked");
      return;
    }
    if (status === "pending") {
      setState("pending");
      return;
    }

    // status not yet loaded — fall back to a one-shot fetch
    let cancelled = false;
    (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("status")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;

      if (!profile) {
        // Legacy admin without profile row
        if (role === "admin") setState("ok");
        // No profile yet but auth is fresh — keep loading instead of flashing pending
        else setState("loading");
        return;
      }
      if (profile.status === "approved") setState("ok");
      else if (profile.status === "blocked") setState("blocked");
      else setState("pending");
    })();
    return () => { cancelled = true; };
  }, [authLoading, isLoggedIn, user, role, status]);

  if (authLoading || (state === "loading" && isLoggedIn)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Ověřování přístupu...</div>
      </div>
    );
  }

  if (!isLoggedIn) {
    const redirectUrl = `/auth?redirect=${encodeURIComponent(location.pathname + location.search)}`;
    return <Navigate to={redirectUrl} replace />;
  }

  if (state === "pending") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SiteHeader />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-yellow-400" />
            </div>
            <h1 className="font-heading text-2xl font-bold mb-2">Účet čeká na schválení</h1>
            <p className="text-muted-foreground mb-6">
              Váš účet byl zaregistrován a čeká na schválení administrátorem. Po schválení budete mít přístup k učebnicím.
            </p>
            <Button variant="outline" onClick={() => navigate("/")}>
              ← Zpět na hlavní stránku
            </Button>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (state === "blocked") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SiteHeader />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <Ban className="w-8 h-8 text-destructive" />
            </div>
            <h1 className="font-heading text-2xl font-bold mb-2">Přístup zablokován</h1>
            <p className="text-muted-foreground mb-6">
              Váš účet byl zablokován. Pokud se domníváte, že jde o chybu, kontaktujte administrátora.
            </p>
            <Button variant="outline" onClick={() => navigate("/")}>
              ← Zpět na hlavní stránku
            </Button>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
