import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Zap, Monitor, Smartphone, Printer, Accessibility, Award, MessageCircle, Clock, User, Users, Keyboard } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ActivitySpec {
  type: string;
  prompt: string;
  delivery: {
    mode: string;
    projectorPolicy: string;
    devicePolicy: string;
    deviceInstructions?: string[];
    progressIndicator?: string;
  };
  feedback: { mode: string; summaryFeedback?: string };
  model: any;
  scoring: { maxPoints: number; partialCredit: boolean; timeBonusEnabled?: boolean; scoringRules?: string };
  worksheetMapping: { printFormat: string; answerKeyIncluded: boolean; instructions: string };
  accessibility: { ariaLabel: string; keyboardNav?: string; alts?: Record<string, string> };
}

interface Props {
  slideContext: { headline: string; body: string; type: string };
  gradeBand: string;
  deliveryMode?: "live" | "student_paced";
}

const ACTIVITY_TYPES = [
  { value: "mcq", label: "Výběr z možností", icon: "🔘" },
  { value: "matching", label: "Spojování dvojic", icon: "🔗" },
  { value: "hotspot", label: "Klikání na obrázek", icon: "📍" },
  { value: "interactive_video", label: "Interaktivní video", icon: "🎬" },
];

const FEEDBACK_MODES = [
  { value: "immediate", label: "Okamžitá", icon: "⚡", desc: "Po každé odpovědi" },
  { value: "delayed", label: "Odložená", icon: "📊", desc: "Po dokončení celé aktivity" },
];

