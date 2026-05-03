import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookOpen, Plus, Search, Calendar, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface PlanRow {
  id: string;
  title: string;
  subject: string;
  updated_at: string;
  input_data: any;
}

export default function TeacherLessonPlans() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("lesson_plans")
        .select("id, title, subject, updated_at, input_data")
        .eq("teacher_id", user.id)
        .order("updated_at", { ascending: false });
      setItems((data as any[]) ?? []);
      setLoading(false);
    })();
  }, [user]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (it) =>
        (it.title || "").toLowerCase().includes(q) ||
        (it.subject || "").toLowerCase().includes(q),
    );
  }, [items, search]);

  function handleCreate() {
    navigate("/ucitel/plany-hodin/novy");
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <div aria-hidden className="h-[70px] shrink-0" />

      <main className="flex-1 container mx-auto px-4 pt-8 pb-12 max-w-4xl">
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Plány hodin</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Organizuj lekce a pracovní listy do tematických plánů.
            </p>
          </div>
          <Button onClick={handleCreate} className="shrink-0">
            <Plus className="w-4 h-4 mr-2" />
            Nový plán
          </Button>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9"
            placeholder="Hledat plán…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <BookOpen className="w-12 h-12 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">
              {search.trim()
                ? "Žádný plán neodpovídá hledání."
                : "Zatím nemáš žádné plány hodin. Vytvoř první!"}
            </p>
            {!search.trim() && (
              <Button onClick={handleCreate}>
                <Plus className="w-4 h-4 mr-2" />
                Nový plán
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((plan) => {
              const linkedDate = plan.input_data?.linkedDate as string | undefined;
              const linkedTime = plan.input_data?.linkedTime as string | undefined;
              return (
                <button
                  key={plan.id}
                  onClick={() => navigate(`/ucitel/plany-hodin/${plan.id}`)}
                  className="text-left bg-card border border-border rounded-xl p-5 flex flex-col gap-2 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <BookOpen className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-semibold text-sm truncate">{plan.title}</span>
                  </div>
                  {plan.subject && (
                    <p className="text-xs text-muted-foreground">{plan.subject}</p>
                  )}
                  {linkedDate && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      <span>
                        {format(new Date(linkedDate), "d. M. yyyy", { locale: cs })}
                        {linkedTime ? ` · ${linkedTime.replace("-", " – ")}` : ""}
                      </span>
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground/70 mt-auto">
                    Upraveno {format(new Date(plan.updated_at), "d. M. yyyy", { locale: cs })}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
