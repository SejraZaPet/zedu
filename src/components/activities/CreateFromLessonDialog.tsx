import { useEffect, useMemo, useRef, useState } from "react";
import LessonFinder from "@/components/lessons/LessonFinder";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchableSelect } from "@/components/ui/searchable-select";
import ActivityBlock from "@/components/admin/block-editors/ActivityBlock";
import { Loader2, Sparkles } from "lucide-react";
import { practiceErrorMessage } from "@/lib/practice-error";
import { Link } from "react-router-dom";
import { loadTeacherSourceLessons, isAllowedSourceLesson, toFinderItem, type TeacherSourceLesson } from "@/lib/teacher-source-lessons";
import { lessonAiParts, sourceText, aiTypeLimits, lessonAiRequest, makeLessonSource, lessonAiDraft, type LessonAiType } from "@/lib/lesson-ai-source";
import type { Block } from "@/lib/textbook-config";

const TYPES: { value: LessonAiType; label: string }[] = [
  { value: "mcq", label: "Kvíz ABCD" }, { value: "true_false", label: "Pravda / nepravda" },
  { value: "matching", label: "Dvojice" }, { value: "fill_blanks", label: "Doplňování" }, { value: "flashcards", label: "Kartičky" },
];
export default function CreateFromLessonDialog({ open, onOpenChange, onInsert, allowedTypes, initialType = "mcq", onUseText }: {
  open: boolean; onOpenChange: (open: boolean) => void; onInsert: (block: Block) => void;
  allowedTypes?: LessonAiType[]; initialType?: LessonAiType;
  /** Alternativa bez lekce: přepne volajícího na vložení textu nebo dokumentu. */
  onUseText?: () => void;
}) {
  const { user } = useAuth();
  const [lessons, setLessons] = useState<TeacherSourceLesson[]>([]);
  const [lessonId, setLessonId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [type, setType] = useState<LessonAiType>(initialType);
  const [count, setCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<Block | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    if (!open || !user) return;
    let cancelled = false;
    setLessons([]); setLessonId(""); setSelected([]); setDraft(null); setReviewed(false); setError(""); setType(initialType); setBusy(false); setLoading(true);
    loadTeacherSourceLessons(user.id, { withBlocks: true }).then(rows => { if (!cancelled) setLessons(rows); })
      .catch(() => { if (!cancelled) setError("Lekce se nepodařilo načíst. Zavřete okno a zkuste to znovu."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; generation.current++; };
  }, [open, user?.id, initialType]);
  const lesson = lessons.find(l => l.id === lessonId);
  const finderItems = useMemo(() => lessons.map(toFinderItem), [lessons]);
  const aiLesson = lesson ? { id: lesson.id, title: lesson.title, blocks: lesson.blocks, textbook_id: lesson.textbookId, source: lesson.source } : null;
  const parts = aiLesson ? lessonAiParts(aiLesson) : [];
  const limits = aiTypeLimits(type);
  const text = sourceText(parts, selected, limits.text);
  const generate = async () => {
    if (!lesson || !user) return;
    const run = ++generation.current;
    setBusy(true); setError(""); setReviewed(false);
    try {
      // Před odesláním textu znovu ověřit, že lekce je stále povoleným zdrojem (vlastní, kopie, učebnice, demo).
      if (!aiLesson || !(await isAllowedSourceLesson(user.id, lesson))) throw new Error("Tato lekce již není dostupná jako zdroj.");
      const request = lessonAiRequest(type, text, lesson.title, count);
      const source = await makeLessonSource(aiLesson, selected, text);
      const result = await supabase.functions.invoke(request.name, { body: request.body });
      if (result.error) throw new Error(await practiceErrorMessage(result.error));
      if (result.data?.error) throw new Error(result.data.error);
      const block = lessonAiDraft(type, result.data, lesson.title, source);
      if (generation.current === run) setDraft(block);
    } catch (e) { if (generation.current === run) setError(e instanceof Error ? e.message : "Návrh se nepodařil. Zkuste to znovu nebo vytvořte aktivitu ručně."); }
    finally { if (generation.current === run) setBusy(false); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-3xl max-h-[92dvh] overflow-y-auto overflow-x-hidden [&_button]:min-h-11 [&_input]:min-h-11 [&_[role=checkbox]]:min-h-11 [&_[role=checkbox]]:min-w-11">
      <DialogHeader><DialogTitle>Vytvořit z lekce</DialogTitle><DialogDescription>{draft ? "Návrh ke kontrole" : "Lekce z vašich učebnic"}</DialogDescription></DialogHeader>
      {error && <p role="alert" className="text-sm text-destructive break-words">{error}</p>}
      {!draft ? <div className="space-y-4 min-w-0">
        {loading ? <p role="status">Načítám lekce…</p> : !lessons.length && !error && <div className="space-y-2 rounded-md border border-border p-3">
          <p>Ve vašich učebnicích zatím není žádná lekce. Nejdřív vytvořte lekci v Učebnici.</p>
          <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link to="/ucitel/ucebnice">Otevřít Učebnice</Link></Button>
            {onUseText && <Button variant="outline" onClick={() => { onOpenChange(false); onUseText(); }}>Vložit text nebo dokument</Button>}</div>
        </div>}
        {lessons.length > 0 && <LessonFinder items={finderItems} selectedId={lessonId} disabled={loading || busy} onSelect={l => { setLessonId(l.id); setSelected([]); }} />}
        {parts.length > 0 && <fieldset disabled={busy} className="space-y-2"><legend className="text-sm font-medium">Části lekce</legend>
          {parts.map(p => <Label key={p.id} className="flex min-h-11 gap-3 items-center cursor-pointer"><Checkbox checked={selected.includes(p.id)} onCheckedChange={yes => setSelected(ids => yes ? [...ids, p.id] : ids.filter(id => id !== p.id))} /><span className="min-w-0 break-words">{p.title}</span></Label>)}
          <details className="text-sm"><summary className="cursor-pointer min-h-11">Zdrojový text ({text.length} / {limits.text} znaků)</summary><p className="whitespace-pre-wrap break-words max-h-48 overflow-y-auto">{text}</p></details>
        </fieldset>}
        <SearchableSelect label="Typ aktivity" value={type} disabled={busy} options={TYPES.filter(t => !allowedTypes || allowedTypes.includes(t.value))} onValueChange={v => setType(v as LessonAiType)} />
        <div className="space-y-2"><Label htmlFor="lesson-ai-count">Počet ({limits.min}–{limits.max})</Label><Input id="lesson-ai-count" type="number" min={limits.min} max={limits.max} disabled={busy} value={count} onChange={e => setCount(Number(e.target.value))} onBlur={() => setCount(n => Math.max(limits.min, Math.min(limits.max, n || limits.min)))} /></div>
        {type === "fill_blanks" && <p className="text-sm text-muted-foreground">Počet míst k doplnění volí současný generátor podle textu.</p>}
        <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Zpět k ruční tvorbě</Button><Button disabled={busy || !lesson || !selected.length} onClick={generate}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Navrhnout</Button></div>
      </div> : <div className="space-y-4 min-w-0">
        <p className="text-sm text-primary">Vytvořeno s pomocí AI</p>
        <ActivityBlock block={draft} onChange={props => { setDraft(b => b ? { ...b, props: { ...props, source: b.props.source, ai_generated: true } } : b); setReviewed(false); }} />
        <Label className="flex gap-3 items-center min-h-11"><Checkbox checked={reviewed} onCheckedChange={v => setReviewed(v === true)} />Zkontroloval/a jsem obsah a správné odpovědi</Label>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => { setDraft(null); setReviewed(false); }}>Zpět k zadání</Button><Button disabled={!reviewed} onClick={() => { onInsert(draft); onOpenChange(false); }}>Vložit</Button></div>
      </div>}
    </DialogContent>
  </Dialog>;
}