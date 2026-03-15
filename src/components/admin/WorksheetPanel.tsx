import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Loader2, FileText, Printer, Eye, EyeOff, CheckCircle2, XCircle, ArrowRightLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface WorksheetItem {
  itemNumber: number;
  type: string;
  question: string;
  options?: string[];
  matchPairs?: { left: string; right: string }[];
  points: number;
}

interface AnswerKeyItem {
  itemNumber: number;
  correctAnswer: string;
  explanation?: string;
}

interface WorksheetVariant {
  id: string;
  seed: number;
  items: WorksheetItem[];
}

interface WorksheetData {
  title: string;
  subject?: string;
  gradeBand?: string;
  variants: WorksheetVariant[];
  answerKeys: Record<string, AnswerKeyItem[]>;
  randomizationRules: { rule: string; appliedTo: string }[];
  totalPoints: number;
}

interface Props {
  lessonPlanId: string;
  planTitle: string;
  gradeBand: string;
}

const TYPE_LABELS: Record<string, string> = {
  mcq: "Výběr z možností",
  fill_blank: "Doplňovačka",
  true_false: "Pravda / Nepravda",
  matching: "Spojování",
  ordering: "Seřazení",
  short_answer: "Krátká odpověď",
};

const TYPE_ICONS: Record<string, string> = {
  mcq: "🔘", fill_blank: "✏️", true_false: "✓✗", matching: "🔗", ordering: "📋", short_answer: "💬",
};

