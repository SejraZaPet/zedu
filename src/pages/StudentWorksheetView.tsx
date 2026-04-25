import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import WorksheetPlayer from "@/components/WorksheetPlayer";
import type { WorksheetSpec } from "@/lib/worksheet-spec";

export default function StudentWorksheetView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [spec, setSpec] = useState<WorksheetSpec | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate(`/auth?redirect=/student/pracovni-list/${id}`);
      return;
    }
    if (!id) return;
    (async () => {
      const { data, error } = await supabase
        .from("worksheets" as any)
        .select("spec, status, title")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) {
        setError("Pracovní list není dostupný.");
      } else {
        setSpec((data as any).spec as WorksheetSpec);
      }
      setLoading(false);
    })();
  }, [id, user, authLoading, navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main
        className="flex-1 container mx-auto px-4 py-12 max-w-4xl"
        style={{ paddingTop: "calc(70px + 3rem)" }}
      >
        {loading || authLoading ? (
          <div className="text-center py-16 text-muted-foreground">Načítání…</div>
        ) : error || !spec ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <h1 className="font-heading text-2xl font-semibold mb-2">Pracovní list není dostupný</h1>
            <p className="text-muted-foreground">{error ?? "Nepodařilo se načíst data."}</p>
          </div>
        ) : (
          <WorksheetPlayer
            spec={spec}
            variantId={spec.variants[0]?.variantId ?? "A"}
            attemptId={null}
          />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