const ActivitySpecGenerator = ({ slideContext, gradeBand, deliveryMode: parentDeliveryMode }: Props) => {
  const [activityType, setActivityType] = useState("mcq");
  const [customPrompt, setCustomPrompt] = useState("");
  const [feedbackMode, setFeedbackMode] = useState<"immediate" | "delayed">("immediate");
  const [generating, setGenerating] = useState(false);
  const [spec, setSpec] = useState<ActivitySpec | null>(null);

  const effectiveDeliveryMode = parentDeliveryMode || "live";
  const isStudentPaced = effectiveDeliveryMode === "student_paced";

  const handleGenerate = async () => {
    setGenerating(true);
    setSpec(null);

    try {
      const prompt = customPrompt || `${slideContext.headline}: ${slideContext.body}`;
      const { data, error } = await supabase.functions.invoke("generate-activity-spec", {
        body: {
          activityType,
          prompt,
          gradeBand,
          deliveryMode: effectiveDeliveryMode,
          feedbackMode,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.activity) {
        setSpec(data.activity);
        toast({ title: "Aktivita vygenerována", description: `Typ: ${activityType} · Feedback: ${feedbackMode}` });
      }
    } catch (e: any) {
      console.error("Activity generation error:", e);
      toast({ title: "Chyba", description: e.message || "Nepodařilo se vygenerovat aktivitu.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="border border-dashed border-primary/30 rounded-lg p-3 space-y-3 bg-primary/5">
      <h4 className="text-xs font-semibold flex items-center gap-1.5 text-primary">
        <Zap className="w-3.5 h-3.5" />
        Generátor aktivity pro slide
        {isStudentPaced && (
          <Badge variant="outline" className="text-[10px] ml-1 font-normal border-emerald-300 text-emerald-700 dark:text-emerald-300">
            <User className="w-3 h-3 mr-0.5" /> Samostudium
          </Badge>
        )}
      </h4>

      {!spec ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Typ aktivity</Label>
              <Select value={activityType} onValueChange={setActivityType}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Vlastní zadání (volitelné)</Label>
              <Input
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Použije se kontext slidu…"
                className="mt-1 h-8 text-xs"
              />
            </div>
          </div>

          {/* Feedback mode selector */}
          <div>
            <Label className="text-xs">Zpětná vazba</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {FEEDBACK_MODES.map((fm) => (
                <button
                  key={fm.value}
                  type="button"
                  onClick={() => setFeedbackMode(fm.value as "immediate" | "delayed")}
                  className={`flex items-center gap-1.5 p-2 rounded-lg border text-xs transition-colors ${
                    feedbackMode === fm.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <span>{fm.icon}</span>
                  <div className="text-left">
                    <div className="font-medium">{fm.label}</div>
                    <div className="text-[10px] opacity-70">{fm.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <Button size="sm" onClick={handleGenerate} disabled={generating} className="w-full h-8 text-xs">
            {generating ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Generuji…</>
            ) : (
              <><Zap className="w-3.5 h-3.5 mr-1.5" />Vygenerovat aktivitu</>
            )}
          </Button>
        </>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-xs">{spec.type}</Badge>
              <Badge variant="outline" className={`text-[10px] ${
                spec.feedback?.mode === "immediate"
                  ? "border-amber-300 text-amber-700 dark:text-amber-300"
                  : "border-sky-300 text-sky-700 dark:text-sky-300"
              }`}>
                {spec.feedback?.mode === "immediate" ? "⚡ Okamžitá" : "📊 Odložená"} zpětná vazba
              </Badge>
            </div>
            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setSpec(null)}>Nová</Button>
          </div>

          <p className="text-sm font-medium">{spec.prompt}</p>

          {/* Delivery */}
          {isStudentPaced ? (
            <div className="space-y-2">
              <div className="flex items-start gap-1.5 text-xs bg-muted/40 rounded p-2 border border-border">
                <Smartphone className="w-3 h-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                <span>{spec.delivery.devicePolicy}</span>
              </div>
              {spec.delivery.deviceInstructions && spec.delivery.deviceInstructions.length > 0 && (
                <div className="text-xs bg-background rounded p-2 border border-border space-y-1">
                  <span className="font-medium text-muted-foreground">Kroky pro žáka:</span>
                  <ol className="list-decimal list-inside space-y-0.5">
                    {spec.delivery.deviceInstructions.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}
              {spec.delivery.progressIndicator && (
                <p className="text-[10px] text-muted-foreground italic">
                  Postup: {spec.delivery.progressIndicator}
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-start gap-1.5 text-xs bg-background rounded p-2 border border-border">
                <Monitor className="w-3 h-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                <span>{spec.delivery.projectorPolicy}</span>
              </div>
              <div className="flex items-start gap-1.5 text-xs bg-muted/40 rounded p-2 border border-border">
                <Smartphone className="w-3 h-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                <span>{spec.delivery.devicePolicy}</span>
              </div>
            </div>
          )}

          {/* Model data - MCQ */}
          {spec.type === "mcq" && spec.model?.choices && (
            <div className="text-xs space-y-1 bg-background rounded p-2 border border-border">
              {spec.model.choices.map((c: string, i: number) => (
                <div key={i} className={`flex items-center gap-1 ${i === spec.model.correctIndex ? "font-bold text-emerald-700 dark:text-emerald-400" : ""}`}>
                  {i === spec.model.correctIndex ? "✓" : "○"} {c}
                </div>
              ))}
              {spec.model.explanation && (
                <p className="text-muted-foreground mt-1 italic">{spec.model.explanation}</p>
              )}
              {spec.model.hint && (
                <p className="text-muted-foreground mt-1">💡 Nápověda: {spec.model.hint}</p>
              )}
              {spec.feedback?.mode === "immediate" && (
                <div className="mt-2 space-y-0.5 border-t border-border pt-1.5">
                  {spec.model.feedbackCorrect && <p className="text-emerald-600 dark:text-emerald-400">✓ {spec.model.feedbackCorrect}</p>}
                  {spec.model.feedbackIncorrect && <p className="text-destructive">✗ {spec.model.feedbackIncorrect}</p>}
                </div>
              )}
            </div>
          )}

          {/* Model data - Matching */}
          {spec.type === "matching" && spec.model?.pairs && (
            <div className="text-xs space-y-1 bg-background rounded p-2 border border-border">
              {spec.model.pairs.map((p: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="font-medium">{p.left}</span>
                  <span className="text-muted-foreground">↔</span>
                  <span>{p.right}</span>
                </div>
              ))}
              {spec.model.hint && (
                <p className="text-muted-foreground mt-1">💡 {spec.model.hint}</p>
              )}
            </div>
          )}

          {/* Model data - Interactive Video */}
          {spec.type === "interactive_video" && spec.model?.checkpoints && (
            <div className="text-xs space-y-1.5 bg-background rounded p-2 border border-border">
              {spec.model.checkpoints.map((cp: any, i: number) => (
                <div key={i} className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="font-medium">{cp.timestampSec}s</span>
                    <span>{cp.question}</span>
                  </div>
                  {cp.explanation && <p className="ml-5 text-muted-foreground italic">{cp.explanation}</p>}
                </div>
              ))}
              {spec.model.summaryFeedback && (
                <p className="text-muted-foreground mt-1 border-t border-border pt-1">📊 {spec.model.summaryFeedback}</p>
              )}
            </div>
          )}

          {/* Feedback summary (delayed mode) */}
          {spec.feedback?.mode === "delayed" && spec.feedback.summaryFeedback && (
            <div className="flex items-start gap-1.5 text-xs bg-sky-50 dark:bg-sky-950/20 rounded p-2 border border-sky-200 dark:border-sky-800">
              <MessageCircle className="w-3 h-3 mt-0.5 text-sky-600 dark:text-sky-400 flex-shrink-0" />
              <div>
                <span className="font-medium text-sky-700 dark:text-sky-300">Souhrnná zpětná vazba:</span>{" "}
                <span className="text-sky-600 dark:text-sky-400">{spec.feedback.summaryFeedback}</span>
              </div>
            </div>
          )}

          {/* Scoring */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Award className="w-3 h-3" />
            Max {spec.scoring.maxPoints} b. · {spec.scoring.partialCredit ? "Částečné hodnocení" : "Vše nebo nic"}
            {spec.scoring.timeBonusEnabled && " · Bonus za rychlost"}
          </div>

          {/* Worksheet */}
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/20 rounded p-2">
            <Printer className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-medium">Pracovní list:</span> {spec.worksheetMapping.printFormat}
              {spec.worksheetMapping.answerKeyIncluded && " (vč. klíče)"}
            </div>
          </div>

          {/* Accessibility */}
          <div className="space-y-1">
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Accessibility className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>{spec.accessibility.ariaLabel}</span>
            </div>
            {spec.accessibility.keyboardNav && (
              <div className="flex items-start gap-1.5 text-xs text-muted-foreground ml-4">
                <Keyboard className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>{spec.accessibility.keyboardNav}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivitySpecGenerator;
