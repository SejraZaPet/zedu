import { useEffect, useRef } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const optText = (o: any) => String(o?.text ?? o ?? "");

/**
 * Obsah kvízu s jednou otázkou (`mcq`) a ankety (`poll`) přímo nad `activitySpec`:
 * otázka, odpovědi, správná odpověď, obrázek, vysvětlení. Prázdná aktivita dostane
 * rovnou čtyři pole s nápovědou.
 */
export default function McqSpecEditor({ spec, onChange, autoFocus }: { spec: any; onChange: (patch: Record<string, unknown>) => void; autoFocus?: boolean }) {
  const isPoll = spec?.activityType === "poll";
  const raw: any[] = Array.isArray(spec?.options) ? spec.options : [];
  const options = raw.length ? raw : [{ text: "" }, { text: "" }, { text: "" }, { text: "" }];
  const correct = typeof spec?.correctIndex === "number" ? spec.correctIndex : Math.max(0, raw.findIndex((o) => o?.correct || o?.isCorrect));
  const qRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (autoFocus) qRef.current?.focus(); }, [autoFocus]);

  const write = (next: any[], ci = correct) => {
    const safe = Math.min(Math.max(0, ci), Math.max(0, next.length - 1));
    onChange({
      options: next.map((o, i) => (isPoll ? { text: optText(o) } : { text: optText(o), correct: i === safe, isCorrect: i === safe })),
      ...(isPoll ? {} : { correctIndex: safe }),
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="mcq-question" className="text-xs">Otázka</Label>
        <Textarea id="mcq-question" ref={qRef} rows={2} className="mt-1 text-sm" placeholder="Napište otázku, např. Jaké je hlavní město Česka?" value={String(spec?.question ?? "")} onChange={(e) => onChange({ question: e.target.value })} />
      </div>
      <fieldset className="space-y-1.5">
        <legend className="text-xs font-medium">{isPoll ? "Možnosti ankety" : "Odpovědi – zaškrtněte správnou"}</legend>
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-1.5">
            {!isPoll && (
              <input type="radio" name="mcq-correct" className="h-4 w-4 accent-primary" checked={i === correct} onChange={() => write(options, i)} aria-label={`Správná odpověď ${i + 1}`} />
            )}
            <Input className="h-8 text-sm" placeholder={`Odpověď ${i + 1}`} value={optText(o)} aria-label={`Odpověď ${i + 1}`}
              onChange={(e) => write(options.map((x, j) => (j === i ? { text: e.target.value } : x)))} />
            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label={`Odebrat odpověď ${i + 1}`} disabled={options.length <= 2}
              onClick={() => write(options.filter((_, j) => j !== i), i < correct ? correct - 1 : i === correct ? 0 : correct)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" disabled={options.length >= 6} onClick={() => write([...options, { text: "" }])}>
          <Plus className="h-3.5 w-3.5" /> Přidat odpověď
        </Button>
      </fieldset>
      <div>
        <Label htmlFor="mcq-image" className="text-xs">Obrázek (odkaz, nepovinné)</Label>
        <Input id="mcq-image" className="mt-1 h-8 text-xs" placeholder="https://…" value={String(spec?.imageUrl ?? "")} onChange={(e) => onChange({ imageUrl: e.target.value.trim() || undefined })} />
      </div>
      {!isPoll && (
        <div>
          <Label htmlFor="mcq-explanation" className="text-xs">Vysvětlení po odhalení (nepovinné)</Label>
          <Textarea id="mcq-explanation" rows={2} className="mt-1 text-xs" placeholder="Proč je odpověď správná…" value={String(spec?.explanation ?? "")} onChange={(e) => onChange({ explanation: e.target.value || undefined })} />
        </div>
      )}
    </div>
  );
}