const WorksheetPanel = ({ lessonPlanId, planTitle, gradeBand }: Props) => {
  const [generating, setGenerating] = useState(false);
  const [worksheet, setWorksheet] = useState<WorksheetData | null>(null);
  const [activeVariant, setActiveVariant] = useState("A");
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [numItems, setNumItems] = useState(10);
  const printRef = useRef<HTMLDivElement>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setWorksheet(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-worksheet", {
        body: { lessonPlanId, gradeBand, numItems, variants: ["A", "B"] },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.worksheet) {
        setWorksheet(data.worksheet);
        setActiveVariant("A");
        setShowAnswerKey(false);
        toast({ title: "Pracovní list vygenerován", description: `${data.worksheet.variants?.[0]?.items?.length || 0} úloh, ${data.worksheet.totalPoints} bodů` });
      }
    } catch (e: any) {
      console.error("Worksheet error:", e);
      toast({ title: "Chyba", description: e.message || "Nepodařilo se vygenerovat.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>${worksheet?.title || "Pracovní list"} – Varianta ${activeVariant}</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; padding: 2rem; color: #1a1a1a; max-width: 800px; margin: 0 auto; }
        h1 { font-size: 1.4rem; margin-bottom: 0.25rem; }
        .meta { color: #666; font-size: 0.85rem; margin-bottom: 1.5rem; border-bottom: 2px solid #333; padding-bottom: 0.5rem; }
        .item { margin-bottom: 1.2rem; page-break-inside: avoid; }
        .item-header { font-weight: 600; margin-bottom: 0.3rem; }
        .item-type { color: #888; font-size: 0.75rem; }
        .options { list-style: upper-alpha; padding-left: 1.5rem; }
        .options li { margin: 0.2rem 0; }
        .match-table { border-collapse: collapse; width: 100%; margin: 0.3rem 0; }
        .match-table td { border: 1px solid #ccc; padding: 0.3rem 0.5rem; font-size: 0.9rem; }
        .lines { border-bottom: 1px solid #ccc; height: 1.5rem; margin: 0.2rem 0; }
        .answer-section { margin-top: 2rem; border-top: 2px solid #333; padding-top: 1rem; }
        .answer-item { margin-bottom: 0.5rem; font-size: 0.9rem; }
        .points { float: right; color: #888; font-size: 0.8rem; }
        @media print { body { padding: 1rem; } }
      </style>
    </head><body>${content.innerHTML}</body></html>`);
    win.document.close();
    win.print();
  };

  const currentVariant = worksheet?.variants?.find((v) => v.id === activeVariant);
  const currentAnswerKey = worksheet?.answerKeys?.[activeVariant];

  return (
    <div className="border border-dashed border-primary/30 rounded-lg p-4 space-y-4 bg-primary/5">
      <h4 className="text-sm font-semibold flex items-center gap-2 text-primary">
        <FileText className="w-4 h-4" />
        Generátor pracovního listu
      </h4>

      {!worksheet ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            AI vygeneruje pracovní list s variantami A/B na základě plánu lekce. Každá varianta má jiné pořadí úloh a možností.
          </p>
          <div className="flex items-end gap-3">
            <div>
              <Label className="text-xs">Počet úloh</Label>
              <Input
                type="number"
                min={5}
                max={20}
                value={numItems}
                onChange={(e) => setNumItems(Number(e.target.value))}
                className="mt-1 w-24 h-8 text-xs"
              />
            </div>
            <Button size="sm" onClick={handleGenerate} disabled={generating} className="h-8">
              {generating ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Generuji…</>
              ) : (
                <><FileText className="w-3.5 h-3.5 mr-1.5" />Vygenerovat</>
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Controls */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              {worksheet.variants.map((v) => (
                <Button
                  key={v.id}
                  size="sm"
                  variant={activeVariant === v.id ? "default" : "outline"}
                  onClick={() => setActiveVariant(v.id)}
                  className="h-7 text-xs"
                >
                  Varianta {v.id}
                </Button>
              ))}
              <Badge variant="secondary" className="text-xs">
                {worksheet.totalPoints} b.
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Switch
                  id="answer-key"
                  checked={showAnswerKey}
                  onCheckedChange={setShowAnswerKey}
                />
                <Label htmlFor="answer-key" className="text-xs cursor-pointer">
                  {showAnswerKey ? <Eye className="w-3.5 h-3.5 inline mr-1" /> : <EyeOff className="w-3.5 h-3.5 inline mr-1" />}
                  Klíč
                </Label>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handlePrint}>
                <Printer className="w-3.5 h-3.5 mr-1" />Tisk
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setWorksheet(null)}>
                Nový
              </Button>
            </div>
          </div>

          {/* Randomization rules */}
          {worksheet.randomizationRules?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {worksheet.randomizationRules.map((r, i) => (
                <Badge key={i} variant="outline" className="text-[10px] font-normal">
                  <ArrowRightLeft className="w-2.5 h-2.5 mr-1" />
                  {r.rule}: {r.appliedTo}
                </Badge>
              ))}
            </div>
          )}

          {/* Printable content */}
          <div ref={printRef}>
            <h1 style={{ display: "none" }}>{worksheet.title} – Varianta {activeVariant}</h1>
            <div style={{ display: "none" }} className="meta">
              {worksheet.subject} · {worksheet.gradeBand} · {worksheet.totalPoints} bodů · Varianta {activeVariant}
            </div>

            {/* Items */}
            <div className="space-y-3">
              {currentVariant?.items?.map((item) => {
                const answer = currentAnswerKey?.find((a) => a.itemNumber === item.itemNumber);
                return (
                  <div key={item.itemNumber} className="border border-border rounded-lg p-3 bg-background">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground w-5">{item.itemNumber}.</span>
                        <Badge variant="outline" className="text-[10px]">
                          {TYPE_ICONS[item.type] || "?"} {TYPE_LABELS[item.type] || item.type}
                        </Badge>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{item.points} b.</span>
                    </div>

                    <p className="text-sm font-medium ml-7 mb-1.5">{item.question}</p>

                    {/* MCQ options */}
                    {item.type === "mcq" && item.options && (
                      <div className="ml-7 space-y-1">
                        {item.options.map((opt, oi) => (
                          <div
                            key={oi}
                            className={`text-xs px-2 py-1 rounded border ${
                              showAnswerKey && answer?.correctAnswer === opt
                                ? "border-green-500/60 bg-green-500/10 font-medium"
                                : "border-border"
                            }`}
                          >
                            {String.fromCharCode(65 + oi)}) {opt}
                            {showAnswerKey && answer?.correctAnswer === opt && (
                              <CheckCircle2 className="w-3 h-3 inline ml-1 text-green-600" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* True/False */}
                    {item.type === "true_false" && (
                      <div className="ml-7 flex gap-2">
                        {["Pravda", "Nepravda"].map((tf) => (
                          <span
                            key={tf}
                            className={`text-xs px-2 py-1 rounded border ${
                              showAnswerKey && answer?.correctAnswer === tf
                                ? "border-green-500/60 bg-green-500/10 font-medium"
                                : "border-border"
                            }`}
                          >
                            {tf}
                            {showAnswerKey && answer?.correctAnswer === tf && (
                              <CheckCircle2 className="w-3 h-3 inline ml-1 text-green-600" />
                            )}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Matching */}
                    {item.type === "matching" && item.matchPairs && (
                      <div className="ml-7 grid grid-cols-2 gap-1 text-xs">
                        {item.matchPairs.map((p, pi) => (
                          <div key={pi} className="flex items-center gap-1 border border-border rounded px-2 py-1">
                            <span className="font-medium">{p.left}</span>
                            <span className="text-muted-foreground">↔</span>
                            <span>{showAnswerKey ? p.right : "___"}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Ordering options */}
                    {item.type === "ordering" && item.options && (
                      <div className="ml-7 space-y-1">
                        {item.options.map((opt, oi) => (
                          <div key={oi} className="text-xs border border-border rounded px-2 py-1 flex items-center gap-2">
                            <span className="text-muted-foreground">☐</span> {opt}
                          </div>
                        ))}
                        {showAnswerKey && answer && (
                          <p className="text-xs text-green-600 mt-1">✓ {answer.correctAnswer}</p>
                        )}
                      </div>
                    )}

                    {/* Fill blank / Short answer */}
                    {(item.type === "fill_blank" || item.type === "short_answer") && (
                      <div className="ml-7">
                        <div className="border-b border-dashed border-muted-foreground/40 h-6 w-48" />
                        {showAnswerKey && answer && (
                          <p className="text-xs text-green-600 mt-1">✓ {answer.correctAnswer}</p>
                        )}
                      </div>
                    )}

                    {/* Answer explanation */}
                    {showAnswerKey && answer?.explanation && (
                      <p className="ml-7 text-[11px] text-muted-foreground italic mt-1">{answer.explanation}</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Standalone answer key for print */}
            {showAnswerKey && currentAnswerKey && (
              <div className="answer-section mt-4 pt-3 border-t border-border">
                <h3 className="text-xs font-bold mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                  Klíč odpovědí – Varianta {activeVariant}
                </h3>
                <div className="grid grid-cols-2 gap-1">
                  {currentAnswerKey.map((a) => (
                    <div key={a.itemNumber} className="text-xs text-muted-foreground">
                      <span className="font-medium">{a.itemNumber}.</span> {a.correctAnswer}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorksheetPanel;
