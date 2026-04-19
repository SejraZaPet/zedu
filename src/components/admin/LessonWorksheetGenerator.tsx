import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Trash2, Plus, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export interface GeneratedQuestion {
  type: "mcq" | "true_false" | "short_answer";
  question: string;
  options?: string[];
  correctIndex?: number;
  correctAnswer?: string;
}

interface Props {
  lessonId: string;
  lessonTitle: string;
  blocks: any[];
  onGenerated: (questions: GeneratedQuestion[]) => void;
}

const QUESTION_COUNTS = [3, 5, 10] as const;
const TYPE_LABELS: Record<GeneratedQuestion["type"], string> = {
  mcq: "MCQ",
  true_false: "Pravda/Nepravda",
  short_answer: "Krátká odpověď",
};

function extractText(blocks: any[]): string {
  if (!Array.isArray(blocks)) return "";
  const parts: string[] = [];
  const stripHtml = (s: string) =>
    String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  for (const b of blocks) {
    if (!b || typeof b !== "object") continue;
    const p = b.props ?? {};
    switch (b.type) {
      case "heading":
        if (p.text) parts.push(`# ${stripHtml(p.text)}`);
        break;
      case "paragraph":
        if (p.text) parts.push(stripHtml(p.text));
        break;
      case "bullet_list": {
        const items: string[] = Array.isArray(p.items) ? p.items : [];
        for (const it of items) parts.push(`- ${stripHtml(it)}`);
        break;
      }
      case "callout":
      case "quote":
      case "summary":
        if (p.text) parts.push(stripHtml(p.text));
        break;
      default:
        break;
    }
  }
  return parts.filter(Boolean).join("\n");
}

