import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ownTextbooksOr } from "@/lib/demo-seed-textbooks";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import SearchablePickList from "@/components/activities/SearchablePickList";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Wand2 } from "lucide-react";
import ActivityBlock from "@/components/admin/block-editors/ActivityBlock";
import SummaryBlock from "@/components/admin/block-editors/SummaryBlock";
import LessonBlock from "@/components/LessonBlockRenderer";
import AiContentBadge from "@/components/ai/AiContentBadge";
import TeacherTextbookLessonEditorSheet from "@/components/teacher/TeacherTextbookLessonEditorSheet";
import { extractDocumentText } from "@/lib/curriculum-file-extract";
import { practiceErrorMessage } from "@/lib/practice-error";
import { buildGameSlidesFromQuiz, GAMES_HREF } from "@/lib/plan-suggested-activities";
import { activityPropsToTemplate } from "@/components/admin/block-editors/ActivityBlock";
import {
  buildAiRequest, buildBlock, clampItemCount, limitSourceText, resolveSource,
  activityToGameQuestions,
  MAX_ITEMS, MIN_ITEMS, WIZARD_TYPES,
  type CatalogId, type Difficulty, type SourceMode, type WizardSettings,
} from "@/lib/activity-wizard";
import type { Block } from "@/lib/textbook-config";

interface Props {
  catalogId: CatalogId | null;
  title: string;
  onOpenChange: (open: boolean) => void;
}

type Step = "source" | "settings" | "preview" | "use";
const STEPS: { id: Step; label: string }[] = [
  { id: "source", label: "1. Zdroj" },
  { id: "settings", label: "2. Nastavení" },
  { id: "preview", label: "3. Náhled" },
  { id: "use", label: "4. Použít" },
];

interface TbRow { id: string; title: string; subject?: string | null }
interface LessonRow { id: string; title: string; blocks: unknown; sort_order: number; status: string; hero_image_url: string | null; scheduled_publish_at: string | null; require_activities?: boolean; source: "textbook_lessons" | "teacher_textbook_lessons" }

