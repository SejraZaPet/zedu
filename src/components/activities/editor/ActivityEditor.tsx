import { useState, type ReactNode } from "react";
import { ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import TimeLimitPicker from "@/components/live/TimeLimitPicker";
import McqSpecEditor from "@/components/presentation/McqSpecEditor";
import ActivityColorsEditor from "@/components/presentation/ActivityColorsEditor";
import QuizQuestionsEditor from "@/components/activities/editor/QuizQuestionsEditor";
import { activityModelFromSpec, activityModelToSpec, type ActivityModel } from "@/lib/activity-model";
import { STEP_TIME_MAX, STEP_TIME_MIN, type StepPoints } from "@/lib/studio-step";
import { suggestedSoloRoundTimeSec } from "@/lib/solo-round";

export type ActivityEditorContext = "studio" | "lesson" | "presentation";
export type LegacyContentRenderer = (content: Record<string, any>, onChange: (content: Record<string, any>) => void) => ReactNode;

const LEGACY_TYPES = new Set([
  "true_false", "matching", "ordering", "fill_blanks", "fill_choice", "sorting",
  "flashcards", "reveal_cards", "memory_game", "crossword", "image_label", "image_hotspot",
]);

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="space-y-3 border-t border-border pt-3"><h3 className="font-deck-heading text-xs uppercase tracking-wide text-deck-violet-deep">{title}</h3>{children}</section>;
}