const LessonWorksheetGenerator = ({ lessonId, lessonTitle, blocks, onGenerated }: Props) => {
  const [count, setCount] = useState<number>(5);
  const [enabledTypes, setEnabledTypes] = useState<Record<GeneratedQuestion["type"], boolean>>({
    mcq: true,
    true_false: false,
    short_answer: false,
  });
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);

  const lessonContext = useMemo(() => extractText(blocks), [blocks]);
  const hasContext = lessonContext.trim().length >= 20;

  const toggleType = (t: GeneratedQuestion["type"]) =>
    setEnabledTypes((prev) => ({ ...prev, [t]: !prev[t] }));

  const handleGenerate = async () => {
    const types = (Object.keys(enabledTypes) as GeneratedQuestion["type"][]).filter(
      (t) => enabledTypes[t],
    );
    if (types.length === 0) {
      toast({ title: "Vyberte aspoň jeden typ otázky", variant: "destructive" });
      return;
    }
    if (!hasContext) {
      toast({
        title: "Lekce neobsahuje dost textu",
        description: "Přidej do lekce nadpisy, odstavce nebo seznamy.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-lesson-worksheet", {
        body: { lessonTitle, lessonContext, count, types },
      });
      if (error) throw error;
      if (!data?.questions || !Array.isArray(data.questions)) {
        throw new Error("AI nevrátila otázky");
      }
      setQuestions(data.questions);
      toast({ title: `Vygenerováno ${data.questions.length} otázek` });
    } catch (e: any) {
      toast({
        title: "Chyba při generování",
        description: e?.message || "Neznámá chyba",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateQuestion = (idx: number, patch: Partial<GeneratedQuestion>) => {
    setQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  };

  const updateOption = (qIdx: number, optIdx: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const opts = [...(q.options || [])];
        opts[optIdx] = value;
        return { ...q, options: opts };
      }),
    );
  };

  const addOption = (qIdx: number) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx ? { ...q, options: [...(q.options || []), ""] } : q,
      ),
    );
  };

  const removeOption = (qIdx: number, optIdx: number) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const opts = (q.options || []).filter((_, j) => j !== optIdx);
        let correctIndex = q.correctIndex ?? 0;
        if (correctIndex >= opts.length) correctIndex = Math.max(0, opts.length - 1);
        return { ...q, options: opts, correctIndex };
      }),
    );
  };

  const removeQuestion = (idx: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleApply = () => {
    if (questions.length === 0) {
      toast({ title: "Žádné otázky k použití", variant: "destructive" });
      return;
    }
    onGenerated(questions);
    toast({ title: "Otázky přidány do úlohy" });
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Vygenerovat pracovní list z lekce (AI)</h3>
          <Badge variant="secondary" className="ml-auto text-xs truncate max-w-[200px]">
            {lessonTitle || "Lekce"}
          </Badge>
        </div>

        {!hasContext && (
          <p className="text-xs text-destructive">
            Lekce neobsahuje dost textového obsahu pro generování.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Počet otázek</Label>
            <div className="flex gap-1 mt-1">
              {QUESTION_COUNTS.map((n) => (
                <Button
                  key={n}
                  type="button"
                  size="sm"
                  variant={count === n ? "default" : "outline"}
                  onClick={() => setCount(n)}
                >
                  {n}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Typy otázek</Label>
            <div className="flex flex-col gap-1 mt-1">
              {(Object.keys(TYPE_LABELS) as GeneratedQuestion["type"][]).map((t) => (
                <label key={t} className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox checked={enabledTypes[t]} onCheckedChange={() => toggleType(t)} />
                  {TYPE_LABELS[t]}
                </label>
              ))}
            </div>
          </div>
        </div>

        <Button onClick={handleGenerate} disabled={loading || !hasContext} className="w-full">
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
          Generovat pracovní list (AI)
        </Button>

        {questions.length > 0 && (
          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">
                Vygenerované otázky ({questions.length})
              </h4>
              <Button size="sm" onClick={handleApply}>
                Použít v úloze
              </Button>
            </div>

            {questions.map((q, qIdx) => (
              <Card key={qIdx} className="border-border/50">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="text-[10px] shrink-0 mt-1">
                      {TYPE_LABELS[q.type]}
                    </Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 ml-auto shrink-0"
                      onClick={() => removeQuestion(qIdx)}
                      title="Smazat otázku"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>

                  <Textarea
                    value={q.question}
                    onChange={(e) => updateQuestion(qIdx, { question: e.target.value })}
                    rows={2}
                    className="text-sm"
                    placeholder="Text otázky"
                  />

                  {q.type === "mcq" && (
                    <div className="space-y-1.5">
                      {(q.options || []).map((opt, oIdx) => (
                        <div key={oIdx} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`correct-${qIdx}`}
                            checked={q.correctIndex === oIdx}
                            onChange={() => updateQuestion(qIdx, { correctIndex: oIdx })}
                            className="shrink-0"
                            title="Správná odpověď"
                          />
                          <Input
                            value={opt}
                            onChange={(e) => updateOption(qIdx, oIdx, e.target.value)}
                            className="text-sm h-8"
                            placeholder={`Možnost ${oIdx + 1}`}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 shrink-0"
                            onClick={() => removeOption(qIdx, oIdx)}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => addOption(qIdx)}
                      >
                        <Plus className="w-3 h-3 mr-1" /> Přidat možnost
                      </Button>
                    </div>
                  )}

                  {q.type === "true_false" && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={q.correctAnswer === "true" ? "default" : "outline"}
                        onClick={() => updateQuestion(qIdx, { correctAnswer: "true" })}
                      >
                        Pravda
                      </Button>
                      <Button
                        size="sm"
                        variant={q.correctAnswer === "false" ? "default" : "outline"}
                        onClick={() => updateQuestion(qIdx, { correctAnswer: "false" })}
                      >
                        Nepravda
                      </Button>
                    </div>
                  )}

                  {q.type === "short_answer" && (
                    <div>
                      <Label className="text-xs">Vzorová odpověď</Label>
                      <Input
                        value={q.correctAnswer || ""}
                        onChange={(e) => updateQuestion(qIdx, { correctAnswer: e.target.value })}
                        className="text-sm h-8 mt-1"
                        placeholder="Očekávaná odpověď"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LessonWorksheetGenerator;
