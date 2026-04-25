import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { FileText, Plus, Search, Copy, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { cs } from "date-fns/locale";
import { emptyWorksheetSpec } from "@/lib/worksheet-defaults";
import type { WorksheetSpec } from "@/lib/worksheet-spec";

interface WorksheetRow {
  id: string;
  title: string;
  subject: string;
  grade_band: string;
  worksheet_mode: string;
  status: "draft" | "published";
  spec: any;
  updated_at: string;
}

const MODE_LABELS: Record<string, string> = {
  classwork: "Práce v hodině",
  homework: "Domácí úkol",
  test: "Test",
  revision: "Opakování",
};

export default function TeacherWorksheets() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromLessonId = searchParams.get("from_lesson");
  const fromLessonType = (searchParams.get("from_lesson_type") as "global" | "teacher" | null) || null;
  const returnTo = searchParams.get("return_to");
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<WorksheetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "published">("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    void load();
  }, [authLoading, user]);

  // Auto-create a worksheet when arriving with ?from_lesson=...
  useEffect(() => {
    if (authLoading || !user || !fromLessonId || !fromLessonType) return;
    let cancelled = false;
    (async () => {
      // fetch lesson title for default name
      const tableName =
        fromLessonType === "global" ? "textbook_lessons" : "teacher_textbook_lessons";
      const { data: lessonRow } = await supabase
        .from(tableName as any)
        .select("title")
        .eq("id", fromLessonId)
        .maybeSingle();
      if (cancelled) return;
      const title = `Pracovní list – ${(lessonRow as any)?.title ?? "Lekce"}`;
      const spec = emptyWorksheetSpec({ title });
      const { data: created, error } = await supabase
        .from("worksheets" as any)
        .insert({
          teacher_id: user.id,
          title,
          spec: spec as any,
          source_lesson_id: fromLessonId,
          source_lesson_type: fromLessonType,
        } as any)
        .select("id")
        .single();
      if (cancelled || error || !created) return;
      const params = new URLSearchParams();
      params.set("from_lesson", fromLessonId);
      params.set("from_lesson_type", fromLessonType);
      if (returnTo) params.set("return_to", returnTo);
      navigate(
        `/ucitel/pracovni-listy/${(created as any).id}?${params.toString()}`,
        { replace: true }
      );
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, fromLessonId, fromLessonType]);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("worksheets" as any)
      .select("*")
      .eq("teacher_id", user.id)
      .order("updated_at", { ascending: false });
    if (error) {
      toast({ title: "Nepodařilo se načíst pracovní listy", description: error.message, variant: "destructive" });
    } else {
      setItems((data as any) ?? []);
    }
    setLoading(false);
  }

  async function handleCreate() {
    if (!user) return;
    const spec = emptyWorksheetSpec();
    const { data, error } = await supabase
      .from("worksheets" as any)
      .insert({
        teacher_id: user.id,
        title: "Nový pracovní list",
        spec: spec as any,
      } as any)
      .select("id")
      .single();
    if (error || !data) {
      toast({ title: "Nepodařilo se vytvořit", description: error?.message, variant: "destructive" });
      return;
    }
    navigate(`/ucitel/pracovni-listy/${(data as any).id}`);
  }

  async function handleDuplicate(row: WorksheetRow) {
    if (!user) return;
    const { error } = await supabase.from("worksheets" as any).insert({
      teacher_id: user.id,
      title: `${row.title} (kopie)`,
      subject: row.subject,
      grade_band: row.grade_band,
      worksheet_mode: row.worksheet_mode,
      spec: row.spec,
      status: "draft",
    } as any);
    if (error) {
      toast({ title: "Duplikace selhala", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Duplikováno" });
      void load();
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from("worksheets" as any).delete().eq("id", deleteId);
    if (error) {
      toast({ title: "Nepodařilo se smazat", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Smazáno" });
      setItems((prev) => prev.filter((i) => i.id !== deleteId));
    }
    setDeleteId(null);
  }

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (statusFilter !== "all" && it.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!it.title.toLowerCase().includes(q) && !it.subject.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [items, search, statusFilter]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main
        className="flex-1 container mx-auto px-4 py-12 max-w-5xl"
        style={{ paddingTop: "calc(70px + 3rem)" }}
      >
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold">Pracovní listy</h1>
          <p className="text-muted-foreground mt-1">
            Tvoř a spravuj pracovní listy pro hodiny i domácí úkoly.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 mb-6 items-center">
          <Button onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" /> Nový pracovní list
          </Button>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Hledat podle názvu nebo předmětu…"
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Vše</SelectItem>
              <SelectItem value="draft">Koncepty</SelectItem>
              <SelectItem value="published">Publikované</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-center py-16 text-muted-foreground">Načítání…</div>
        ) : filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="font-heading text-xl font-semibold mb-2">
              {items.length === 0 ? "Zatím nemáš žádné pracovní listy" : "Žádný výsledek"}
            </h2>
            <p className="text-muted-foreground mb-6">
              {items.length === 0
                ? "Vytvoř první pracovní list a přidávej k němu otázky."
                : "Zkus změnit hledaný výraz nebo filtr."}
            </p>
            {items.length === 0 && (
              <Button onClick={handleCreate}>
                <Plus className="w-4 h-4 mr-2" /> Vytvoř první pracovní list
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((row) => {
              const spec = (row.spec as Partial<WorksheetSpec>) || {};
              const itemsCount = spec.variants?.[0]?.items?.length ?? 0;
              const totalPoints = spec.metadata?.totalPoints ?? 0;
              const totalTimeMin = spec.metadata?.totalTimeMin ?? 0;
              return (
                <div key={row.id} className="bg-card border border-border rounded-xl p-5 flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-heading text-lg font-semibold leading-tight">{row.title}</h3>
                    <Badge variant={row.status === "published" ? "default" : "secondary"}>
                      {row.status === "published" ? "Publikováno" : "Koncept"}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mb-3">
                    {[row.subject, row.grade_band, MODE_LABELS[row.worksheet_mode] ?? row.worksheet_mode]
                      .filter(Boolean)
                      .join(" · ") || "Bez metadat"}
                  </div>
                  <div className="text-xs text-muted-foreground mb-4">
                    {itemsCount} otázek · {totalPoints} bodů · ~{totalTimeMin} min
                  </div>
                  <div className="text-xs text-muted-foreground mb-4">
                    Upraveno {formatDistanceToNow(new Date(row.updated_at), { addSuffix: true, locale: cs })}
                  </div>
                  <div className="flex gap-2 mt-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => navigate(`/ucitel/pracovni-listy/${row.id}`)}
                    >
                      Otevřít
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDuplicate(row)} title="Duplikovat">
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteId(row.id)}
                      title="Smazat"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <SiteFooter />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smazat pracovní list?</AlertDialogTitle>
            <AlertDialogDescription>
              Akci nelze vrátit. Pracovní list bude trvale odstraněn.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Smazat</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