export default function ActivityWizardDialog({ catalogId, title, onOpenChange }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const open = !!catalogId;
  const info = catalogId ? WIZARD_TYPES[catalogId] : null;

  const [step, setStep] = useState<Step>("source");
  const [mode, setMode] = useState<SourceMode>("lesson");
  const [textbooks, setTextbooks] = useState<TbRow[]>([]);
  const [textbookId, setTextbookId] = useState("");
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [pasted, setPasted] = useState("");
  const [uploading, setUploading] = useState(false);
  const [settings, setSettings] = useState<WizardSettings>({ itemCount: 8, difficulty: "medium", optionCount: 4, wordBank: true });
  const [generating, setGenerating] = useState(false);
  const [block, setBlock] = useState<Block | null>(null);
  const [busy, setBusy] = useState(false);
  const [targetLessonId, setTargetLessonId] = useState("");
  const [editorLesson, setEditorLesson] = useState<any>(null);

  useEffect(() => {
    if (!open) return;
    setStep("source"); setMode("lesson"); setPicked([]); setPasted(""); setBlock(null); setTargetLessonId("");
  }, [open, catalogId]);

  // Jen učebnice, které učitel vlastní (teacher_textbooks.teacher_id = já, RLS owns_textbook).
  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      const f = await ownTextbooksOr(user.id);
      const { data } = await supabase.from("teacher_textbooks").select("id, title, subject").or(f).is("deleted_at", null).order("title");
      setTextbooks((data as TbRow[]) ?? []);
    })();
  }, [open, user]);

  // Lekce učebnice se načítají stejně jako na stránce učebnice (TeacherTextbooks):
  // katalogové lekce témat předmětu + lekce umístěné přes lesson_placements + přímé lekce.
  useEffect(() => {
    if (!textbookId) { setLessons([]); return; }
    let cancelled = false;
    setLessonsLoading(true);
    (async () => {
      const tb = textbooks.find((t) => t.id === textbookId);
      const out: LessonRow[] = [];
      const seen = new Set<string>();
      const push = (l: any, source: LessonRow["source"]) => {
        if (!l || seen.has(l.id)) return;
        seen.add(l.id);
        out.push({ ...l, title: l.title || "Bez názvu", source });
      };
      const cols = "id, title, blocks, sort_order, status, hero_image_url, scheduled_publish_at";
      if (tb?.subject) {
        const { data: topics } = await supabase.from("textbook_topics").select("id, sort_order")
          .eq("subject", tb.subject).order("sort_order");
        const topicIds = (topics ?? []).map((t: any) => t.id);
        if (topicIds.length) {
          const { data } = await supabase.from("textbook_lessons")
            .select(`${cols}, require_activities, topic_id`).in("topic_id", topicIds).order("sort_order");
          const order = new Map(topicIds.map((id: string, i: number) => [id, i]));
          [...(data ?? [])].sort((a: any, b: any) =>
            (order.get(a.topic_id) ?? 0) - (order.get(b.topic_id) ?? 0) || (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .forEach((l) => push(l, "textbook_lessons"));
        }
        const { data: placed } = await supabase.from("lesson_placements")
          .select(`teacher_textbook_lessons(${cols})`).eq("subject_slug", tb.subject);
        (placed ?? []).forEach((p: any) => push(p.teacher_textbook_lessons, "teacher_textbook_lessons"));
      }
      const { data: direct } = await supabase.from("teacher_textbook_lessons")
        .select(cols).eq("textbook_id", textbookId).order("sort_order");
      (direct ?? []).forEach((l) => push(l, "teacher_textbook_lessons"));
      if (!cancelled) { setLessons(out); setLessonsLoading(false); }
    })().catch(() => { if (!cancelled) { setLessons([]); setLessonsLoading(false); } });
    return () => { cancelled = true; };
  }, [textbookId, textbooks]);

  const pickedLessons = useMemo(() => lessons.filter((l) => picked.includes(l.id)), [lessons, picked]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const text = await extractDocumentText(file);
      setPasted(limitSourceText(text));
      toast({ title: "Text načten", description: `${file.name}: ${Math.min(text.length, 6000)} znaků.` });
    } catch (err: any) {
      toast({ title: "Soubor se nepodařilo načíst", description: err?.message ?? String(err), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  function goSettings() {
    const r = resolveSource({ mode, lessons: pickedLessons, text: pasted });
    if (r.kind === "error") { toast({ title: "Doplňte zdroj", description: r.message, variant: "destructive" }); return; }
    setStep("settings");
  }

  async function generate() {
    if (!catalogId) return;
    const r = resolveSource({ mode, lessons: pickedLessons, text: pasted });
    if (r.kind === "error") { toast({ title: "Doplňte zdroj", description: r.message, variant: "destructive" }); return; }
    if (r.kind === "empty") { setBlock(buildBlock(catalogId, null, settings, title) as Block); setStep("preview"); return; }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-activity-content", {
        body: buildAiRequest(catalogId, title, r.text, settings),
      });
      if (error) throw new Error(await practiceErrorMessage(error));
      if (data?.error) throw new Error(data.error);
      setBlock(buildBlock(catalogId, data?.props ?? {}, settings, title) as Block);
      setStep("preview");
    } catch (err: any) {
      toast({ title: "AI aktivitu nevytvořila", description: err?.message ?? String(err), variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  const onBlockChange = (props: Record<string, any>) => setBlock((b) => (b ? { ...b, props } : b));

  async function openInLesson() {
    if (!block || !targetLessonId) return;
    const target = lessons.find((l) => l.id === targetLessonId);
    const source = target?.source ?? "teacher_textbook_lessons";
    setBusy(true);
    const { data, error } = await (supabase.from(source) as any)
      .select("id, title, sort_order, status, blocks, hero_image_url, scheduled_publish_at, require_activities")
      .eq("id", targetLessonId).maybeSingle();
    setBusy(false);
    if (error || !data) { toast({ title: "Lekci se nepodařilo načíst", variant: "destructive" }); return; }
    const existing = Array.isArray((data as any).blocks) ? (data as any).blocks : [];
    // Nic se neukládá – blok je jen v konceptu editoru, dokud učitel lekci neuloží.
    setEditorLesson({ ...(data as any), blocks: [...existing, block], source });
  }

  async function saveTemplate() {
    if (!block) return;
    setBusy(true);
    const { error } = await supabase.from("activity_templates").insert({
      name: (block.props.title || title).slice(0, 120),
      activity_type: block.props.activityType,
      template_props: activityPropsToTemplate(block.props),
    } as any);
    setBusy(false);
    toast(error
      ? { title: "Uložení se nezdařilo", description: error.message, variant: "destructive" }
      : { title: "Uloženo do Moje aktivity", description: "Najdete ji v editoru lekce pod „Načíst šablonu“." });
  }

  async function saveAsGame() {
    if (!block || !user) return;
    const slides = buildGameSlidesFromQuiz(activityToGameQuestions(block.props));
    if (!slides.length) { toast({ title: "Aktivita nemá žádné platné otázky", description: "Doplňte text a správné odpovědi.", variant: "destructive" }); return; }
    setBusy(true);
    const { error } = await supabase.from("teacher_game_templates" as any).insert({
      teacher_id: user.id, title: (block.props.title || title).slice(0, 120), activity_data: slides,
      default_game_mode: "standard", default_team_mode: "none",
    } as any);
    setBusy(false);
    if (error) { toast({ title: "Hru se nepodařilo uložit", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Hra uložena", description: "Spustíte ji v knihovně her." });
    onOpenChange(false);
    navigate(GAMES_HREF);
  }

  const allLessonsForTarget = lessons;

  return (
    <>
      <Dialog open={open && !editorLesson} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>Průvodce vytvořením aktivity</DialogDescription>
          </DialogHeader>
          <ol className="flex flex-wrap gap-2 text-xs" aria-label="Kroky průvodce">
            {STEPS.map((s) => (
              <li key={s.id} aria-current={s.id === step ? "step" : undefined}
                className={`px-3 py-1 rounded-full border ${s.id === step ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground"}`}>
                {s.label}
              </li>
            ))}
          </ol>

          {step === "source" && (
            <div className="space-y-4">
              <Tabs value={mode} onValueChange={(v) => setMode(v as SourceMode)}>
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="lesson">Z lekce</TabsTrigger>
                  <TabsTrigger value="text">Vložit text nebo dokument</TabsTrigger>
                  <TabsTrigger value="empty">Prázdná</TabsTrigger>
                </TabsList>
                <TabsContent value="lesson" className="space-y-3">
                  {textbooks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nemáte vlastní učebnici.</p>
                  ) : (
                    <SearchablePickList items={textbooks} mode="single" selected={textbookId ? [textbookId] : []}
                      onChange={(ids) => { setTextbookId(ids[0] ?? ""); setPicked([]); }}
                      label="Učebnice" searchPlaceholder="Hledat učebnici" searchFrom={1} />
                  )}
                  {textbookId && (lessonsLoading ? (
                    <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Načítám lekce…</p>
                  ) : lessons.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Tato učebnice zatím nemá žádné lekce.</p>
                  ) : (
                    <SearchablePickList items={lessons} mode="multi" selected={picked} onChange={setPicked}
                      label="Lekce (lze vybrat více)" searchPlaceholder="Hledat lekci" showCount />
                  ))}
                </TabsContent>
                <TabsContent value="text" className="space-y-3">
                  <Label htmlFor="wiz-text">Text podkladu</Label>
                  <Textarea id="wiz-text" rows={8} value={pasted} maxLength={6000}
                    onChange={(e) => setPasted(e.target.value)} placeholder="Vložte text, ze kterého má AI aktivitu vytvořit…" />
                  <p className="text-xs text-muted-foreground">{pasted.length} / 6000 znaků</p>
                  <label className="inline-flex items-center gap-2 text-sm border rounded-lg px-3 py-2 cursor-pointer hover:bg-muted">
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Nahrát PDF, Word nebo fotku
                    <input type="file" className="sr-only" accept=".pdf,.docx,.doc,.pptx,image/*" disabled={uploading} onChange={handleFile} />
                  </label>
                </TabsContent>
                <TabsContent value="empty">
                  <p className="text-sm text-muted-foreground">Aktivitu vyplníte sami v editoru, AI se nepoužije.</p>
                </TabsContent>
              </Tabs>
              <div className="flex justify-end">
                <Button onClick={goSettings}>Pokračovat</Button>
              </div>
            </div>
          )}

          {step === "settings" && info && (
            <div className="space-y-4">
              {mode !== "empty" && info.activityType !== "summary" && (
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="wiz-count">{info.activityType === "flashcards" ? "Počet kartiček" : "Počet položek"} ({MIN_ITEMS}–{MAX_ITEMS})</Label>
                    <Input id="wiz-count" type="number" min={MIN_ITEMS} max={MAX_ITEMS} value={settings.itemCount}
                      onChange={(e) => setSettings((s) => ({ ...s, itemCount: Number(e.target.value) }))}
                      onBlur={() => setSettings((s) => ({ ...s, itemCount: clampItemCount(s.itemCount) }))} />
                  </div>
                  <div>
                    <Label>Obtížnost</Label>
                    <Select value={settings.difficulty} onValueChange={(v) => setSettings((s) => ({ ...s, difficulty: v as Difficulty }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Snadná</SelectItem>
                        <SelectItem value="medium">Střední</SelectItem>
                        <SelectItem value="hard">Náročná</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {info.activityType === "quiz" && (
                    <div>
                      <Label>Počet možností u otázky</Label>
                      <Select value={String(settings.optionCount)} onValueChange={(v) => setSettings((s) => ({ ...s, optionCount: Number(v) }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{[2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}
              {info.activityType === "fill_blanks" && (
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={settings.wordBank} onCheckedChange={(v) => setSettings((s) => ({ ...s, wordBank: v }))} />
                  Zobrazit banku slov
                </label>
              )}
              {mode === "empty" && info.activityType !== "fill_blanks" && (
                <p className="text-sm text-muted-foreground">U prázdné aktivity se nic negeneruje – obsah doplníte v dalším kroku.</p>
              )}
              {mode !== "empty" && (
                <p className="text-xs text-muted-foreground">AI použije jen poskytnutý text a nic si nevymýšlí. Výsledek bude označen „AI generováno“.</p>
              )}
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep("source")}>Zpět</Button>
                <Button onClick={generate} disabled={generating}>
                  {generating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : mode !== "empty" && <Wand2 className="w-4 h-4 mr-1" />}
                  {mode === "empty" ? "Pokračovat" : "Vytvořit pomocí AI"}
                </Button>
              </div>
            </div>
          )}

          {step === "preview" && block && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">Takto ji uvidí žák</h3>
                <AiContentBadge aiGenerated={block.props.ai_generated === true} aiModifiedAt={block.props.ai_modified_at} />
              </div>
              <div className="rounded-xl border p-4 bg-card">
                <LessonBlock block={block} />
              </div>
              <h3 className="font-semibold text-sm">Úpravy</h3>
              {block.type === "summary"
                ? <SummaryBlock block={block} onChange={onBlockChange} />
                : <ActivityBlock block={block} onChange={onBlockChange} />}
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep("settings")}>Zpět</Button>
                <Button onClick={() => setStep("use")}>Pokračovat</Button>
              </div>
            </div>
          )}

          {step === "use" && block && info && (
            <div className="space-y-5">
              <section className="space-y-2">
                <h3 className="font-semibold text-sm">Vložit do lekce</h3>
                <SearchablePickList items={textbooks} mode="single" selected={textbookId ? [textbookId] : []}
                  onChange={(ids) => { setTextbookId(ids[0] ?? ""); setTargetLessonId(""); }}
                  label="Učebnice" searchPlaceholder="Hledat učebnici" searchFrom={1} />
                {textbookId && (lessonsLoading
                  ? <p className="text-sm text-muted-foreground">Načítám lekce…</p>
                  : <SearchablePickList items={allLessonsForTarget} mode="single" selected={targetLessonId ? [targetLessonId] : []}
                      onChange={(ids) => setTargetLessonId(ids[0] ?? "")} label="Lekce" searchPlaceholder="Hledat lekci" />)}
                <p className="text-xs text-muted-foreground">Otevře se editor lekce s aktivitou na konci. Nic se neuloží, dokud lekci neuložíte.</p>
                <Button onClick={openInLesson} disabled={!targetLessonId || busy}>Otevřít v editoru lekce</Button>
              </section>
              {info.template && (
                <section className="space-y-2">
                  <h3 className="font-semibold text-sm">Uložit do Moje aktivity</h3>
                  <Button variant="outline" onClick={saveTemplate} disabled={busy}>Uložit jako šablonu</Button>
                </section>
              )}
              <section className="space-y-2">
                <h3 className="font-semibold text-sm">Živá hra</h3>
                {info.liveGame
                  ? <Button variant="outline" onClick={saveAsGame} disabled={busy}>Uložit do knihovny her a spustit</Button>
                  : <p className="text-xs text-muted-foreground">Tuto aktivitu nelze hrát jako živou hru.</p>}
              </section>
              <div className="flex justify-start">
                <Button variant="outline" onClick={() => setStep("preview")}>Zpět</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <TeacherTextbookLessonEditorSheet
        lesson={editorLesson}
        open={!!editorLesson}
        onOpenChange={(o) => { if (!o) setEditorLesson(null); }}
        onSaved={() => { setEditorLesson(null); onOpenChange(false); toast({ title: "Lekce uložena s novou aktivitou" }); }}
      />
    </>
  );
}
