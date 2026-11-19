import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, ImagePlus, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import SourceInput from "@/components/sources/SourceInput";
import LessonFinder from "@/components/lessons/LessonFinder";
import LessonBlock from "@/components/LessonBlockRenderer";
import { ActivityContentEditor } from "@/components/admin/block-editors/ActivityBlock";
import { AddSlideSheet } from "@/components/game/AddSlideSheet";
import { useSourceBundle } from "@/lib/use-source-bundle";
import { useTeacherSubjects } from "@/hooks/useTeacherSubjects";
import { loadTeacherLessonOptions } from "@/lib/teacher-lesson-catalog";
import { extractTextFromBlocks } from "@/lib/lesson-content-splitter";
import { uploadWorksheetImage } from "@/lib/worksheet-images";
import { moveSource } from "@/lib/source-bundle";
import { GAME_MODES } from "@/lib/game-modes";
import { fetchGameTemplates, launchTemplateSession, type GameTemplate } from "@/lib/game-templates";
import {
  AI_STEP_TYPES, STEP_GROUPS, STEP_POINTS_LABEL, STEP_TIME_MAX, STEP_TIME_MIN, STEP_TYPES,
  activityTemplateToSteps, aiStepsToSteps, blockToSteps, canGoLive, gameTemplateToSet, newStep,
  prepareSlidesForLiveLaunch, slideToStep, stepBadges, stepProblem, stepToBlock, stepToSlide, stepTypeInfo,
  type ActivityStep, type StepPoints, type StepTypeId,
} from "@/lib/studio-step";

export type StudioStart = "blank" | "template" | "material" | "lesson";
type Phase = "zdroj" | "kroky" | "nahled" | "pouzit";
const PHASES: { id: Phase; label: string }[] = [
  { id: "zdroj", label: "Zdroj" }, { id: "kroky", label: "Kroky" }, { id: "nahled", label: "Náhled" }, { id: "pouzit", label: "Použít" },
];
const NONE = "__none__";
const AI_DEFAULT: StepTypeId[] = ["mcq", "true_false", "matching", "explain"];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  start: StudioStart;
  /** Úprava existující sady Studia (jen vlastní, ne demo). */
  editTemplate?: GameTemplate | null;
  onSaved: () => void;
}

