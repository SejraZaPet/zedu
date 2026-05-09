import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
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
import { BookOpen, Plus, Search, Calendar, Loader2, Trash2, LayoutTemplate, Share2, Globe, School, Copy, User as UserIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface LinkedSlot {
  subject?: string;
  classId?: string;
  className?: string;
  date?: string;
  time?: string;
}

interface PlanRow {
  id: string;
  title: string;
  subject: string;
  updated_at: string;
  input_data: any;
}

const NO_SUBJECT = "—";

export default function TeacherLessonPlans() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState<string>("__all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [templates, setTemplates] = useState<
    { id: string; title: string; description: string | null; phases_json: any; created_at: string }[]
  >([]);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState(false);

  async function confirmDeleteTemplate() {
    if (!deleteTemplateId) return;
    setDeletingTemplate(true);
    const { error } = await supabase.from("lesson_plan_templates").delete().eq("id", deleteTemplateId);
    setDeletingTemplate(false);
    if (error) {
      toast({ title: "Smazání se nezdařilo", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Šablona smazána" });
      setTemplates((prev) => prev.filter((t) => t.id !== deleteTemplateId));
    }
    setDeleteTemplateId(null);
  }

  async function reload() {
    if (!user) return;
    setLoading(true);
    const [{ data: plans }, { data: tpls }] = await Promise.all([
      supabase
        .from("lesson_plans")
        .select("id, title, subject, updated_at, input_data")
        .eq("teacher_id", user.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("lesson_plan_templates")
        .select("id, title, description, phases_json, created_at")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false }),
    ]);
    setItems((plans as any[]) ?? []);
    setTemplates((tpls as any[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /** Collect all subjects associated with a plan (primary + per-slot). */
  function planSubjects(plan: PlanRow): string[] {
    const set = new Set<string>();
    if (plan.subject) set.add(plan.subject);
    const extra: string[] = plan.input_data?.subjects ?? [];
    for (const s of extra) if (s) set.add(s);
    const slots: LinkedSlot[] = plan.input_data?.linkedSlots ?? [];
    for (const sl of slots) if (sl.subject) set.add(sl.subject);
    return Array.from(set);
  }

  function planSlots(plan: PlanRow): LinkedSlot[] {
    const slots: LinkedSlot[] = plan.input_data?.linkedSlots ?? [];
    if (slots.length) return slots;
    const legacyDate = plan.input_data?.linkedDate;
    const legacyTime = plan.input_data?.linkedTime;
    if (legacyDate) {
      return [
        {
          subject: plan.subject,
          date: legacyDate,
          time: legacyTime,
        },
      ];
    }
    return [];
  }

  const allSubjects = useMemo(() => {
    const set = new Set<string>();
    for (const p of items) for (const s of planSubjects(p)) set.add(s);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "cs"));
  }, [items]);

  const filtered = useMemo(() => {
    let list = items;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (it) =>
          (it.title || "").toLowerCase().includes(q) ||
          (it.subject || "").toLowerCase().includes(q) ||
          planSubjects(it).some((s) => s.toLowerCase().includes(q)),
      );
    }
    if (subjectFilter !== "__all") {
      list = list.filter((it) => planSubjects(it).includes(subjectFilter));
    }
    return list;
  }, [items, search, subjectFilter]);

  /** Group filtered plans by subject (a plan with multiple subjects shows in each group). */
  const grouped = useMemo(() => {
    const map = new Map<string, PlanRow[]>();
    for (const p of filtered) {
      const subs = planSubjects(p);
      const keys = subs.length ? subs : [NO_SUBJECT];
      for (const k of keys) {
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(p);
      }
    }
    return Array.from(map.entries()).sort(([a], [b]) =>
      a === NO_SUBJECT ? 1 : b === NO_SUBJECT ? -1 : a.localeCompare(b, "cs"),
    );
  }, [filtered]);

  function handleCreate() {
    navigate("/ucitel/plany-hodin/novy");
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const { error } = await supabase.from("lesson_plans").delete().eq("id", deleteId);
    setDeleting(false);
    if (error) {
      toast({
        title: "Smazání se nezdařilo",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Plán smazán" });
      setItems((prev) => prev.filter((p) => p.id !== deleteId));
    }
    setDeleteId(null);
  }

  function PlanCard({ plan }: { plan: PlanRow }) {
    const slots = planSlots(plan);
    return (
      <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-2 hover:border-primary/40 transition-colors group relative">
        <button
          onClick={() => navigate(`/ucitel/plany-hodin/${plan.id}`)}
          className="text-left flex flex-col gap-2"
        >
          <div className="flex items-center gap-2 min-w-0 pr-8">
            <BookOpen className="w-4 h-4 text-primary shrink-0" />
            <span className="font-semibold text-sm truncate">{plan.title}</span>
          </div>
          {planSubjects(plan).length > 0 && (
            <p className="text-xs text-muted-foreground">
              {planSubjects(plan).join(" · ")}
            </p>
          )}
          {slots.length > 0 && (
            <div className="flex flex-col gap-1">
              {slots.slice(0, 3).map((sl, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <Calendar className="w-3 h-3 shrink-0" />
                  <span className="truncate">
                    {sl.date
                      ? format(new Date(sl.date), "d. M. yyyy", { locale: cs })
                      : "—"}
                    {sl.time ? ` · ${sl.time.replace("-", " – ")}` : ""}
                    {sl.className ? ` · ${sl.className}` : ""}
                  </span>
                </div>
              ))}
              {slots.length > 3 && (
                <span className="text-[11px] text-muted-foreground/70">
                  +{slots.length - 3} dalších termínů
                </span>
              )}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground/70 mt-auto">
            Upraveno {format(new Date(plan.updated_at), "d. M. yyyy", { locale: cs })}
          </p>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setDeleteId(plan.id);
          }}
          className="absolute top-3 right-3 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
          aria-label="Smazat plán"
          title="Smazat plán"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    );
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

        <Tabs defaultValue="plans" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="plans">Plány ({items.length})</TabsTrigger>
            <TabsTrigger value="templates">Šablony ({templates.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="plans" className="mt-0">
            <div className="grid sm:grid-cols-[1fr_220px] gap-3 mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  className="pl-9"
                  placeholder="Hledat plán…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrovat podle předmětu" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Všechny předměty</SelectItem>
                  {allSubjects.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                <BookOpen className="w-12 h-12 text-muted-foreground/40" />
                <p className="text-muted-foreground text-sm">
                  {search.trim() || subjectFilter !== "__all"
                    ? "Žádný plán neodpovídá filtru."
                    : "Zatím nemáš žádné plány hodin. Vytvoř první!"}
                </p>
                {!search.trim() && subjectFilter === "__all" && (
                  <Button onClick={handleCreate}>
                    <Plus className="w-4 h-4 mr-2" />
                    Nový plán
                  </Button>
                )}
              </div>
            ) : (
              <Accordion
                type="multiple"
                defaultValue={grouped.map(([k]) => k)}
                className="space-y-3"
              >
                {grouped.map(([subjectKey, plans]) => (
                  <AccordionItem
                    key={subjectKey}
                    value={subjectKey}
                    className="border border-border rounded-xl bg-card/40 px-4"
                  >
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">
                          {subjectKey === NO_SUBJECT ? "Bez předmětu" : subjectKey}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({plans.length})
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid gap-3 sm:grid-cols-2 pt-1">
                        {plans.map((plan) => (
                          <PlanCard key={`${subjectKey}-${plan.id}`} plan={plan} />
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </TabsContent>

          <TabsContent value="templates" className="mt-0">
            {loading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
                <LayoutTemplate className="w-12 h-12 text-muted-foreground/40" />
                <p className="text-muted-foreground text-sm">
                  Zatím nemáš žádné šablony. Vytvoř plán a ulož ho jako šablonu.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="bg-card border border-border rounded-xl p-5 flex flex-col gap-2 hover:border-primary/40 transition-colors group relative"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-8">
                      <LayoutTemplate className="w-4 h-4 text-primary shrink-0" />
                      <span className="font-semibold text-sm truncate">{tpl.title}</span>
                    </div>
                    {tpl.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {tpl.description}
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground/70">
                      {Array.isArray(tpl.phases_json) ? tpl.phases_json.length : 0} fází · vytvořeno{" "}
                      {format(new Date(tpl.created_at), "d. M. yyyy", { locale: cs })}
                    </p>
                    <button
                      onClick={() => setDeleteTemplateId(tpl.id)}
                      className="absolute top-3 right-3 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                      aria-label="Smazat šablonu"
                      title="Smazat šablonu"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <AlertDialog
        open={!!deleteTemplateId}
        onOpenChange={(o) => !o && setDeleteTemplateId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smazat šablonu?</AlertDialogTitle>
            <AlertDialogDescription>
              Tato akce je nevratná. Existující plány nebudou ovlivněny.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingTemplate}>Zrušit</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteTemplate}
              disabled={deletingTemplate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingTemplate ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Smazat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smazat plán hodiny?</AlertDialogTitle>
            <AlertDialogDescription>
              Tato akce je nevratná. Plán bude trvale odstraněn ze všech termínů,
              ke kterým byl přiřazen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Zrušit</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Smazat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SiteFooter />
    </div>
  );
}
