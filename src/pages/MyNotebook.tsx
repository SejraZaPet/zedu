import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SiteHeader from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ArrowLeft, Copy, FileDown, FolderPlus, GripVertical, NotebookPen, Pencil, Plus, Trash2, Users,
} from "lucide-react";
import NotebookCanvas from "@/components/notebook/NotebookCanvas";
import NotebookPageThumb from "@/components/notebook/NotebookPageThumb";
import {
  BACKGROUND_LABELS, BackgroundStyle, COVER_COLORS, EMPTY_CONTENT, Notebook, NotebookPage,
  NotebookPageContent, addPageToPortfolio, createNotebook, exportNotebookToPdf, loadClassStudentNames,
  loadNotebooks, loadPages, normalizeContent, savePageContent, upsertClassRosterTextBox,
} from "@/lib/notebook";
import { cn } from "@/lib/utils";

export default function MyNotebook() {
  const { user, role } = useAuth();
  const [params, setParams] = useSearchParams();
  const lessonId = params.get("lekce");
  const classId = params.get("trida");
  const lessonTitle = params.get("nazev");

  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Notebook | null>(null);
  const [pages, setPages] = useState<NotebookPage[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  const [newOpen, setNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newColor, setNewColor] = useState(COVER_COLORS[0]);
  const [renaming, setRenaming] = useState<Notebook | null>(null);
  const [renameTitle, setRenameTitle] = useState("");

  const saveTimer = useRef<number | null>(null);
  const isStudent = role !== "teacher" && role !== "lektor" && role !== "admin" && role !== "school_admin";

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setNotebooks(await loadNotebooks(user.id));
    } catch (e: any) {
      toast.error(e.message || "Sešity se nepodařilo načíst.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const openNotebook = useCallback(async (nb: Notebook) => {
    setOpen(nb);
    setActiveIndex(0);
    try {
      const p = await loadPages(nb.id);
      setPages(p);
    } catch (e: any) {
      toast.error(e.message || "Stránky se nepodařilo načíst.");
    }
  }, []);

  /* Propojení s lekcí: ?lekce=<id> → otevři existující nebo založ nový */
  const handledLesson = useRef(false);
  useEffect(() => {
    if (!user || !lessonId || loading || handledLesson.current) return;
    handledLesson.current = true;
    const existing = notebooks.find((n) => n.related_lesson_id === lessonId);
    if (existing) {
      openNotebook(existing);
      return;
    }
    (async () => {
      try {
        const nb = await createNotebook({
          ownerId: user.id,
          title: lessonTitle ? `Poznámky: ${lessonTitle}` : "Poznámky k lekci",
          coverColor: COVER_COLORS[1],
          relatedLessonId: lessonId,
        });
        toast.success("Nový sešit propojený s lekcí byl založen.");
        await refresh();
        openNotebook(nb);
      } catch (e: any) {
        toast.error(e.message || "Sešit se nepodařilo založit.");
      }
    })();
  }, [user, lessonId, lessonTitle, loading, notebooks, openNotebook, refresh]);

  /* Propojení s třídou: ?trida=<id> → otevři existující nebo založ nový */
  const handledClass = useRef(false);
  useEffect(() => {
    if (!user || !classId || loading || handledClass.current) return;
    handledClass.current = true;
    const existing = notebooks.find((n) => n.related_class_id === classId);
    if (existing) {
      openNotebook(existing);
      return;
    }
    (async () => {
      try {
        const nb = await createNotebook({
          ownerId: user.id,
          title: lessonTitle ? `Poznámky: ${lessonTitle}` : "Poznámky ke třídě",
          coverColor: COVER_COLORS[2],
          relatedClassId: classId,
        });
        toast.success("Nový sešit propojený s třídou byl založen.");
        await refresh();
        openNotebook(nb);
      } catch (e: any) {
        toast.error(e.message || "Sešit se nepodařilo založit.");
      }
    })();
  }, [user, classId, lessonTitle, loading, notebooks, openNotebook, refresh]);

  const activePage = pages[activeIndex] ?? null;

  /* --- automatické ukládání obsahu stránky --- */
  const onContentChange = (next: NotebookPageContent) => {
    if (!activePage) return;
    setPages((prev) => prev.map((p, i) => (i === activeIndex ? { ...p, content: next } : p)));
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    const pageId = activePage.id;
    setSaving(true);
    saveTimer.current = window.setTimeout(async () => {
      try {
        await savePageContent(pageId, next);
      } catch (e: any) {
        toast.error(e.message || "Uložení se nepodařilo.");
      } finally {
        setSaving(false);
      }
    }, 800);
  };

  const setBackground = async (style: BackgroundStyle) => {
    if (!activePage) return;
    setPages((prev) => prev.map((p, i) => (i === activeIndex ? { ...p, background_style: style } : p)));
    await supabase.from("notebook_pages").update({ background_style: style }).eq("id", activePage.id);
  };

  const addPage = async (from?: NotebookPage) => {
    if (!open) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("notebook_pages")
        .insert({
          notebook_id: open.id,
          page_order: pages.length,
          background_style: from?.background_style ?? "blank",
          content: (from ? from.content : EMPTY_CONTENT) as any,
        })
        .select("*")
        .single();
      if (error) throw error;
      const page = { ...(data as any), content: normalizeContent((data as any).content) } as NotebookPage;
      setPages((prev) => [...prev, page]);
      setActiveIndex(pages.length);
    } catch (e: any) {
      toast.error(e.message || "Stránku se nepodařilo přidat.");
    } finally {
      setBusy(false);
    }
  };

  const deletePage = async (page: NotebookPage) => {
    if (pages.length <= 1) return toast.error("Sešit musí mít alespoň jednu stránku.");
    if (!window.confirm("Smazat tuto stránku?")) return;
    await supabase.from("notebook_pages").delete().eq("id", page.id);
    const next = pages.filter((p) => p.id !== page.id);
    setPages(next);
    setActiveIndex((i) => Math.max(0, Math.min(i, next.length - 1)));
  };

  const persistOrder = async (list: NotebookPage[]) => {
    await Promise.all(
      list.map((p, i) => supabase.from("notebook_pages").update({ page_order: i }).eq("id", p.id)),
    );
  };

  const onDrop = async (target: number) => {
    if (dragIndex === null || dragIndex === target) return setDragIndex(null);
    const next = [...pages];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(target, 0, moved);
    setPages(next);
    setActiveIndex(next.findIndex((p) => p.id === moved.id));
    setDragIndex(null);
    await persistOrder(next);
  };

  const create = async () => {
    if (!user || !newTitle.trim()) return toast.error("Zadej název sešitu.");
    setBusy(true);
    try {
      const nb = await createNotebook({
        ownerId: user.id,
        title: newTitle.trim(),
        subject: newSubject.trim() || null,
        coverColor: newColor,
      });
      setNewOpen(false);
      setNewTitle(""); setNewSubject("");
      await refresh();
      openNotebook(nb);
    } catch (e: any) {
      toast.error(e.message || "Sešit se nepodařilo založit.");
    } finally {
      setBusy(false);
    }
  };

  const removeNotebook = async (nb: Notebook) => {
    if (!window.confirm(`Smazat sešit „${nb.title}“ včetně všech stránek?`)) return;
    await supabase.from("notebooks").delete().eq("id", nb.id);
    toast.success("Sešit byl smazán.");
    refresh();
  };

  const doRename = async () => {
    if (!renaming || !renameTitle.trim()) return;
    await supabase.from("notebooks").update({ title: renameTitle.trim() }).eq("id", renaming.id);
    setRenaming(null);
    refresh();
    if (open?.id === renaming.id) setOpen({ ...open, title: renameTitle.trim() });
  };

  const exportPdf = async () => {
    if (!open) return;
    setBusy(true);
    try {
      await exportNotebookToPdf(open, pages);
      toast.success("PDF bylo vygenerováno.");
    } catch (e: any) {
      toast.error(e.message || "Export do PDF se nepodařil.");
    } finally {
      setBusy(false);
    }
  };

  const toPortfolio = async () => {
    if (!open || !activePage || !user) return;
    setBusy(true);
    try {
      await addPageToPortfolio(user.id, open, activePage, activeIndex + 1);
      toast.success("Stránka byla přidána do portfolia.");
    } catch (e: any) {
      toast.error(e.message || "Přidání do portfolia se nepodařilo.");
    } finally {
      setBusy(false);
    }
  };

  const insertClassNames = async () => {
    if (!open?.related_class_id || !activePage) return;
    setBusy(true);
    try {
      const names = await loadClassStudentNames(open.related_class_id);
      if (names.length === 0) {
        toast.error("Třída zatím nemá žádné žáky.");
        return;
      }
      const next = upsertClassRosterTextBox(activePage.content, names);
      setPages((prev) => prev.map((p, i) => (i === activeIndex ? { ...p, content: next } : p)));
      await savePageContent(activePage.id, next);
      toast.success(`Vloženo ${names.length} jmen.`);
    } catch (e: any) {
      toast.error(e.message || "Jména se nepodařilo vložit.");
    } finally {
      setBusy(false);
    }
  };

  const backToList = () => {
    setOpen(null);
    setPages([]);
    if (lessonId || classId) {
      params.delete("lekce"); params.delete("trida"); params.delete("nazev");
      setParams(params, { replace: true });
    }
    refresh();
  };

  const content = useMemo(() => activePage?.content ?? EMPTY_CONTENT, [activePage]);

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="container mx-auto px-4 pt-28">
          <p className="text-muted-foreground">Pro práci se sešitem se přihlas.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 pb-16 pt-28">
        {!open ? (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="flex items-center gap-2 text-2xl font-bold">
                  <NotebookPen className="h-7 w-7" /> Můj sešit
                </h1>
                <p className="text-sm text-muted-foreground">
                  Digitální sešit pro psaní, kreslení i vkládání obrázků. Vše se ukládá automaticky.
                </p>
              </div>
              <Button className="gap-1.5" onClick={() => setNewOpen(true)}>
                <Plus className="h-4 w-4" /> Nový sešit
              </Button>
            </div>

            {loading ? (
              <p className="text-muted-foreground">Načítám…</p>
            ) : notebooks.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  Zatím tu není žádný sešit. Založ si první.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {notebooks.map((nb) => (
                  <Card key={nb.id} className="overflow-hidden">
                    <div className="h-3 w-full" style={{ backgroundColor: nb.cover_color || COVER_COLORS[0] }} />
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{nb.title}</CardTitle>
                      {nb.subject && <p className="text-xs text-muted-foreground">{nb.subject}</p>}
                      {nb.related_lesson_id && (
                        <p className="text-xs text-muted-foreground">Propojeno s lekcí</p>
                      )}
                      {nb.related_class_id && (
                        <p className="text-xs text-muted-foreground">Propojeno s třídou</p>
                      )}
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => openNotebook(nb)}>Otevřít</Button>
                      <Button
                        size="sm" variant="outline" className="gap-1.5"
                        onClick={() => { setRenaming(nb); setRenameTitle(nb.title); }}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Přejmenovat
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => removeNotebook(nb)}>
                        <Trash2 className="h-3.5 w-3.5" /> Smazat
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" className="gap-1.5" onClick={backToList}>
                  <ArrowLeft className="h-4 w-4" /> Zpět na sešity
                </Button>
                <h1 className="text-xl font-bold">{open.title}</h1>
                <span className="text-xs text-muted-foreground">
                  {saving ? "Ukládám…" : "Uloženo"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" disabled={busy} onClick={exportPdf}>
                  <FileDown className="h-4 w-4" /> Exportovat PDF
                </Button>
                {open.related_class_id && (
                  <Button variant="outline" size="sm" className="gap-1.5" disabled={busy} onClick={insertClassNames}>
                    <Users className="h-4 w-4" /> Vložit jména žáků třídy
                  </Button>
                )}
                {isStudent && (
                  <Button variant="outline" size="sm" className="gap-1.5" disabled={busy} onClick={toPortfolio}>
                    <FolderPlus className="h-4 w-4" /> Přidat do portfolia
                  </Button>
                )}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[180px_1fr]">
              <aside className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Stránky</span>
                  <Button size="icon" variant="outline" title="Přidat stránku" disabled={busy} onClick={() => addPage()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {pages.map((p, i) => (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={() => setDragIndex(i)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => onDrop(i)}
                      className={cn(
                        "rounded-lg border p-1.5 transition-colors",
                        i === activeIndex ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                        dragIndex === i && "opacity-50",
                      )}
                    >
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => setActiveIndex(i)}
                        aria-label={`Stránka ${i + 1}`}
                      >
                        <NotebookPageThumb content={p.content} backgroundStyle={p.background_style} />
                      </button>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <GripVertical className="h-3 w-3 cursor-grab" /> {i + 1}
                        </span>
                        <span className="flex gap-1">
                          <Button
                            size="icon" variant="ghost" className="h-6 w-6"
                            title="Duplikovat stránku" onClick={() => addPage(p)}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon" variant="ghost" className="h-6 w-6"
                            title="Smazat stránku" onClick={() => deletePage(p)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </aside>

              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Podklad stránky</Label>
                  <Select
                    value={activePage?.background_style ?? "blank"}
                    onValueChange={(v) => setBackground(v as BackgroundStyle)}
                  >
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(BACKGROUND_LABELS) as BackgroundStyle[]).map((k) => (
                        <SelectItem key={k} value={k}>{BACKGROUND_LABELS[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {activePage && (
                  <NotebookCanvas
                    ownerId={user.id}
                    content={content}
                    backgroundStyle={activePage.background_style}
                    onChange={onContentChange}
                  />
                )}
              </section>
            </div>
          </>
        )}
      </main>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nový sešit</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="nb-title">Název *</Label>
              <Input id="nb-title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} maxLength={120} />
            </div>
            <div>
              <Label htmlFor="nb-subject">Předmět</Label>
              <Input id="nb-subject" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="např. Matematika" />
            </div>
            <div className="space-y-1">
              <Label>Barva obálky</Label>
              <div className="flex flex-wrap gap-2">
                {COVER_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Barva ${c}`}
                    aria-pressed={newColor === c}
                    onClick={() => setNewColor(c)}
                    className={cn(
                      "h-7 w-7 rounded-full border-2",
                      newColor === c ? "border-foreground scale-110" : "border-transparent",
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Zrušit</Button>
            <Button onClick={create} disabled={busy}>{busy ? "Zakládám…" : "Založit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renaming} onOpenChange={(v) => !v && setRenaming(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Přejmenovat sešit</DialogTitle></DialogHeader>
          <Input value={renameTitle} onChange={(e) => setRenameTitle(e.target.value)} maxLength={120} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>Zrušit</Button>
            <Button onClick={doRename}>Uložit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
