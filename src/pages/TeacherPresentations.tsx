import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Monitor, Plus, Link2, Trash2, BookOpen, CalendarDays, Layers, ArrowLeft,
} from "lucide-react";
import PresentationEditorDialog from "@/components/admin/PresentationEditorDialog";
import { themeIdFromSlides } from "@/lib/presentation-themes";

interface StandalonePresentation {
  id: string;
  title: string;
  slides: any[];
  lesson_id: string | null;
  created_at: string;
  updated_at: string;
  lessonTitle?: string | null;
}

interface LessonOption {
  id: string;
  title: string;
  textbookTitle: string;
  description?: string | null;
}

interface TextbookOption {
  id: string;
  title: string;
  lessonCount: number;
}


const emptySlide = (title: string) => ({
  slideId: `slide-${Date.now()}`,
  type: "content",
  blocks: [],
  projector: { headline: title, body: "" },
});

/** Samostatné prezentace nezávislé na učebnici (ČÁST 2). */
const TeacherPresentations = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [items, setItems] = useState<StandalonePresentation[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  // Editor
  const [editing, setEditing] = useState<StandalonePresentation | null>(null);
  const [pendingSlides, setPendingSlides] = useState<any[]>([]);
  const [editingSlideIndex, setEditingSlideIndex] = useState(0);

  // Propojení s lekcí – dvoustupňový výběr (učebnice → lekce)
  const [linkTarget, setLinkTarget] = useState<StandalonePresentation | null>(null);
  const [textbookOptions, setTextbookOptions] = useState<TextbookOption[]>([]);
  const [selectedTextbook, setSelectedTextbook] = useState<TextbookOption | null>(null);
  const [lessonOptions, setLessonOptions] = useState<LessonOption[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [textbooksLoading, setTextbooksLoading] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [lessonQuery, setLessonQuery] = useState("");


  const fetchItems = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("teacher_presentations" as any)
        .select("id, title, slides, lesson_id, created_at, updated_at")
        .eq("teacher_id", user.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;

      const rows = ((data ?? []) as any[]).map((r) => ({
        id: r.id,
        title: r.title,
        slides: Array.isArray(r.slides) ? r.slides : [],
        lesson_id: r.lesson_id ?? null,
        created_at: r.created_at,
        updated_at: r.updated_at,
      })) as StandalonePresentation[];

      const lessonIds = rows.map((r) => r.lesson_id).filter(Boolean) as string[];
      if (lessonIds.length) {
        const { data: lessons } = await supabase
          .from("teacher_textbook_lessons")
          .select("id, title")
          .in("id", lessonIds);
        const byId = new Map(((lessons ?? []) as any[]).map((l) => [l.id, l.title]));
        rows.forEach((r) => { r.lessonTitle = r.lesson_id ? byId.get(r.lesson_id) ?? null : null; });
      }
      setItems(rows);
    } catch (e: any) {
      toast({ title: "Prezentace se nepodařilo načíst", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); /* eslint-disable-next-line */ }, []);

  // Otevření editoru přímo z odkazu (?open=<id>)
  useEffect(() => {
    const openId = params.get("open");
    if (!openId || loading) return;
    const found = items.find((i) => i.id === openId);
    if (found) {
      openEditor(found);
      params.delete("open");
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, items]);

  const openEditor = (p: StandalonePresentation) => {
    setEditing(p);
    setPendingSlides(p.slides.length ? p.slides : [emptySlide(p.title)]);
    setEditingSlideIndex(0);
  };

  const handleCreate = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nejste přihlášen(a).");
      const { data, error } = await supabase
        .from("teacher_presentations" as any)
        .insert({ teacher_id: user.id, title, slides: [] as any })
        .select("id, title, slides, lesson_id, created_at, updated_at")
        .single();
      if (error) throw error;
      const created: StandalonePresentation = {
        id: (data as any).id,
        title: (data as any).title,
        slides: [],
        lesson_id: null,
        created_at: (data as any).created_at,
        updated_at: (data as any).updated_at,
      };
      setItems((prev) => [created, ...prev]);
      setCreateOpen(false);
      setNewTitle("");
      openEditor(created);
    } catch (e: any) {
      toast({ title: "Vytvoření se nepodařilo", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (p: StandalonePresentation) => {
    if (!window.confirm(`Smazat prezentaci „${p.title}“? Tuto akci nelze vrátit.`)) return;
    const { error } = await supabase.from("teacher_presentations" as any).delete().eq("id", p.id);
    if (error) {
      toast({ title: "Smazání se nepodařilo", description: error.message, variant: "destructive" });
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== p.id));
    toast({ title: "Prezentace smazána" });
  };

  const saveSlides = async (id: string, slides: any[]) => {
    const { error } = await supabase
      .from("teacher_presentations" as any)
      .update({ slides: slides as any, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, slides } : i)));
    // Propojená lekce – držíme zpětnou kompatibilitu se starým systémem.
    const linked = items.find((i) => i.id === id)?.lesson_id;
    if (linked) {
      await supabase
        .from("teacher_textbook_lessons")
        .update({ presentation_slides: slides, theme_id: themeIdFromSlides(slides) } as any)
        .eq("id", linked);
    }
  };

  /** Krok 1 – učebnice učitele. */
  const openLinkPicker = async (p: StandalonePresentation) => {
    setLinkTarget(p);
    setLessonQuery("");
    setSelectedTextbook(null);
    setLessonOptions([]);
    setTextbooksLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("teacher_textbooks")
        .select("id, title, updated_at, teacher_textbook_lessons(count)")
        .eq("teacher_id", user.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      setTextbookOptions(((data ?? []) as any[]).map((t) => ({
        id: t.id,
        title: t.title,
        lessonCount: t.teacher_textbook_lessons?.[0]?.count ?? 0,
      })));
    } catch (e: any) {
      toast({ title: "Učebnice se nepodařilo načíst", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setTextbooksLoading(false);
    }
  };

  /** Krok 2 – lekce vybrané učebnice. */
  const selectTextbook = async (tb: TextbookOption) => {
    setSelectedTextbook(tb);
    setLessonQuery("");
    setLessonsLoading(true);
    try {
      const { data, error } = await supabase
        .from("teacher_textbook_lessons")
        .select("id, title, status, sort_order")
        .eq("textbook_id", tb.id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      setLessonOptions(((data ?? []) as any[]).map((l) => ({
        id: l.id,
        title: l.title,
        textbookTitle: tb.title,
        description: l.status === "published" ? "Zveřejněná lekce" : "Koncept",
      })));
    } catch (e: any) {
      toast({ title: "Lekce se nepodařilo načíst", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setLessonsLoading(false);
    }
  };


  /** ČÁST 4 – propojení s lekcí + okamžité zkopírování slidů do lekce. */
  const linkToLesson = async (lesson: LessonOption) => {
    if (!linkTarget) return;
    setLinkingId(lesson.id);
    try {
      const { error } = await supabase
        .from("teacher_presentations" as any)
        .update({ lesson_id: lesson.id })
        .eq("id", linkTarget.id);
      if (error) throw error;

      const slides = linkTarget.slides ?? [];
      if (slides.length) {
        const { error: lessonError } = await supabase
          .from("teacher_textbook_lessons")
          .update({ presentation_slides: slides, theme_id: themeIdFromSlides(slides) } as any)
          .eq("id", lesson.id);
        if (lessonError) throw lessonError;
      }

      setItems((prev) => prev.map((i) => (
        i.id === linkTarget.id ? { ...i, lesson_id: lesson.id, lessonTitle: lesson.title } : i
      )));
      setLinkTarget(null);
      toast({
        title: "Propojeno s lekcí",
        description: `Prezentace je nyní dostupná i v lekci „${lesson.title}“.`,
      });
    } catch (e: any) {
      toast({ title: "Propojení se nepodařilo", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setLinkingId(null);
    }
  };

  const filteredLessons = useMemo(() => {
    const q = lessonQuery.trim().toLowerCase();
    if (!q) return lessonOptions;
    return lessonOptions.filter((l) => l.title.toLowerCase().includes(q));
  }, [lessonOptions, lessonQuery]);

  const filteredTextbooks = useMemo(() => {
    const q = lessonQuery.trim().toLowerCase();
    if (!q) return textbookOptions;
    return textbookOptions.filter((t) => t.title.toLowerCase().includes(q));
  }, [textbookOptions, lessonQuery]);


  /** Spuštění živé prezentace ze samostatné prezentace. */
  const launchLive = async (slides: any[], title: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Nejste přihlášen(a).");
      const gameCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { data, error } = await supabase.from("game_sessions").insert({
        teacher_id: session.user.id,
        title,
        game_code: gameCode,
        activity_data: slides as any,
        settings: { timePerQuestion: 30, shuffleQuestions: false, shuffleAnswers: false, showLeaderboardAfterEach: false },
        status: "lobby",
        current_question_index: -1,
      }).select("id").single();
      if (error) throw error;
      toast({ title: "Prezentace spuštěna", description: `Kód: ${gameCode}` });
      navigate(`/live/ucitel/${(data as any).id}`);
    } catch (e: any) {
      toast({ title: "Spuštění se nepodařilo", description: e?.message ?? String(e), variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-5xl" style={{ paddingTop: "calc(70px + 3rem)" }}>
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-3xl font-bold">Prezentace</h1>
            <p className="mt-1 text-muted-foreground">
              Samostatné prezentace, které nemusí patřit do žádné učebnice. Kdykoli je můžete propojit s lekcí.
            </p>
          </div>
          <Button className="gap-1 shrink-0" onClick={() => { setNewTitle(""); setCreateOpen(true); }}>
            <Plus className="h-4 w-4" /> Nová prezentace
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-16 text-center">
            <Monitor className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="mb-4 text-muted-foreground">Zatím nemáte žádnou samostatnou prezentaci.</p>
            <Button onClick={() => setCreateOpen(true)} className="gap-1">
              <Plus className="h-4 w-4" /> Vytvořit první prezentaci
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => (
              <Card key={p.id} className="flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-start gap-2 text-base">
                    <Monitor className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="line-clamp-2">{p.title}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Layers className="h-3.5 w-3.5" /> {p.slides.length} slidů
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {new Date(p.updated_at).toLocaleDateString("cs-CZ")}
                    </span>
                  </div>

                  {p.lesson_id && (
                    <Badge variant="secondary" className="w-fit gap-1 text-xs">
                      <BookOpen className="h-3 w-3" />
                      Propojeno s lekcí: {p.lessonTitle ?? "lekce"}
                    </Badge>
                  )}

                  <div className="mt-auto flex flex-wrap gap-2">
                    <Button size="sm" className="gap-1" onClick={() => openEditor(p)}>
                      <Monitor className="h-3.5 w-3.5" /> Otevřít editor
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => openLinkPicker(p)}>
                      <Link2 className="h-3.5 w-3.5" /> {p.lesson_id ? "Změnit lekci" : "Propojit s lekcí"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(p)} title="Smazat prezentaci">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />

      {/* Nová prezentace */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nová prezentace</DialogTitle>
            <DialogDescription>Zadejte název. Prezentaci můžete později propojit s lekcí.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Název prezentace</Label>
              <Input
                className="mt-1"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="např. Úvod do fotosyntézy"
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              />
            </div>
            <Button className="w-full" onClick={handleCreate} disabled={creating || !newTitle.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Vytvořit a otevřít editor"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Propojení s lekcí – dvoustupňový výběr */}
      <Dialog open={!!linkTarget} onOpenChange={(o) => { if (!o) { setLinkTarget(null); setSelectedTextbook(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-4 w-4" /> Propojit s lekcí
            </DialogTitle>
            <DialogDescription>
              {selectedTextbook
                ? `Vyberte lekci v učebnici „${selectedTextbook.title}“. Slidy se do lekce hned zkopírují.`
                : "Nejprve vyberte učebnici, ve které lekce leží."}
            </DialogDescription>
          </DialogHeader>

          {selectedTextbook && (
            <Button
              variant="ghost"
              size="sm"
              className="w-fit gap-1"
              onClick={() => { setSelectedTextbook(null); setLessonQuery(""); }}
            >
              <ArrowLeft className="h-4 w-4" /> Zpět na učebnice
            </Button>
          )}

          <Input
            placeholder={selectedTextbook ? "Hledat lekci…" : "Hledat učebnici…"}
            value={lessonQuery}
            onChange={(e) => setLessonQuery(e.target.value)}
          />

          {!selectedTextbook ? (
            textbooksLoading ? (
              <div className="flex justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : filteredTextbooks.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">
                Žádná učebnice nenalezena. Vytvořte učebnici a zkuste to znovu.
              </p>
            ) : (
              <div className="max-h-[50vh] space-y-1 overflow-y-auto pr-1">
                {filteredTextbooks.map((t) => (
                  <Button
                    key={t.id}
                    variant="outline"
                    className="h-auto w-full justify-between gap-2 py-2 text-left"
                    onClick={() => selectTextbook(t)}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{t.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {t.lessonCount} {t.lessonCount === 1 ? "lekce" : t.lessonCount >= 2 && t.lessonCount <= 4 ? "lekce" : "lekcí"}
                      </span>
                    </span>
                    <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Button>
                ))}
              </div>
            )
          ) : lessonsLoading ? (
            <div className="flex justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : filteredLessons.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              V této učebnici není žádná odpovídající lekce.
            </p>
          ) : (
            <div className="max-h-[50vh] space-y-1 overflow-y-auto pr-1">
              {filteredLessons.map((l) => (
                <Button
                  key={l.id}
                  variant="outline"
                  className="h-auto w-full justify-between gap-2 py-2 text-left"
                  disabled={!!linkingId}
                  onClick={() => linkToLesson(l)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{l.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{l.description}</span>
                  </span>
                  {linkingId === l.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                </Button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>


      {/* ČÁST 3 – editor nad samostatnou prezentací */}
      <PresentationEditorDialog
        presentationLesson={editing ? { id: editing.id, title: editing.title } : null}
        source={editing ? { type: "standalone", presentationId: editing.id } : undefined}
        pendingSlides={pendingSlides}
        setPendingSlides={setPendingSlides}
        editingSlideIndex={editingSlideIndex}
        setEditingSlideIndex={setEditingSlideIndex}
        hasSavedPresentation={!!editing?.slides.length}
        onClose={() => { setEditing(null); setPendingSlides([]); }}
        onLaunch={async (slides) => {
          const title = editing?.title ?? "Prezentace";
          if (editing) await saveSlides(editing.id, slides).catch(() => undefined);
          setEditing(null);
          setPendingSlides([]);
          await launchLive(slides, title);
        }}
        onSave={async (slides) => {
          if (!editing) return;
          await saveSlides(editing.id, slides);
        }}
        existingSession={null}
        onContinueExisting={() => {}}
        onLaunchNew={() => {}}
        onCloseExisting={() => {}}
      />
    </div>
  );
};

export default TeacherPresentations;
