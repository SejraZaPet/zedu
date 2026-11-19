import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import SourceInput from "@/components/sources/SourceInput";
import { useSourceBundle } from "@/lib/use-source-bundle";
import { moveSource } from "@/lib/source-bundle";
import {
  DRAFT_STEP_LABEL, STEP_POINTS_LABEL, draftStepsToSlides, stepProblem, stepsFromAi,
  type DraftStep, type DraftStepType, type StepPoints,
} from "@/lib/fromtext-slides";
import { uploadWorksheetImage } from "@/lib/worksheet-images";

const ALL_TYPES: DraftStepType[] = ["mcq", "true_false", "open", "explain"];

/**
 * „Aktivita z vlastního materiálu“: zdroje → AI návrh sady smíšených kroků →
 * učitel zaškrtne a upraví (čas, body, obrázek, vysvětlení, obsah) → teprve potom vložení.
 */
export default function FromSourceActivityPanel({
  busy, onInsert, lessonPicker,
}: {
  busy?: boolean;
  onInsert: (slides: any[]) => void | Promise<void>;
  lessonPicker?: (bundle: ReturnType<typeof useSourceBundle>, close: () => void) => ReactNode;
}) {
  const bundle = useSourceBundle("teacher", (m) => toast.error(m));
  const [types, setTypes] = useState<DraftStepType[]>(["mcq", "true_false"]);
  const [count, setCount] = useState(6);
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState<DraftStep[] | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const disabled = busy || loading;

  const generate = async () => {
    if (!bundle.state.ok) { toast.error(bundle.state.message ?? "Zdroje nejsou připravené."); return; }
    if (types.length === 0) { toast.error("Vyberte alespoň jeden typ kroku."); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-activity-from-text", {
        body: { text: bundle.state.text, types, count },
      });
      let msg = (data as any)?.error as string | undefined;
      if (error) { try { msg = (await (error as any).context?.json?.())?.error ?? msg; } catch { /* */ } throw new Error(msg || "Sadu se nepodařilo vytvořit."); }
      if (msg) throw new Error(msg);
      const draft = stepsFromAi(data);
      if (draft.length === 0) throw new Error("AI nevrátila použitelné kroky, zkuste to znovu.");
      setSteps(draft);
    } catch (e: any) {
      toast.error(e?.message || "Sadu se nepodařilo vytvořit.");
    } finally {
      setLoading(false);
    }
  };

  const upd = (id: string, p: Partial<DraftStep>) =>
    setSteps((prev) => prev && prev.map((s) => (s.id === id ? { ...s, ...p, edited: s.edited || !("include" in p && Object.keys(p).length === 1) } : s)));

  const pickImage = async (id: string, file?: File) => {
    if (!file) return;
    setUploading(id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      upd(id, { imageUrl: await uploadWorksheetImage(file, user?.id) });
    } catch (e: any) { toast.error(e?.message || "Obrázek se nepodařilo nahrát."); }
    finally { setUploading(null); }
  };

  if (steps) {
    const chosen = steps.filter((s) => s.include);
    const bad = chosen.filter((s) => stepProblem(s));
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">AI navrhla {steps.length} kroků. Zaškrtněte, které chcete vložit, a upravte je. Do hry se nic nevloží, dokud nepotvrdíte.</p>
        <ol className="space-y-3" aria-label="Návrh sady">
          {steps.map((s, i) => {
            const problem = s.include ? stepProblem(s) : null;
            const scored = s.type === "mcq" || s.type === "true_false";
            return (
              <li key={s.id} className="space-y-2 rounded-md border border-border p-3">
                <div className="flex items-center gap-2">
                  <Checkbox id={`inc-${s.id}`} checked={s.include} onCheckedChange={(v) => upd(s.id, { include: !!v })} aria-label={`Vložit krok ${i + 1}`} />
                  <Label htmlFor={`inc-${s.id}`} className="flex-1 text-sm font-medium">{i + 1}. {DRAFT_STEP_LABEL[s.type]} <span className="text-xs font-normal text-muted-foreground">· AI generováno</span></Label>
                  <Button size="icon" variant="ghost" className="h-8 w-8" disabled={i === 0} aria-label={`Posunout krok ${i + 1} nahoru`} onClick={() => setSteps(moveSource(steps, s.id, -1))}><ArrowUp className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" disabled={i === steps.length - 1} aria-label={`Posunout krok ${i + 1} dolů`} onClick={() => setSteps(moveSource(steps, s.id, 1))}><ArrowDown className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Smazat krok ${i + 1}`} onClick={() => setSteps(steps.filter((x) => x.id !== s.id))}><Trash2 className="h-4 w-4" /></Button>
                </div>
                {s.include && (
                  <div className="space-y-2">
                    <Textarea rows={2} value={s.question} aria-label={s.type === "explain" ? "Nadpis" : "Otázka"} onChange={(e) => upd(s.id, { question: e.target.value })} />
                    {s.type === "explain" && <Textarea rows={3} value={s.body} aria-label="Text výkladu" onChange={(e) => upd(s.id, { body: e.target.value })} />}
                    {s.type === "mcq" && (
                      <fieldset className="space-y-1">
                        <legend className="text-xs text-muted-foreground">Možnosti (vyberte správnou)</legend>
                        {s.options.map((o, oi) => (
                          <div key={oi} className="flex items-center gap-2">
                            <input type="radio" name={`c-${s.id}`} checked={s.correctIndex === oi} onChange={() => upd(s.id, { correctIndex: oi })} aria-label={`Správná je možnost ${oi + 1}`} className="accent-primary" />
                            <Input value={o} aria-label={`Možnost ${oi + 1}`} onChange={(e) => upd(s.id, { options: s.options.map((x, xi) => (xi === oi ? e.target.value : x)) })} />
                          </div>
                        ))}
                        {s.options.length < 6 && <Button type="button" size="sm" variant="ghost" onClick={() => upd(s.id, { options: [...s.options, ""] })}>+ Možnost</Button>}
                      </fieldset>
                    )}
                    {s.type === "true_false" && (
                      <div className="flex gap-3 text-sm" role="radiogroup" aria-label="Tvrzení je">
                        {["Pravda", "Nepravda"].map((l, li) => (
                          <label key={l} className="flex items-center gap-1"><input type="radio" className="accent-primary" checked={s.correctIndex === li} onChange={() => upd(s.id, { correctIndex: li })} />{l}</label>
                        ))}
                      </div>
                    )}
                    {scored && <Textarea rows={2} value={s.explanation} placeholder="Vysvětlení správné odpovědi" aria-label="Vysvětlení" onChange={(e) => upd(s.id, { explanation: e.target.value })} />}
                    <div className="grid grid-cols-2 gap-2">
                      {s.type !== "explain" && (
                        <div className="space-y-1">
                          <Label htmlFor={`t-${s.id}`} className="text-xs">Čas (s, 0 = bez limitu)</Label>
                          <Input id={`t-${s.id}`} type="number" min={0} max={600} inputMode="numeric" value={s.timeLimitSec} onChange={(e) => upd(s.id, { timeLimitSec: Number(e.target.value) })} />
                        </div>
                      )}
                      {scored && (
                        <div className="space-y-1">
                          <Label htmlFor={`p-${s.id}`} className="text-xs">Body</Label>
                          <select id={`p-${s.id}`} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm" value={s.points} onChange={(e) => upd(s.id, { points: Number(e.target.value) as StepPoints })}>
                            {([1, 2, 0] as StepPoints[]).map((p) => <option key={p} value={p}>{STEP_POINTS_LABEL[p]}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {s.imageUrl ? (
                        <>
                          <img src={s.imageUrl} alt="" className="h-14 w-20 rounded object-cover" />
                          <Button size="sm" variant="ghost" onClick={() => upd(s.id, { imageUrl: "" })}><X className="mr-1 h-3 w-3" />Odebrat obrázek</Button>
                        </>
                      ) : (
                        <label className="inline-flex cursor-pointer items-center gap-1 text-sm text-primary">
                          {uploading === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}Přidat obrázek
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void pickImage(s.id, f); }} />
                        </label>
                      )}
                    </div>
                    {problem && <p className="text-xs text-destructive">{problem}</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => setSteps(null)} disabled={busy}>Zpět ke zdrojům</Button>
          <Button className="flex-1" disabled={busy || chosen.length === 0 || bad.length > 0} onClick={() => onInsert(draftStepsToSlides(steps))}>
            Vložit {chosen.length} {chosen.length === 1 ? "krok" : chosen.length < 5 ? "kroky" : "kroků"}
          </Button>
        </div>
        {bad.length > 0 && <p className="text-xs text-destructive" aria-live="polite">Opravte zvýrazněné kroky ({bad.length}) nebo je odškrtněte.</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SourceInput bundle={bundle} disabled={disabled} lessonPicker={lessonPicker ? (close) => lessonPicker(bundle, close) : undefined} />
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Typy kroků v sadě</legend>
        <div className="grid grid-cols-2 gap-2">
          {ALL_TYPES.map((t) => (
            <label key={t} className="flex items-center gap-2 text-sm">
              <Checkbox checked={types.includes(t)} disabled={disabled}
                onCheckedChange={(v) => setTypes((p) => (v ? [...p, t] : p.filter((x) => x !== t)))} />{DRAFT_STEP_LABEL[t]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1">
        <Label htmlFor="set-count">Počet kroků (1–12)</Label>
        <Input id="set-count" type="number" min={1} max={12} inputMode="numeric" value={count} disabled={disabled}
          onChange={(e) => setCount(Math.min(12, Math.max(1, Number(e.target.value) || 1)))} className="w-24" />
      </div>
      <Button onClick={generate} disabled={disabled || !bundle.state.ok || types.length === 0} className="w-full gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Navrhnout sadu pomocí AI
      </Button>
      <p className="text-[11px] text-muted-foreground">Sadu navrhuje AI – před vložením ji zkontrolujte. Zdroje se nikam neukládají.</p>
    </div>
  );
}