/** Jeden sestavovač sady: Zdroj → Kroky → Náhled → Použít. Cesty se liší jen výchozím obsahem. */
export default function StudioSetBuilder({ open, onOpenChange, start, editTemplate, onSaved }: Props) {
  const navigate = useNavigate();
  const { subjects } = useTeacherSubjects();
  const bundle = useSourceBundle("teacher", (m) => toast.error(m));
  const [phase, setPhase] = useState<Phase>("zdroj");
  const [steps, setSteps] = useState<ActivityStep[]>([]);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState(NONE);
  const [mode, setMode] = useState("standard");
  const [teamMode, setTeamMode] = useState("none");
  const [teamCount, setTeamCount] = useState(2);
  const [editId, setEditId] = useState<string | null>(null);
  const [aiTypes, setAiTypes] = useState<StepTypeId[]>(AI_DEFAULT);
  const [aiCount, setAiCount] = useState(6);
  const [aiBusy, setAiBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [liveSheet, setLiveSheet] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setAiTypes(AI_DEFAULT); setAiCount(6); setOpenId(null);
    if (editTemplate) {
      setSteps((editTemplate.activity_data ?? []).map(slideToStep));
      setTitle(editTemplate.title); setSubject(editTemplate.subject || NONE);
      setMode(editTemplate.default_game_mode || "standard"); setTeamMode(editTemplate.default_team_mode || "none");
      setTeamCount(Math.max(2, Math.min(6, Number(editTemplate.default_team_count) || 2)));
      setEditId(editTemplate.demo_seed_key ? null : editTemplate.id);
      setPhase("kroky");
    } else {
      setSteps([]); setTitle(""); setSubject(NONE); setMode("standard"); setTeamMode("none"); setTeamCount(2); setEditId(null);
      setPhase(start === "blank" ? "kroky" : "zdroj");
    }
  }, [open, start, editTemplate]);

  const upd = (id: string, patch: Partial<ActivityStep>) =>
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch, ai: s.ai.generated && !("settings" in patch && Object.keys(patch).length === 1) ? { ...s.ai, modifiedAt: new Date().toISOString() } : s.ai } : s)));
  const addSteps = (more: ActivityStep[]) => {
    if (!more.length) return;
    setSteps((p) => [...p, ...more]);
    setOpenId(more[0].id);
  };

  const problems = useMemo(() => steps.map((s) => ({ s, p: stepProblem(s) })).filter((x) => x.p), [steps]);
  const launchPlan = useMemo(() => prepareSlidesForLiveLaunch(steps.map(stepToSlide)), [steps]);

  const generate = async () => {
    if (!bundle.state.ok) { toast.error(bundle.state.message ?? "Zdroje nejsou připravené."); return; }
    if (!aiTypes.length) { toast.error("Vyberte alespoň jeden typ kroku."); return; }
    setAiBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-activity-from-text", { body: { text: bundle.state.text, types: aiTypes.map((t) => (t === "wall" ? "open" : t)), count: aiCount } });
      let msg = (data as any)?.error as string | undefined;
      if (error) { try { msg = (await (error as any).context?.json?.())?.error ?? msg; } catch { /* */ } throw new Error(msg || "Sadu se nepodařilo vytvořit."); }
      if (msg) throw new Error(msg);
      const { steps: got, dropped } = aiStepsToSteps(data);
      if (!got.length) throw new Error("AI nevrátila použitelné kroky, zkuste to znovu.");
      addSteps(got);
      if (dropped > 0) toast.warning(`AI navrhla ${dropped} ${dropped === 1 ? "krok" : dropped < 5 ? "kroky" : "kroků"}, které nešly použít (chyběl obsah). Zahodili jsme je.`);
      else toast.success(`AI navrhla ${got.length} kroků. Zkontrolujte je.`);
      setPhase("kroky");
    } catch (e: any) {
      toast.error(e?.message || "Sadu se nepodařilo vytvořit.");
    } finally { setAiBusy(false); }
  };

  const save = async (launch: boolean) => {
    if (!title.trim()) { toast.error("Doplňte název sady."); setPhase("kroky"); return; }
    if (!steps.length) { toast.error("Přidejte alespoň jeden krok."); setPhase("kroky"); return; }
    if (problems.length) { toast.error(`Opravte kroky (${problems.length}).`); setPhase("kroky"); return; }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Nejste přihlášeni.");
      const row = {
        title: title.trim().slice(0, 120), activity_data: steps.map(stepToSlide),
        default_game_mode: mode, default_team_mode: teamMode, default_team_count: teamCount,
        subject: subject === NONE ? null : subject,
      };
      const q = editId
        ? supabase.from("teacher_game_templates" as any).update(row as any).eq("id", editId).eq("teacher_id", session.user.id).select().single()
        : supabase.from("teacher_game_templates" as any).insert({ ...row, teacher_id: session.user.id } as any).select().single();
      const { data, error } = await q;
      if (error) throw error;
      const saved = data as unknown as GameTemplate;
      setEditId(saved.id);
      onSaved();
      if (launch) {
        const id = await launchTemplateSession(saved);
        onOpenChange(false);
        navigate(`/live/ucitel/${id}`);
        return;
      }
      toast.success("Sada uložena do Studia.");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Sadu se nepodařilo uložit.");
    } finally { setSaving(false); }
  };

  const phaseIdx = PHASES.findIndex((p) => p.id === phase);

  return (
    <>
      <Dialog open={open && !liveSheet} onOpenChange={(o) => { if (!saving && !aiBusy) onOpenChange(o); }}>
        <DialogContent className="max-w-4xl w-[calc(100vw-1rem)] max-h-[94vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{editId ? "Upravit sadu" : "Nová sada"}</DialogTitle>
            <DialogDescription>Sestavte sadu z libovolných aktivit. Nic se neuloží, dokud nepotvrdíte.</DialogDescription>
          </DialogHeader>
          <ol className="flex gap-1 text-xs" aria-label="Postup">
            {PHASES.map((p, i) => (
              <li key={p.id} className="flex-1">
                <button type="button" disabled={(p.id === "zdroj" && (start === "blank" || !!editTemplate)) || saving}
                  onClick={() => setPhase(p.id)} aria-current={phase === p.id ? "step" : undefined}
                  className={cn("w-full rounded-md border px-1 py-2 min-h-10 font-medium", phase === p.id ? "border-primary bg-primary/10 text-primary" : i < phaseIdx ? "border-border text-foreground" : "border-border text-muted-foreground")}>
                  {i + 1}. {p.label}
                </button>
              </li>
            ))}
          </ol>

          {phase === "zdroj" && (
            <div className="space-y-4">
              {start === "template" ? (
                <TemplatePicker onPick={(set) => {
                  setTitle(set.title); setSubject(set.subject || NONE); setMode(set.gameMode); setTeamMode(set.teamMode); setTeamCount(set.teamCount);
                  setSteps(set.steps); setPhase("kroky");
                }} onPickSteps={(s, name) => { addSteps(s); if (!title) setTitle(name); setPhase("kroky"); }} />
              ) : (
                <>
                  {start === "lesson" && (
                    <LessonSourcePicker onPick={(lesson) => {
                      bundle.addLesson(lesson.title, () => [lesson.title, extractTextFromBlocks(lesson.blocks)].join("\n\n"));
                      const taken = (lesson.blocks ?? []).flatMap(blockToSteps);
                      if (taken.length) { addSteps(taken); toast.success(`Z lekce jsme převzali ${taken.length} hotových aktivit jako kroky.`); }
                      if (!title) setTitle(lesson.title);
                    }} />
                  )}
                  <SourceInput bundle={bundle} disabled={aiBusy} />
                  <fieldset className="space-y-2">
                    <legend className="text-sm font-medium">Typy kroků, ze kterých AI vybírá</legend>
                    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                      {STEP_TYPES.filter((t) => AI_STEP_TYPES.includes(t.id)).map((t) => (
                        <label key={t.id} className="flex min-h-10 items-center gap-2 text-sm">
                          <Checkbox checked={aiTypes.includes(t.id)} disabled={aiBusy}
                            onCheckedChange={(v) => setAiTypes((p) => (v ? [...p, t.id] : p.filter((x) => x !== t.id)))} />
                          <span>{t.label} <span className="text-xs text-muted-foreground">· {stepBadges(t.id).join(" · ")}</span></span>
                        </label>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground">Popis obrázku a hotspot potřebují obrázek, proto je AI nenavrhuje – přidáte je v kroku 2.</p>
                  </fieldset>
                  <div className="flex items-end gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="ai-count">Počet kroků (1–12)</Label>
                      <Input id="ai-count" type="number" min={1} max={12} inputMode="numeric" className="w-24" value={aiCount} disabled={aiBusy}
                        onChange={(e) => setAiCount(Math.min(12, Math.max(1, Number(e.target.value) || 1)))} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button className="flex-1 gap-2 min-h-11" onClick={generate} disabled={aiBusy || !bundle.state.ok || !aiTypes.length}>
                      {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Navrhnout kroky pomocí AI
                    </Button>
                    <Button variant="outline" className="min-h-11" onClick={() => setPhase("kroky")} disabled={aiBusy}>Pokračovat bez AI</Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Návrh je od AI – před uložením ho zkontrolujte. Zdroje se nikam neukládají.</p>
                </>
              )}
            </div>
          )}

          {phase === "kroky" && (
            <div className="space-y-4">
              <section className="space-y-3 rounded-lg border border-border p-3" aria-label="Nastavení sady">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="set-title">Název sady</Label>
                    <Input id="set-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Např. Opakování – zlomky" />
                  </div>
                  <div className="space-y-1">
                    <Label>Předmět</Label>
                    <Select value={subject} onValueChange={setSubject}>
                      <SelectTrigger aria-label="Předmět"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Bez předmětu</SelectItem>
                        {subjects.map((s) => <SelectItem key={s.label} value={s.label}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <fieldset className="space-y-1">
                  <legend className="text-sm font-medium">Herní režim (při živém spuštění)</legend>
                  <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
                    {GAME_MODES.map((m) => (
                      <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} onClick={() => setMode(m.id)}
                        className={cn("rounded-lg border p-2.5 text-left min-h-11", mode === m.id ? "border-primary bg-primary/10 ring-2 ring-primary/30" : "border-border hover:border-primary/50")}>
                        <div className="text-sm font-semibold">{m.emoji} {m.name}</div>
                        <div className="text-xs text-muted-foreground">{m.summary}</div>
                      </button>
                    ))}
                  </div>
                </fieldset>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Týmy</Label>
                    <Select value={teamMode} onValueChange={setTeamMode}>
                      <SelectTrigger aria-label="Týmy"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Jednotlivě (bez týmů)</SelectItem>
                        <SelectItem value="random">V týmech – náhodně</SelectItem>
                        <SelectItem value="manual">V týmech – ručně</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {teamMode !== "none" && (
                    <div className="space-y-1">
                      <Label>Počet týmů</Label>
                      <Select value={String(teamCount)} onValueChange={(v) => setTeamCount(Number(v))}>
                        <SelectTrigger aria-label="Počet týmů"><SelectValue /></SelectTrigger>
                        <SelectContent>{[2, 3, 4, 5, 6].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </section>

              {steps.length === 0 && <p className="text-sm text-muted-foreground">Sada je zatím prázdná. Přidejte první krok.</p>}
              <ol className="space-y-2" aria-label="Kroky sady">
                {steps.map((s, i) => (
                  <StepCard key={s.id} step={s} index={i} total={steps.length} open={openId === s.id} teamsOn={teamMode !== "none"}
                    onToggle={() => setOpenId(openId === s.id ? null : s.id)}
                    onChange={(patch) => upd(s.id, patch)}
                    onMove={(d) => setSteps(moveSource(steps, s.id, d))}
                    onDelete={() => setSteps(steps.filter((x) => x.id !== s.id))} />
                ))}
              </ol>
              <Button variant="outline" className="w-full gap-2 min-h-11" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" />Přidat krok</Button>
              {problems.length > 0 && <p className="text-xs text-destructive" aria-live="polite">Kroky k opravě: {problems.map((x) => `${steps.indexOf(x.s) + 1}. ${x.p}`).join(" · ")}</p>}
              <div className="flex justify-end"><Button className="min-h-11" onClick={() => setPhase("nahled")} disabled={!steps.length}>Dál: Náhled</Button></div>
            </div>
          )}

          {phase === "nahled" && (
            <div className="space-y-3">
              {steps.map((s, i) => {
                const block = stepToBlock(s);
                return (
                  <section key={s.id} className="rounded-lg border border-border p-3 space-y-2" aria-label={`Krok ${i + 1}`}>
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {i + 1}. {stepTypeInfo(s.type).label}
                      {!canGoLive(s.type) && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">Živě se vynechá</span>}
                    </div>
                    {block ? <LessonBlock block={block as any} isTeacher /> : <SimplePreview step={s} />}
                  </section>
                );
              })}
              <div className="flex justify-between gap-2">
                <Button variant="outline" className="min-h-11" onClick={() => setPhase("kroky")}>Zpět</Button>
                <Button className="min-h-11" onClick={() => setPhase("pouzit")}>Dál: Použít</Button>
              </div>
            </div>
          )}

          {phase === "pouzit" && (
            <div className="space-y-4">
              <p className="text-sm">Sada „{title || "bez názvu"}“ má {steps.length} kroků. Živě se zahraje {steps.length - launchPlan.skipped.length} z nich.</p>
              {launchPlan.skipped.length > 0 && (
                <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
                  <p className="font-medium">Při živém spuštění se vynechá (typ zatím jde jen samostatně nebo k tisku):</p>
                  <ul className="mt-1 list-disc pl-5">{launchPlan.skipped.map((x, i) => <li key={i}>{x.label}: {x.title}</li>)}</ul>
                </div>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button className="flex-1 min-h-11" onClick={() => save(false)} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Uložit do Studia</Button>
                <Button className="flex-1 min-h-11" variant="outline" onClick={() => save(true)} disabled={saving || launchPlan.slides.length === 0}>Uložit a spustit živě</Button>
              </div>
              <p className="text-[11px] text-muted-foreground">Vložení celé sady do lekce a tisk celé sady přijdou v další etapě. Živá hra používá stejný PIN a připojení bez účtu jako dosud.</p>
              <div><Button variant="outline" className="min-h-11" onClick={() => setPhase("nahled")}>Zpět</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AddStepDialog open={addOpen} onOpenChange={setAddOpen}
        onPick={(type) => { setAddOpen(false); if (stepTypeInfo(type).editor === "slide") { setLiveSheet(true); return; } addSteps([newStep(type)]); }} />
      <AddSlideSheet open={liveSheet} onOpenChange={setLiveSheet} slides={[]}
        onAddSlides={(added) => { addSteps(added.map(slideToStep)); setLiveSheet(false); }} />
    </>
  );
}

function AddStepDialog({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; onPick: (t: StepTypeId) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[calc(100vw-1rem)] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Přidat krok</DialogTitle>
          <DialogDescription>Vyberte typ. Štítky říkají, kde krok funguje.</DialogDescription>
        </DialogHeader>
        {STEP_GROUPS.map((g) => (
          <section key={g} className="space-y-2" aria-label={g}>
            <h3 className="text-sm font-semibold">{g}</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
              {STEP_TYPES.filter((t) => t.group === g).map((t) => (
                <button key={t.id} type="button" disabled={t.worksheetOnly} onClick={() => onPick(t.id)}
                  className={cn("rounded-lg border border-border p-3 text-left min-h-11", t.worksheetOnly ? "cursor-not-allowed opacity-60" : "hover:border-primary/50")}>
                  <div className="text-sm font-medium">{t.label}</div>
                  <div className="text-xs text-muted-foreground">{t.hint}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {stepBadges(t.id).map((b) => <span key={b} className={cn("rounded-full px-2 py-0.5 text-[11px]", b === "Živě" || b === "Jen živě" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{b}</span>)}
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
        <p className="text-[11px] text-muted-foreground">Týmy, diferencovaná aktivita, úniková hra a BezliStart se vybírají v nabídce živých snímků.</p>
      </DialogContent>
    </Dialog>
  );
}

function StepCard({ step: s, index: i, total, open, teamsOn, onToggle, onChange, onMove, onDelete }: {
  step: ActivityStep; index: number; total: number; open: boolean; teamsOn: boolean;
  onToggle: () => void; onChange: (p: Partial<ActivityStep>) => void; onMove: (d: number) => void; onDelete: () => void;
}) {
  const info = stepTypeInfo(s.type);
  const problem = stepProblem(s);
  const [uploading, setUploading] = useState(false);
  const live = canGoLive(s.type);
  const tl = s.settings.timeLimitSec;
  const timeMode = tl === null ? "default" : tl === 0 ? "none" : "custom";
  const setSettings = (p: Partial<ActivityStep["settings"]>) => onChange({ settings: { ...s.settings, ...p } });
  const pickImage = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try { const { data: { user } } = await supabase.auth.getUser(); onChange({ imageUrl: await uploadWorksheetImage(file, user?.id) }); }
    catch (e: any) { toast.error(e?.message || "Obrázek se nepodařilo nahrát."); }
    finally { setUploading(false); }
  };
  return (
    <li className={cn("rounded-lg border p-3", problem ? "border-destructive/60" : "border-border")}>
      <div className="flex items-center gap-1">
        <button type="button" className="flex flex-1 min-h-10 items-center gap-2 text-left text-sm font-medium" onClick={onToggle} aria-expanded={open}>
          {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
          <span className="min-w-0">
            <span className="block truncate">{i + 1}. {info.label}{s.title ? ` – ${s.title}` : ""}</span>
            <span className="block text-[11px] font-normal text-muted-foreground">{stepBadges(s.type).join(" · ")}{s.ai.generated ? " · AI generováno" : ""}</span>
          </span>
        </button>
        <Button size="icon" variant="ghost" className="h-10 w-10" disabled={i === 0} aria-label={`Posunout krok ${i + 1} nahoru`} onClick={() => onMove(-1)}><ArrowUp className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" className="h-10 w-10" disabled={i === total - 1} aria-label={`Posunout krok ${i + 1} dolů`} onClick={() => onMove(1)}><ArrowDown className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" className="h-10 w-10 text-destructive" aria-label={`Smazat krok ${i + 1}`} onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
      </div>
      {open && (
        <div className="mt-2 space-y-3">
          {info.editor !== "slide" && (
            <div className="space-y-1">
              <Label htmlFor={`t-${s.id}`} className="text-xs">{s.type === "explain" ? "Nadpis" : s.type === "mcq" || info.editor === "wall" || s.type === "wordcloud" ? "Otázka" : "Zadání"}</Label>
              <Textarea id={`t-${s.id}`} rows={2} value={s.title} onChange={(e) => onChange({ title: e.target.value })} />
            </div>
          )}
          {s.type === "explain" && (
            <Textarea rows={3} aria-label="Text výkladu" value={s.content.body ?? ""} onChange={(e) => onChange({ content: { ...s.content, body: e.target.value } })} />
          )}
          {s.type === "mcq" && (
            <fieldset className="space-y-1">
              <legend className="text-xs text-muted-foreground">Možnosti (vyberte správnou)</legend>
              {(s.content.options ?? []).map((o: string, oi: number) => (
                <div key={oi} className="flex items-center gap-2">
                  <input type="radio" name={`c-${s.id}`} className="h-5 w-5 accent-primary" checked={s.content.correctIndex === oi} onChange={() => onChange({ content: { ...s.content, correctIndex: oi } })} aria-label={`Správná je možnost ${oi + 1}`} />
                  <Input value={o} aria-label={`Možnost ${oi + 1}`} onChange={(e) => onChange({ content: { ...s.content, options: s.content.options.map((x: string, xi: number) => (xi === oi ? e.target.value : x)) } })} />
                </div>
              ))}
              {(s.content.options ?? []).length < 6 && <Button type="button" size="sm" variant="ghost" onClick={() => onChange({ content: { ...s.content, options: [...(s.content.options ?? []), ""] } })}>+ Možnost</Button>}
            </fieldset>
          )}
          {(info.editor === "wall" || s.type === "wordcloud") && (
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={s.content.anonymous === true} onCheckedChange={(v) => onChange({ content: { ...s.content, anonymous: !!v } })} />Anonymní odpovědi</label>
          )}
          {info.editor === "lesson" && <ActivityContentEditor activityType={info.activityType ?? s.type} props={s.content} onChange={(c) => onChange({ content: c })} />}
          {info.editor === "slide" && <p className="text-sm text-muted-foreground">Obsah tohoto živého snímku jste nastavili v nabídce živých snímků; tady upravíte čas, body a týmy.</p>}

          <fieldset className="space-y-2 rounded-md border border-border p-2" aria-label="Nastavení kroku">
            <legend className="px-1 text-xs font-medium">Nastavení kroku</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">Čas na krok</Label>
                <Select value={timeMode} disabled={s.type === "explain"} onValueChange={(v) => setSettings({ timeLimitSec: v === "default" ? null : v === "none" ? 0 : 30 })}>
                  <SelectTrigger aria-label="Čas na krok"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Výchozí čas hry</SelectItem>
                    <SelectItem value="none">Bez limitu</SelectItem>
                    <SelectItem value="custom">Vlastní čas</SelectItem>
                  </SelectContent>
                </Select>
                {s.type === "explain" && <p className="text-[11px] text-muted-foreground">Výklad nemá odpověď, čas se neměří.</p>}
                {timeMode === "custom" && s.type !== "explain" && (
                  <Input type="number" min={STEP_TIME_MIN} max={STEP_TIME_MAX} inputMode="numeric" aria-label="Sekund (5–600)" value={tl ?? ""}
                    onChange={(e) => setSettings({ timeLimitSec: Number(e.target.value) })} />
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Body</Label>
                <Select value={String(s.settings.points)} disabled={!info.scored} onValueChange={(v) => setSettings({ points: Number(v) as StepPoints })}>
                  <SelectTrigger aria-label="Body"><SelectValue /></SelectTrigger>
                  <SelectContent>{([1, 2, 0] as StepPoints[]).map((p) => <SelectItem key={p} value={String(p)}>{STEP_POINTS_LABEL[p]}</SelectItem>)}</SelectContent>
                </Select>
                {!info.scored && <p className="text-[11px] text-muted-foreground">Krok nemá správnou odpověď, neboduje se.</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Jednotlivě / v týmech</Label>
                <label className="flex min-h-10 items-center gap-2 text-sm">
                  <Checkbox checked={s.settings.individual} disabled={!live || !teamsOn} onCheckedChange={(v) => setSettings({ individual: !!v })} />Tento krok jednotlivě
                </label>
                <p className="text-[11px] text-muted-foreground">{!live ? "Typ zatím živě nejde – týmy se neuplatní." : !teamsOn ? "Sada se hraje bez týmů." : "Jinak platí týmy celé sady."}</p>
              </div>
            </div>
            {!live && <p className="text-[11px] text-muted-foreground">Čas a body se uplatní až v živé hře; tento typ se zatím hraje jen samostatně nebo tiskne.</p>}
            <Textarea rows={2} placeholder="Vysvětlení (zobrazí se po odpovědi)" aria-label="Vysvětlení" value={s.explanation} onChange={(e) => onChange({ explanation: e.target.value })} />
            <div className="flex flex-wrap items-center gap-2">
              {s.imageUrl ? (
                <>
                  <img src={s.imageUrl} alt="" className="h-14 w-20 rounded object-cover" />
                  <Button size="sm" variant="ghost" onClick={() => onChange({ imageUrl: "" })}><X className="mr-1 h-3 w-3" />Odebrat obrázek</Button>
                </>
              ) : (
                <label className="inline-flex min-h-10 cursor-pointer items-center gap-1 text-sm text-primary">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}Přidat obrázek
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void pickImage(f); }} />
                </label>
              )}
            </div>
          </fieldset>
          {problem && <p className="text-xs text-destructive">{problem}</p>}
        </div>
      )}
    </li>
  );
}

function SimplePreview({ step: s }: { step: ActivityStep }) {
  const c = s.content ?? {};
  return (
    <div className="rounded-md bg-muted/30 p-3 text-sm">
      <p className="font-medium">{s.title || stepTypeInfo(s.type).label}</p>
      {s.type === "explain" && <p className="mt-1 whitespace-pre-line text-muted-foreground">{c.body}</p>}
      {s.type === "poll" && <ul className="mt-1 list-disc pl-5">{(c.options ?? []).map((o: any, i: number) => <li key={i}>{o?.text ?? o}</li>)}</ul>}
      {s.type === "wordcloud" && <p className="mt-1 text-muted-foreground">Žáci pošlou slovo, vznikne mrak slov.</p>}
      {stepTypeInfo(s.type).editor === "slide" && <p className="mt-1 text-muted-foreground">Živý snímek – uvidíte ho na projektoru.</p>}
    </div>
  );
}

function TemplatePicker({ onPick, onPickSteps }: { onPick: (s: ReturnType<typeof gameTemplateToSet>) => void; onPickSteps: (s: ActivityStep[], name: string) => void }) {
  const [games, setGames] = useState<GameTemplate[] | null>(null);
  const [acts, setActs] = useState<{ id: string; name: string; activity_type: string; template_props: any }[] | null>(null);
  useEffect(() => {
    fetchGameTemplates().then(setGames).catch(() => setGames([]));
    supabase.from("activity_templates" as any).select("id,name,activity_type,template_props").order("name").limit(200)
      .then(({ data }) => setActs(((data as any[]) ?? [])));
  }, []);
  return (
    <div className="space-y-4">
      <section className="space-y-2" aria-label="Hry z knihovny">
        <h3 className="text-sm font-semibold">Hry a sady z vaší knihovny</h3>
        {games === null ? <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Načítání…</p>
          : games.length === 0 ? <p className="text-sm text-muted-foreground">Knihovna je prázdná.</p>
          : <ul className="grid gap-2 sm:grid-cols-2">{games.map((g) => (
            <li key={g.id}>
              <button type="button" className="w-full rounded-lg border border-border p-3 text-left min-h-11 hover:border-primary/50" onClick={() => onPick(gameTemplateToSet(g))}>
                <span className="block text-sm font-medium">{g.title}</span>
                <span className="block text-xs text-muted-foreground">{(g.activity_data ?? []).length} snímků{g.demo_seed_key ? " · ukázková" : ""} · vytvoří se kopie</span>
              </button>
            </li>))}</ul>}
      </section>
      <section className="space-y-2" aria-label="Šablony aktivit">
        <h3 className="text-sm font-semibold">Uložené šablony aktivit</h3>
        {acts === null ? <p className="text-sm text-muted-foreground">Načítání…</p>
          : acts.length === 0 ? <p className="text-sm text-muted-foreground">Zatím nemáte žádnou šablonu aktivity.</p>
          : <ul className="grid gap-2 sm:grid-cols-2">{acts.map((a) => {
            const steps = activityTemplateToSteps(a);
            return (
              <li key={a.id}>
                <button type="button" disabled={!steps.length} className="w-full rounded-lg border border-border p-3 text-left min-h-11 hover:border-primary/50 disabled:opacity-60"
                  onClick={() => onPickSteps(activityTemplateToSteps(a), a.name)}>
                  <span className="block text-sm font-medium">{a.name}</span>
                  <span className="block text-xs text-muted-foreground">{steps.length ? stepTypeInfo(steps[0].type).label : "Typ zatím nejde použít v sadě"}</span>
                </button>
              </li>);
          })}</ul>}
      </section>
    </div>
  );
}

function LessonSourcePicker({ onPick }: { onPick: (l: { id: string; title: string; blocks: any[] }) => void }) {
  const [lessons, setLessons] = useState<any[] | null>(null);
  const [picked, setPicked] = useState<string | undefined>();
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { setLessons([]); return; }
      try { setLessons(await loadTeacherLessonOptions(session.user.id)); } catch { setLessons([]); toast.error("Nepodařilo se načíst lekce."); }
    });
  }, []);
  if (lessons === null) return <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Načítání lekcí…</p>;
  if (!lessons.length) return <p className="text-sm text-muted-foreground">Zatím nemáte žádnou lekci s obsahem.</p>;
  return (
    <section className="space-y-2" aria-label="Výběr lekce">
      <h3 className="text-sm font-semibold">Vyberte lekci</h3>
      <LessonFinder selectedId={picked}
        items={lessons.map((l) => ({ id: l.id, title: l.title, textbookId: l.textbookId ?? null, textbookTitle: l.source ?? null, subject: l.subject ?? null, topic: l.topicTitle ?? null, updatedAt: l.updatedAt ?? null, sortOrder: l.sortOrder }))}
        onSelect={(item) => { const l = lessons.find((x) => x.id === item.id); if (l) { setPicked(l.id); onPick(l); } }} />
    </section>
  );
}
