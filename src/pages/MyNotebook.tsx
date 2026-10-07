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
  ArrowLeft, ChevronLeft, ChevronRight, Copy, FileDown, FolderPlus, GripVertical, ListTree, NotebookPen, Pencil, Plus, Search, Trash2, Users,
} from "lucide-react";
import NotebookCanvas from "@/components/notebook/NotebookCanvas";
import NotebookPageThumb from "@/components/notebook/NotebookPageThumb";
import {
  BACKGROUND_LABELS, BackgroundStyle, COVER_COLORS, EMPTY_CONTENT, Notebook, NotebookPage,
  NotebookPageContent, addPageToPortfolio, createNotebook, exportNotebookToPdf, loadClassStudentNames,
  loadNotebooks, loadPages, ensureMyCourseNotebooks, normalizeContent, savePageContent, savePageMeta, upsertClassRosterTextBox,
} from "@/lib/notebook";
import { buildToc, listSections, pageDisplayTitle } from "@/lib/notebook-toc";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export default function MyNotebook() {
  const { user, role } = useAuth();
  const [params, setParams] = useSearchParams();
  const lessonId = params.get("lekce");
  const classId = params.get("trida");
  const groupId = params.get("skupina");
  const lessonTitle = params.get("nazev");
  const subjectParam = params.get("predmet");
  const openId = params.get("otevrit");


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
  const metaTimer = useRef<number | null>(null);
  const [tocOpen, setTocOpen] = useState(false);
  const [tocQuery, setTocQuery] = useState("");
  const [includeToc, setIncludeToc] = useState(true);
  const [jumpValue, setJumpValue] = useState("");
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

  /* Propojení s třídou: ?trida=<id>(&predmet=<label>) → otevři existující nebo založ nový */
  const handledClass = useRef(false);
  useEffect(() => {
    if (!user || !classId || loading || handledClass.current) return;
    handledClass.current = true;
    const find = (list: Notebook[]) => subjectParam
      ? list.find((n) => n.related_class_id === classId && !n.related_group_id && (n.subject ?? "").trim().toLowerCase() === subjectParam.trim().toLowerCase())
      : list.find((n) => n.related_class_id === classId && !n.related_group_id);
    (async () => {
      try {
        let existing = find(notebooks);
        if (isStudent) {
          // Doplní subject_id starým sešitům a založí chybějící sešity kurzů (bez duplicit).
          await ensureMyCourseNotebooks();
          const fresh = await loadNotebooks(user.id);
          setNotebooks(fresh);
          existing = find(fresh) ?? existing;
        }
        if (existing) { openNotebook(existing); return; }
        const nb = await createNotebook({
          ownerId: user.id,
          title: subjectParam
            ? (lessonTitle ? `Sešit – ${lessonTitle}` : "Sešit")
            : (lessonTitle ? `Poznámky: ${lessonTitle}` : "Poznámky ke třídě"),
          subject: subjectParam || null,
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
  }, [user, classId, subjectParam, lessonTitle, loading, notebooks, openNotebook, refresh, isStudent]);

  /* Propojení se skupinou předmětu: ?skupina=<id> → sešit podle related_group_id */
  const handledGroup = useRef(false);
  useEffect(() => {
    if (!user || !groupId || loading || handledGroup.current) return;
    handledGroup.current = true;
    (async () => {
      try {
        let existing = notebooks.find((n) => n.related_group_id === groupId);
        if (!existing && isStudent) {
          await ensureMyCourseNotebooks();
          const fresh = await loadNotebooks(user.id);
          setNotebooks(fresh);
          existing = fresh.find((n) => n.related_group_id === groupId);
        }
        if (existing) { openNotebook(existing); return; }
        const { data: g } = await supabase.from("subject_groups").select("name, subject_id").eq("id", groupId).maybeSingle();
        const nb = await createNotebook({
          ownerId: user.id,
          title: `Sešit – ${lessonTitle || subjectParam || "předmět"}${g?.name ? ` (${g.name})` : ""}`,
          subject: subjectParam || null,
          subjectId: (g as any)?.subject_id ?? null,
          coverColor: COVER_COLORS[2],
          relatedGroupId: groupId,
        });
        toast.success("Nový sešit pro skupinu byl založen.");
        await refresh();
        openNotebook(nb);
      } catch (e: any) {
        toast.error(e.message || "Sešit se nepodařilo založit.");
      }
    })();
  }, [user, groupId, subjectParam, lessonTitle, loading, notebooks, openNotebook, refresh, isStudent]);

  /* Otevření konkrétního sešitu: ?otevrit=<id> */
  const handledOpenId = useRef(false);
  useEffect(() => {
    if (!user || !openId || loading || handledOpenId.current) return;
    const found = notebooks.find((n) => n.id === openId);
    if (!found) return;
    handledOpenId.current = true;
    openNotebook(found);
  }, [user, openId, loading, notebooks, openNotebook]);


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

  /* --- název a oddíl stránky (autosave po 800 ms, obsah se nemění) --- */
  const onMetaChange = (patch: { title?: string; section?: string }) => {
    if (!activePage) return;
    const pageId = activePage.id;
    const merged = { title: activePage.title ?? "", section: activePage.section ?? "", ...patch };
    setPages((prev) => prev.map((p) => (p.id === pageId ? { ...p, ...patch } : p)));
    if (metaTimer.current) window.clearTimeout(metaTimer.current);
    setSaving(true);
    metaTimer.current = window.setTimeout(async () => {
      try {
        await savePageMeta(pageId, merged);
      } catch (e: any) {
        toast.error(e.message || "Uložení názvu se nepodařilo.");
      } finally {
        setSaving(false);
      }
    }, 800);
  };

  const goTo = useCallback((i: number) => {
    setActiveIndex((cur) => {
      const n = pages.length;
      if (n === 0) return cur;
      return Math.max(0, Math.min(n - 1, i));
    });
  }, [pages.length]);

  /* Šipky ← → listují; ignoruje se při psaní do polí a textových bloků. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable)) return;
      if (document.querySelector("[role=dialog]")) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); setActiveIndex((i) => Math.max(0, i - 1)); }
      if (e.key === "ArrowRight") { e.preventDefault(); setActiveIndex((i) => Math.min(pages.length - 1, i + 1)); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pages.length]);

  const sections = useMemo(() => listSections(pages), [pages]);
  const tocGroups = useMemo(() => buildToc(pages, tocQuery), [pages, tocQuery]);

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
      await exportNotebookToPdf(open, pages, { includeToc });
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
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setTocQuery(""); setTocOpen(true); }}>
                  <ListTree className="h-4 w-4" /> Obsah
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" disabled={busy} onClick={exportPdf}>
                  <FileDown className="h-4 w-4" /> Exportovat PDF
                </Button>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Checkbox checked={includeToc} onCheckedChange={(v) => setIncludeToc(v === true)} />
                  Zahrnout obsah
                </label>
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
                        aria-label={`Stránka ${i + 1}: ${pageDisplayTitle(p, i)}`}
                      >
                        <NotebookPageThumb content={p.content} backgroundStyle={p.background_style} />
                        <span className="mt-1 block truncate text-xs font-medium" title={pageDisplayTitle(p, i)}>
                          {pageDisplayTitle(p, i)}
                        </span>
                        {p.section && <span className="block truncate text-[11px] text-muted-foreground">{p.section}</span>}
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
                {activePage && (
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[200px] flex-1">
                      <Label htmlFor="nb-page-title" className="text-xs">Název stránky {activeIndex + 1}</Label>
                      <Input
                        id="nb-page-title"
                        value={activePage.title ?? ""}
                        placeholder={`Strana ${activeIndex + 1}`}
                        maxLength={120}
                        onChange={(e) => onMetaChange({ title: e.target.value })}
                      />
                    </div>
                    <div className="w-48">
                      <Label htmlFor="nb-page-section" className="text-xs">Oddíl</Label>
                      <Input
                        id="nb-page-section"
                        list="nb-sections"
                        value={activePage.section ?? ""}
                        placeholder="např. Maso"
                        maxLength={80}
                        onChange={(e) => onMetaChange({ section: e.target.value })}
                      />
                      <datalist id="nb-sections">
                        {sections.map((s) => <option key={s} value={s} />)}
                      </datalist>
                    </div>
                  </div>
                )}

                <nav aria-label="Listování stránkami" className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline" className="h-11 gap-1 px-4" disabled={activeIndex <= 0}
                    onClick={() => goTo(activeIndex - 1)}
                  >
                    <ChevronLeft className="h-5 w-5" /> Předchozí
                  </Button>
                  <span className="px-1 text-sm font-medium" aria-live="polite">
                    Strana {pages.length ? activeIndex + 1 : 0} z {pages.length}
                  </span>
                  <Button
                    variant="outline" className="h-11 gap-1 px-4" disabled={activeIndex >= pages.length - 1}
                    onClick={() => goTo(activeIndex + 1)}
                  >
                    Další <ChevronRight className="h-5 w-5" />
                  </Button>
                  <form
                    className="flex items-center gap-1.5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const n = parseInt(jumpValue, 10);
                      if (Number.isFinite(n)) goTo(n - 1);
                      setJumpValue("");
                    }}
                  >
                    <Label htmlFor="nb-jump" className="text-sm">Přejít na</Label>
                    <Input
                      id="nb-jump" type="number" inputMode="numeric" min={1} max={pages.length}
                      className="h-11 w-20" value={jumpValue} onChange={(e) => setJumpValue(e.target.value)}
                    />
                    <Button type="submit" variant="secondary" className="h-11">Jít</Button>
                  </form>
                </nav>

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

      <Dialog open={tocOpen} onOpenChange={setTocOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden">
          <DialogHeader><DialogTitle>Obsah sešitu</DialogTitle></DialogHeader>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9" placeholder="Hledat podle názvu nebo oddílu…" aria-label="Hledat v obsahu"
              value={tocQuery} onChange={(e) => setTocQuery(e.target.value)}
            />
          </div>
          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
            {tocGroups.length === 0 && <p className="text-sm text-muted-foreground">Nic nenalezeno.</p>}
            {tocGroups.map((g) => (
              <section key={g.label}>
                <h3 className="mb-2 text-sm font-semibold">{g.label}</h3>
                <ul className="space-y-1.5">
                  {g.entries.map((e) => (
                    <li key={e.page.id}>
                      <button
                        type="button"
                        onClick={() => { setActiveIndex(e.index); setTocOpen(false); }}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          e.index === activeIndex && "border-primary bg-primary/5",
                        )}
                      >
                        <div className="w-12 shrink-0">
                          <NotebookPageThumb content={e.page.content} backgroundStyle={e.page.background_style} />
                        </div>
                        <span className="w-8 shrink-0 text-sm font-semibold text-muted-foreground">{e.number}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{e.displayTitle}</span>
                          {e.page.section && <span className="block truncate text-xs text-muted-foreground">{e.page.section}</span>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
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
