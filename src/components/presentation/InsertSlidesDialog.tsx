import { useEffect, useMemo, useState } from "react";
import { BookOpen, Check, Loader2, Monitor, Search } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import SlidePreviewFrame from "@/components/presentation/SlidePreviewFrame";
import { supabase } from "@/integrations/supabase/client";
import { loadTeacherLessonOptions } from "@/lib/teacher-lesson-catalog";
import { blocksToSlides } from "@/lib/blocks-to-slides";
import { cloneSlidesForInsertion, type SlideInsertPosition } from "@/lib/presentation-slide-import";

interface SlideSource { id: string; title: string; kind: "lesson" | "presentation"; slides: any[] }

export default function InsertSlidesDialog({ open, onOpenChange, onInsert, currentPresentationId, themeId, fixedPlacement = false }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (slides: any[], position: SlideInsertPosition) => void;
  currentPresentationId?: string;
  themeId: string;
  fixedPlacement?: boolean;
}) {
  const [sources, setSources] = useState<SlideSource[] | null>(null);
  const [sourceId, setSourceId] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [position, setPosition] = useState<SlideInsertPosition>("after");

  useEffect(() => {
    if (!open || sources) return;
    let active = true;
    void (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Nejste přihlášeni.");
        const [lessons, presentations] = await Promise.all([
          loadTeacherLessonOptions(user.id),
          supabase.from("teacher_presentations" as any).select("id,title,slides,updated_at").eq("teacher_id", user.id).order("updated_at", { ascending: false }),
        ]);
        if (presentations.error) throw presentations.error;
        if (!active) return;
        const lessonSources: SlideSource[] = lessons.map((lesson: any) => ({ id: `lesson-${lesson.id}`, title: lesson.title || "Lekce bez názvu", kind: "lesson", slides: blocksToSlides(lesson.blocks || [], lesson.title || "Lekce") }));
        const presentationSources: SlideSource[] = ((presentations.data || []) as any[]).filter((item) => item.id !== currentPresentationId).map((item) => ({ id: `presentation-${item.id}`, title: item.title || "Prezentace bez názvu", kind: "presentation", slides: Array.isArray(item.slides) ? item.slides : [] }));
        const all = [...presentationSources, ...lessonSources].filter((source) => source.slides.length > 0);
        setSources(all);
        setSourceId(all[0]?.id ?? "");
      } catch (error: any) { toast.error(error?.message || "Slidy se nepodařilo načíst."); setSources([]); }
    })();
    return () => { active = false; };
  }, [open, sources, currentPresentationId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("cs");
    return (sources ?? []).filter((source) => !q || source.title.toLocaleLowerCase("cs").includes(q));
  }, [sources, query]);
  const source = sources?.find((item) => item.id === sourceId) ?? filtered[0];
  const slides = source?.slides ?? [];
  const idFor = (slide: any, index: number) => String(slide?.slideId ?? index);
  const selectedCount = selected.size;
  const toggleAll = () => setSelected(selectedCount === slides.length ? new Set() : new Set(slides.map(idFor)));
  const insert = () => {
    if (!source || !selectedCount) return;
    onInsert(cloneSlidesForInsertion(slides, selected), position);
    onOpenChange(false);
    setSelected(new Set());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90dvh] max-w-6xl flex-col gap-0 overflow-hidden border-deck-line bg-deck-cream p-0 font-deck-body">
        <DialogHeader className="border-b border-deck-line bg-deck-panel px-5 py-4 text-left"><DialogTitle className="font-deck-heading text-xl uppercase tracking-wide text-deck-violet">Vložit slidy z vlastního obsahu</DialogTitle><DialogDescription>Vyberte jeden nebo více slidů. Zkopírují se bloky, pozadí, aktivity, obrázky, odkazy i poznámky řečníka.</DialogDescription></DialogHeader>
        <div className="grid min-h-0 flex-1 md:grid-cols-[290px_minmax(0,1fr)]">
          <aside className="min-h-0 overflow-y-auto border-b border-deck-line bg-deck-panel p-4 md:border-b-0 md:border-r">
            <div className="relative mb-3"><Search className="absolute left-2.5 top-3 h-4 w-4 text-deck-muted" /><Input className="border-deck-line pl-8" aria-label="Hledat lekci nebo prezentaci" placeholder="Hledat…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
            {sources === null ? <p className="flex items-center gap-2 text-sm text-deck-muted"><Loader2 className="h-4 w-4 animate-spin" />Načítám vlastní obsah…</p> : filtered.length === 0 ? <p className="text-sm text-deck-muted">Žádná lekce ani prezentace se slidy neodpovídá výběru.</p> : <div className="space-y-1">{filtered.map((item) => <button key={item.id} type="button" onClick={() => { setSourceId(item.id); setSelected(new Set()); }} aria-pressed={source?.id === item.id} className={`flex min-h-11 w-full items-center gap-2 rounded-lg border p-2 text-left text-xs ${source?.id === item.id ? "border-deck-violet bg-deck-soft" : "border-transparent hover:bg-deck-cream"}`}>{item.kind === "lesson" ? <BookOpen className="h-4 w-4 shrink-0 text-deck-violet" /> : <Monitor className="h-4 w-4 shrink-0 text-deck-violet" />}<span className="min-w-0"><span className="block truncate font-semibold">{item.title}</span><span className="text-deck-muted">{item.kind === "lesson" ? "Lekce" : "Prezentace"} · {item.slides.length} slidů</span></span></button>)}</div>}
          </aside>
          <main className="min-h-0 overflow-y-auto p-4">
            {source ? <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-deck-heading text-lg uppercase text-deck-violet-deep">{source.title}</h3><p className="text-xs text-deck-muted">Vybráno {selectedCount} z {slides.length}</p></div><Button type="button" size="sm" variant="outline" onClick={toggleAll}>{selectedCount === slides.length ? "Zrušit výběr" : "Vybrat všechny"}</Button></div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{slides.map((slide, index) => { const id = idFor(slide, index); const checked = selected.has(id); const title = String(slide?.projector?.headline || slide?.activitySpec?.question || `Slide ${index + 1}`); return <label key={id} className={`cursor-pointer rounded-xl border-2 bg-deck-panel p-2 ${checked ? "border-deck-teal" : "border-deck-line"}`}><div className="relative"><SlidePreviewFrame slide={slide} themeId={slide.themeId || themeId} label={`Náhled: ${title}`} /><span className="absolute right-2 top-2 rounded-full bg-deck-panel p-1 shadow-sm">{checked && <Check className="h-4 w-4 text-deck-violet" />}</span></div><span className="mt-2 flex items-center gap-2 text-xs"><Checkbox checked={checked} onCheckedChange={() => setSelected((previous) => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; })} aria-label={`Vybrat slide ${index + 1}: ${title}`} /><span className="truncate">{index + 1}. {title}</span></span></label>; })}</div>
            </> : <p className="text-sm text-deck-muted">Nejprve vyberte lekci nebo prezentaci.</p>}
          </main>
        </div>
        <footer className="flex flex-col gap-3 border-t border-deck-line bg-deck-panel p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-wrap items-center gap-3">{fixedPlacement ? <Label>Na zvolené místo mezi slidy</Label> : <><Label>Kam vložit:</Label>{([["before", "Před aktuální"], ["after", "Za aktuální"], ["end", "Na konec"]] as const).map(([value, label]) => <label key={value} className="flex min-h-11 items-center gap-2 text-xs"><input type="radio" name="slide-position" checked={position === value} onChange={() => setPosition(value)} className="accent-deck-violet" />{label}</label>)}</>}</div><Button className="min-h-11 bg-deck-violet text-deck-on-violet hover:bg-deck-violet-deep" disabled={!selectedCount} onClick={insert}>Vložit {selectedCount || ""} {selectedCount === 1 ? "slide" : "slidy"}</Button></footer>
      </DialogContent>
    </Dialog>
  );
}