/** Jednotný editor nad ActivityModel; nic neukládá, pouze vrací nový model rodiči. */
export default function ActivityEditor({
  model, onChange, context, renderLegacyContent, autoFocus = false,
  scored = true, live = true, teamsOn = false, onUploadImage,
}: {
  model: ActivityModel;
  onChange: (next: ActivityModel) => void;
  context: ActivityEditorContext;
  renderLegacyContent?: LegacyContentRenderer;
  autoFocus?: boolean;
  scored?: boolean;
  live?: boolean;
  teamsOn?: boolean;
  onUploadImage?: (file: File) => Promise<string>;
}) {
  const [uploading, setUploading] = useState(false);
  const type = model.activityType;
  const patch = (next: Partial<ActivityModel>) => onChange({ ...model, ...next });
  const patchContent = (next: Record<string, any>) => patch({ content: { ...model.content, ...next } });
  const patchSettings = (next: Partial<ActivityModel["settings"]>) => patch({ settings: { ...model.settings, ...next } });
  const prompt = (value: string) => patch(context === "lesson" ? { question: value } : { title: value, question: value });
  const spec = activityModelToSpec(model, {});
  const changeMcq = (specPatch: Record<string, unknown>) => {
    const next = activityModelFromSpec({ ...spec, ...specPatch }, model.settings.participation);
    next.settings = { ...model.settings, ...next.settings, participation: model.settings.participation };
    onChange(next);
  };
  const upload = async (file?: File) => {
    if (!file || !onUploadImage) return;
    setUploading(true);
    try { patch({ imageUrl: await onUploadImage(file) }); }
    catch (error: any) { toast.error(error?.message || "Obrázek se nepodařilo nahrát."); }
    finally { setUploading(false); }
  };
  const showPrompt = context !== "lesson" && type !== "mcq" && type !== "poll" && type !== "quiz";
  const convertible = context === "studio" && ["matching", "ordering", "fill_blanks", "fill_choice"].includes(type);
  const solo = context === "studio" && model.settings.liveMode !== "expand" && model.settings.liveMode !== undefined;

  return (
    <div className="space-y-4" data-testid="unified-activity-editor">
      <Section title="Obsah">
        {showPrompt && (
          <div><Label className="text-xs">{type === "explain" ? "Nadpis" : ["wall", "wordcloud", "open"].includes(type) ? "Otázka" : "Zadání"}</Label><Textarea rows={2} value={model.question || model.title} onChange={(event) => prompt(event.target.value)} placeholder={type === "wordcloud" ? "Jaké slovo vás napadne?" : "Napište zadání pro žáky…"} /></div>
        )}
        {type === "quiz" && context !== "lesson" && <div><Label className="text-xs">Název kvízu</Label><Input value={model.title} onChange={(event) => patch({ title: event.target.value })} placeholder="Např. Opakování výživy" /></div>}
        {(type === "mcq" || type === "poll") && <McqSpecEditor spec={spec} onChange={changeMcq} autoFocus={autoFocus} />}
        {type === "poll" && <label className="flex items-center gap-2 text-sm"><Checkbox checked={model.content.allowMultiple === true} onCheckedChange={(value) => patchContent({ allowMultiple: !!value })} />Povolit více odpovědí</label>}
        {type === "quiz" && <QuizQuestionsEditor questions={model.questions} onChange={(questions) => patch({ questions })} />}
        {(type === "wall" || type === "wordcloud") && (
          <div className="space-y-2">
            {context === "lesson" && <div><Label className="text-xs">Otázka pro žáky</Label><Textarea rows={2} value={model.question} onChange={(event) => prompt(event.target.value)} /></div>}
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={model.content.anonymous === true} onCheckedChange={(value) => patchContent({ anonymous: !!value })} />Anonymní odpovědi</label>
            {type === "wall" && <label className="flex items-center gap-2 text-sm"><Checkbox checked={model.content.allowMultiple === true} onCheckedChange={(value) => patchContent({ allowMultiple: !!value })} />Povolit více odpovědí od jednoho žáka</label>}
          </div>
        )}
        {LEGACY_TYPES.has(type) && renderLegacyContent?.(model.content, (content) => patch({ content }))}
        {type === "explain" && <Textarea rows={4} aria-label="Text výkladu" value={model.content.body ?? ""} onChange={(event) => patchContent({ body: event.target.value })} />}
        {type === "short_answer" && <div><Label className="text-xs">Vzorová odpověď (nepovinná)</Label><Textarea rows={2} value={model.content.correctAnswer ?? ""} onChange={(event) => patchContent({ correctAnswer: event.target.value })} /></div>}
        {type === "word_search" && (
          <div className="grid gap-3 sm:grid-cols-[1fr_100px]"><div><Label className="text-xs">Slova (každé na nový řádek)</Label><Textarea rows={5} value={(model.content.wordSearchWords ?? []).join("\n")} onChange={(event) => patchContent({ wordSearchWords: event.target.value.split("\n").map((word) => word.trim().toUpperCase()).filter(Boolean) })} /></div><div><Label className="text-xs">Velikost mřížky</Label><Input type="number" min={8} max={20} value={model.content.wordSearchSize ?? 12} onChange={(event) => patchContent({ wordSearchSize: Math.max(8, Math.min(20, Number(event.target.value) || 12)) })} /></div></div>
        )}
        {type === "teams" && (
          <div className="grid gap-3 sm:grid-cols-2"><div><Label className="text-xs">Rozdělení týmů</Label><Select value={model.content.teamMode ?? "random"} onValueChange={(teamMode) => patchContent({ teamMode })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="random">Náhodně</SelectItem><SelectItem value="manual">Ručně</SelectItem></SelectContent></Select></div><div><Label className="text-xs">Počet týmů</Label><Input type="number" min={2} max={6} value={model.content.teamCount ?? 2} onChange={(event) => patchContent({ teamCount: Math.max(2, Math.min(6, Number(event.target.value) || 2)) })} /></div></div>
        )}
        {type === "differentiated" && <DifferentiatedContent content={model.content} onChange={patchContent} />}
        {type === "escape" && <EscapeContent content={model.content} onChange={patchContent} />}
        {type === "bezlistart" && <div><Label className="text-xs">Text úvodní aktivity</Label><Textarea rows={3} value={model.content.prompt ?? model.content.body ?? ""} onChange={(event) => patchContent({ prompt: event.target.value })} /></div>}
        {type === "summary" && <Textarea rows={4} aria-label="Text shrnutí" value={model.content.text ?? ""} onChange={(event) => patchContent({ text: event.target.value })} />}
      </Section>

      <Section title="Nastavení">
        {solo && <p className="rounded-md bg-primary/5 p-2 text-xs text-muted-foreground"><strong className="text-foreground">Samostatné kolo.</strong> Celá aktivita se odevzdá jako jedna odpověď; rychlost neboduje.</p>}
        {convertible && <div><Label className="text-xs">Způsob živé hry</Label><Select value={model.settings.liveMode === "expand" ? "expand" : "solo"} onValueChange={(liveMode) => patchSettings({ liveMode: liveMode as "solo" | "expand" })}><SelectTrigger aria-label="Způsob živé hry"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="solo">Hrát jako samostatné kolo</SelectItem><SelectItem value="expand">Rozložit na otázky</SelectItem></SelectContent></Select></div>}
        <div className="grid gap-3 sm:grid-cols-2">
          {type !== "explain" && <TimeLimitPicker value={model.settings.timeLimitSec ?? undefined} onChange={(next) => patchSettings({ timeLimitSec: next ?? null, timeAuto: false })} />}
          <div><Label className="text-xs">Body za správnou odpověď</Label><Select value={String(model.settings.points)} disabled={!scored} onValueChange={(value) => patchSettings({ points: Number(value) as StepPoints })}><SelectTrigger aria-label="Body"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="0">Bez bodů</SelectItem><SelectItem value="1">Běžné body</SelectItem><SelectItem value="2">Dvojnásobné body</SelectItem></SelectContent></Select>{!scored && <p className="mt-1 text-[11px] text-muted-foreground">Aktivita nemá správnou odpověď, neboduje se.</p>}</div>
        </div>
        {context === "presentation" && <div><Label className="text-xs">Jednotlivě / v týmech</Label><Select value={model.settings.participation} onValueChange={(participation) => patchSettings({ participation: participation as ActivityModel["settings"]["participation"] })}><SelectTrigger aria-label="Jednotlivě nebo v týmech"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="inherit">Podle nastavení prezentace</SelectItem><SelectItem value="individual">Tento slide jednotlivě</SelectItem><SelectItem value="random">Náhodné týmy</SelectItem><SelectItem value="manual">Ručně sestavené týmy</SelectItem></SelectContent></Select></div>}
        {context === "studio" && <div><Label className="text-xs">Jednotlivě / v týmech</Label><label className="flex min-h-10 items-center gap-2 text-sm"><Checkbox checked={model.settings.participation === "individual"} disabled={!live || !teamsOn} onCheckedChange={(value) => patchSettings({ participation: value ? "individual" : "inherit" })} />Tento krok jednotlivě</label><p className="text-[11px] text-muted-foreground">{!live ? "Typ zatím živě nejde – týmy se neuplatní." : !teamsOn ? "Sada se hraje bez týmů." : "Jinak platí týmy celé sady."}</p></div>}
        {context === "studio" && model.settings.liveMode === "solo" && <><label className="flex items-center gap-2 text-sm"><Checkbox checked={model.settings.showSolution !== false} onCheckedChange={(value) => patchSettings({ showSolution: !!value })} />Po skončení kola ukázat správné řešení</label><Button type="button" size="sm" variant="ghost" onClick={() => patchSettings({ timeLimitSec: suggestedSoloRoundTimeSec(spec), timeAuto: true })}>Přednastavit čas podle počtu položek</Button></>}
      </Section>

      {type !== "mcq" && type !== "poll" && type !== "quiz" && (
        <Section title="Obrázek a vysvětlení">
          <Label className="text-xs">Obrázek (odkaz, nepovinné)</Label>
          <Input aria-label="Obrázek aktivity" value={model.imageUrl} onChange={(event) => patch({ imageUrl: event.target.value })} placeholder="https://…" />
          {onUploadImage && <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm text-primary">{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}Nahrát obrázek<input type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void upload(file); }} /></label>}
          <Label className="text-xs">Vysvětlení po odpovědi (nepovinné)</Label><Textarea rows={2} value={model.explanation} onChange={(event) => patch({ explanation: event.target.value })} />
        </Section>
      )}
      {type === "quiz" && onUploadImage && <Section title="Obrázek kvízu"><Input aria-label="Obrázek aktivity" value={model.imageUrl} onChange={(event) => patch({ imageUrl: event.target.value })} placeholder="https://…" /><label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm text-primary"><ImagePlus className="h-4 w-4" />Nahrát obrázek<input type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void upload(file); }} /></label></Section>}

      <Section title="Vizuál a barvy"><ActivityColorsEditor value={model.colors} onChange={(colors) => patch({ colors })} /></Section>
    </div>
  );
}

function DifferentiatedContent({ content, onChange }: { content: Record<string, any>; onChange: (patch: Record<string, any>) => void }) {
  const tasks: any[] = Array.isArray(content.tasks) ? content.tasks : [];
  return <div className="space-y-3"><div><Label className="text-xs">Téma</Label><Input value={content.topic ?? ""} onChange={(event) => onChange({ topic: event.target.value })} /></div><Label className="text-xs">Úkoly pro skupiny</Label>{tasks.map((task, index) => <div key={index} className="space-y-2 rounded-lg border border-border p-3"><div className="flex gap-2"><Input aria-label={`Název úkolu ${index + 1}`} value={task.title ?? ""} placeholder="Název úkolu" onChange={(event) => onChange({ tasks: tasks.map((item, i) => i === index ? { ...item, title: event.target.value } : item) })} /><Button type="button" size="icon" variant="ghost" aria-label={`Odebrat úkol ${index + 1}`} onClick={() => onChange({ tasks: tasks.filter((_, i) => i !== index) })}><Trash2 className="h-4 w-4" /></Button></div><Textarea aria-label={`Obsah úkolu ${index + 1}`} rows={2} value={task.content ?? ""} onChange={(event) => onChange({ tasks: tasks.map((item, i) => i === index ? { ...item, content: event.target.value } : item) })} /></div>)}<Button type="button" size="sm" variant="outline" onClick={() => onChange({ tasks: [...tasks, { title: "", content: "" }] })}><Plus className="mr-1 h-4 w-4" />Přidat úkol</Button></div>;
}

function EscapeContent({ content, onChange }: { content: Record<string, any>; onChange: (patch: Record<string, any>) => void }) {
  const locks: any[] = Array.isArray(content.locks) ? content.locks : [];
  return <div className="space-y-3"><div><Label className="text-xs">Úvodní příběh</Label><Textarea rows={2} value={content.intro ?? ""} onChange={(event) => onChange({ intro: event.target.value })} /></div><Label className="text-xs">Zámky a kódy</Label>{locks.map((lock, index) => <div key={index} className="flex gap-2"><Input aria-label={`Hádanka ${index + 1}`} value={lock.clue ?? ""} placeholder="Hádanka" onChange={(event) => onChange({ locks: locks.map((item, i) => i === index ? { ...item, clue: event.target.value } : item) })} /><Input aria-label={`Kód ${index + 1}`} className="w-28" value={lock.code ?? ""} placeholder="Kód" onChange={(event) => onChange({ locks: locks.map((item, i) => i === index ? { ...item, code: event.target.value } : item) })} /><Button type="button" size="icon" variant="ghost" aria-label={`Odebrat zámek ${index + 1}`} onClick={() => onChange({ locks: locks.filter((_, i) => i !== index) })}><Trash2 className="h-4 w-4" /></Button></div>)}<Button type="button" size="sm" variant="outline" onClick={() => onChange({ locks: [...locks, { clue: "", code: "" }] })}><Plus className="mr-1 h-4 w-4" />Přidat zámek</Button><div><Label className="text-xs">Závěrečný vzkaz</Label><Textarea rows={2} value={content.finalMessage ?? ""} onChange={(event) => onChange({ finalMessage: event.target.value })} /></div></div>;
}
