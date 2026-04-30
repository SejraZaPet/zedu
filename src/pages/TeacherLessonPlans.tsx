import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BookOpen, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { cs } from "date-fns/locale";

interface LessonPlanRow {
  id: string;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export default function TeacherLessonPlans() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [items, setItems] = useState<LessonPlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    void load();
  }, [authLoading, user]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("lesson_plans" as any)
      .select("id, title, description, created_at, updated_at")
      .order("updated_at", { ascending: false });

    if (error) {
      toast({
        title: "Nepodařilo se načíst plány hodin",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setItems((data as LessonPlanRow[]) ?? []);
    }
    setLoading(false);
  }

  async function handleCreate() {
    if (!user) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("lesson_plans" as any)
      .insert({ teacher_id: user.id, title: "Nový plán hodin" })
      .select("id")
      .single();

    setCreating(false);
    if (error) {
      toast({
        title: "Nepodařilo se vytvořit plán",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Plán hodin vytvořen" });
      void load();
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    const { error } = await supabase
      .from("lesson_plans" as any)
      .delete()
      .eq("id", deleteId);

    setDeleteId(null);
    if (error) {
      toast({
        title: "Nepodařilo se smazat plán",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Plán hodin smazán" });
      setItems((prev) => prev.filter((i) => i.id !== deleteId));
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (it) =>
        it.title.toLowerCase().includes(q) ||
        it.description.toLowerCase().includes(q),
    );
  }, [items, search]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <div aria-hidden className="h-[70px] shrink-0" />

      <main className="flex-1 container mx-auto px-4 pt-8 pb-12 max-w-4xl">
        {/* Hlavička */}
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Plány hodin</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Organizuj lekce a pracovní listy do tematických plánů.
            </p>
          </div>
          <Button onClick={handleCreate} disabled={creating} className="shrink-0">
            <Plus className="w-4 h-4 mr-2" />
            {creating ? "Vytvářím…" : "Nový plán"}
          </Button>
        </div>

        {/* Vyhledávání */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9"
            placeholder="Hledat plán…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Obsah */}
        {loading ? (
          <div className="text-center py-20 text-muted-foreground text-sm">Načítám…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <BookOpen className="w-12 h-12 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">
              {search.trim()
                ? "Žádný plán neodpovídá hledání."
                : "Zatím nemáš žádné plány hodin. Vytvoř první!"}
            </p>
            {!search.trim() && (
              <Button onClick={handleCreate} disabled={creating}>
                <Plus className="w-4 h-4 mr-2" />
                Nový plán
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((plan) => (
              <div
                key={plan.id}
                className="bg-card border border-border rounded-xl p-5 flex flex-col gap-2 hover:border-primary/40 transition-colors cursor-pointer group"
                onClick={() => navigate(`/ucitel/plany-hodin/${plan.id}`)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <BookOpen className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-semibold text-sm truncate">{plan.title}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteId(plan.id);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {plan.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {plan.description}
                  </p>
                )}

                <p className="text-xs text-muted-foreground mt-auto pt-1">
                  Upraveno{" "}
                  {formatDistanceToNow(new Date(plan.updated_at), {
                    addSuffix: true,
                    locale: cs,
                  })}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>

      <SiteFooter />

      {/* Potvrzení smazání */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smazat plán hodin?</AlertDialogTitle>
            <AlertDialogDescription>
              Tato akce je nevratná. Plán bude trvale odstraněn včetně všech vazeb na lekce a pracovní listy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Smazat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
