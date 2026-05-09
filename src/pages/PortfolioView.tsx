import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";
import PortfolioTimeline from "@/components/portfolio/PortfolioTimeline";
import { ArrowLeft, FolderOpen } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { loadFullPortfolio, PortfolioItem } from "@/lib/portfolio";
import { supabase } from "@/integrations/supabase/client";

export default function PortfolioView() {
  const { studentId } = useParams<{ studentId: string }>();
  const { role } = useAuth();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) return;
    setLoading(true);
    loadFullPortfolio(studentId).then((data) => { setItems(data); setLoading(false); });
    supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", studentId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setName(`${data.first_name ?? ""} ${data.last_name ?? ""}`.trim());
      });
  }, [studentId]);

  const isTeacher = role === "teacher" || role === "admin" || role === "lektor";
  const backHref = role === "rodic" ? "/rodic" : "/ucitel/tridy";

  return (
    <>
      <SiteHeader />
      <main className="pt-24 pb-16 px-4 sm:px-6 max-w-5xl mx-auto">
        <Link to={backHref} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Zpět
        </Link>
        <header className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FolderOpen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Portfolio{name ? `: ${name}` : ""}</h1>
            <p className="text-sm text-muted-foreground">Pouze pro čtení.</p>
          </div>
        </header>
        {loading ? (
          <p className="text-center text-muted-foreground py-12">Načítám…</p>
        ) : (
          <PortfolioTimeline items={items} canComment={isTeacher} />
        )}
      </main>
    </>
  );
}
