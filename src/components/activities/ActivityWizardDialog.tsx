import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

interface TbRow { id: string; title: string }
interface LessonRow { id: string; title: string; textbook_id: string; blocks: unknown; sort_order: number; status: string; hero_image_url: string | null; scheduled_publish_at: string | null; require_activities: boolean }

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
    supabase.from("teacher_textbooks").select("id, title").eq("teacher_id", user.id).is("deleted_at", null)
      .order("title").then(({ data }) => setTextbooks((data as TbRow[]) ?? []));
  }, [open, user]);

  useEffect(() => {
    if (!textbookId) { setLessons([]); return; }
    supabase.from("teacher_textbook_lessons")
      .select("id, title, textbook_id, blocks, sort_order, status, hero_image_url, scheduled_publish_at, require_activities")
      .eq("textbook_id", textbookId).order("sort_order")
      .then(({ data }) => setLessons((data as LessonRow[]) ?? []));
  }, [textbookId]);

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
    setBusy(true);
    const { data, error } = await supabase.from("teacher_textbook_lessons")
      .select("id, title, sort_order, status, blocks, hero_image_url, scheduled_publish_at, require_activities")
      .eq("id", targetLessonId).maybeSingle();
    setBusy(false);
    if (error || !data) { toast({ title: "Lekci se nepodařilo načíst", variant: "destructive" }); return; }
    const existing = Array.isArray((data as any).blocks) ? (data as any).blocks : [];
    // Nic se neukládá – blok je jen v konceptu editoru, dokud učitel lekci neuloží.
    setEditorLesson({ ...(data as any), blocks: [...existing, block], source: "teacher_textbook_lessons" });
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
    const questions = (block.props.quiz?.questions ?? []).map((q: any) => {
      const answers = (q.answers ?? []).map((a: any) => String(a?.text ?? "")).filter(Boolean);
      const correctIndex = Math.max(0, (q.answers ?? []).findIndex((a: any) => a?.correct));
      return { question: String(q.question ?? ""), answers, correctIndex, explanation: q.explanation };
    });
    const slides = buildGameSlidesFromQuiz(questions);
    if (!slides.length) { toast({ title: "Kvíz nemá žádné platné otázky", variant: "destructive" }); return; }
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
                  <Label>Učebnice</Label>
                  <Select value={textbookId} onValueChange={(v) => { setTextbookId(v); setPicked([]); }}>
                    <SelectTrigger><SelectValue placeholder={textbooks.length ? "Vyberte učebnici" : "Nemáte vlastní učebnici"} /></SelectTrigger>
                    <SelectContent>{textbooks.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}</SelectContent>
                  </Select>
                  {lessons.length > 0 && (
                    <fieldset className="space-y-1 max-h-56 overflow-y-auto border rounded-lg p-3">
                      <legend className="text-sm font-medium px-1">Lekce (lze vybrat více)</legend>
                      {lessons.map((l) => (
                        <label key={l.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox checked={picked.includes(l.id)}
                            onCheckedChange={(v) => setPicked((p) => (v ? [...p, l.id] : p.filter((x) => x !== l.id)))} />
                          {l.title}
                        </label>
                      ))}
                    </fieldset>
                  )}
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
                <Select value={textbookId} onValueChange={(v) => { setTextbookId(v); setTargetLessonId(""); }}>
                  <SelectTrigger aria-label="Učebnice"><SelectValue placeholder="Vyberte učebnici" /></SelectTrigger>
                  <SelectContent>{textbooks.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={targetLessonId} onValueChange={setTargetLessonId} disabled={!allLessonsForTarget.length}>
                  <SelectTrigger aria-label="Lekce"><SelectValue placeholder="Vyberte lekci" /></SelectTrigger>
                  <SelectContent>{allLessonsForTarget.map((l) => <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Otevře se editor lekce s aktivitou na konci. Nic se neuloží, dokud lekci neuložíte.</p>
                <Button onClick={openInLesson} disabled={!targetLessonId || busy}>Otevřít v editoru lekce</Button>
              </section>
              {info.template && (
                <section className="space-y-2">
                  <h3 className="font-semibold text-sm">Uložit do Moje aktivity</h3>
                  <Button variant="outline" onClick={saveTemplate} disabled={busy}>Uložit jako šablonu</Button>
                </section>
              )}
              {info.liveGame && (
                <section className="space-y-2">
                  <h3 className="font-semibold text-sm">Živá hra</h3>
                  <Button variant="outline" onClick={saveAsGame} disabled={busy}>Uložit do knihovny her a spustit</Button>
                </section>
              )}
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
