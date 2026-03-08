import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ShieldAlert, Clock, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

interface Props {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: Props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState<"loading" | "ok" | "pending" | "blocked" | "unauthenticated">("loading");

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setState("unauthenticated");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("status")
        .eq("id", session.user.id)
        .single();

      // Legacy admin without profile — allow
      if (!profile) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .limit(1);
        if (roles?.some(r => r.role === "admin")) {
          setState("ok");
          return;
        }
        setState("pending");
        return;
      }

      if (profile.status === "approved") {
        setState("ok");
      } else if (profile.status === "blocked") {
        setState("blocked");
      } else {
        setState("pending");
      }
    };

    check();
  }, []);

  if (state === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Ověřování přístupu...</div>
      </div>
    );
  }

  if (state === "unauthenticated") {
    return <UnauthenticatedRedirect />;
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
