import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Zap, Monitor, Smartphone, Printer, Accessibility, Award } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ActivitySpec {
  type: string;
  prompt: string;
  delivery: { mode: string; projectorPolicy: string; devicePolicy: string };
  model: any;
  scoring: { maxPoints: number; partialCredit: boolean; timeBonusEnabled?: boolean; scoringRules?: string };
  worksheetMapping: { printFormat: string; answerKeyIncluded: boolean; instructions: string };
  accessibility: { ariaLabel: string; alts?: Record<string, string> };
}

interface Props {
  slideContext: { headline: string; body: string; type: string };
  gradeBand: string;
}

const ACTIVITY_TYPES = [
  { value: "mcq", label: "Výběr z možností", icon: "🔘" },
  { value: "matching", label: "Spojování dvojic", icon: "🔗" },
  { value: "hotspot", label: "Klikání na obrázek", icon: "📍" },
  { value: "interactive_video", label: "Interaktivní video", icon: "🎬" },
];

const ActivitySpecGenerator = ({ slideContext, gradeBand }: Props) => {
  const [activityType, setActivityType] = useState("mcq");
  const [customPrompt, setCustomPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [spec, setSpec] = useState<ActivitySpec | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setSpec(null);

    try {
      const prompt = customPrompt || `${slideContext.headline}: ${slideContext.body}`;
      const { data, error } = await supabase.functions.invoke("generate-activity-spec", {
        body: { activityType, prompt, gradeBand },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.activity) {
        setSpec(data.activity);
        toast({ title: "Aktivita vygenerována", description: `Typ: ${activityType}` });
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
            <Badge variant="outline" className="text-xs">{spec.type}</Badge>
            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setSpec(null)}>Nová</Button>
          </div>

          <p className="text-sm font-medium">{spec.prompt}</p>

          {/* Delivery */}
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

          {/* Model data */}
          {spec.type === "mcq" && spec.model?.choices && (
            <div className="text-xs space-y-1 bg-background rounded p-2 border border-border">
              {spec.model.choices.map((c: string, i: number) => (
                <div key={i} className={`flex items-center gap-1 ${i === spec.model.correctIndex ? "font-bold text-green-700 dark:text-green-400" : ""}`}>
                  {i === spec.model.correctIndex ? "✓" : "○"} {c}
                </div>
              ))}
              {spec.model.explanation && (
                <p className="text-muted-foreground mt-1 italic">{spec.model.explanation}</p>
              )}
            </div>
          )}

          {spec.type === "matching" && spec.model?.pairs && (
            <div className="text-xs space-y-1 bg-background rounded p-2 border border-border">
              {spec.model.pairs.map((p: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="font-medium">{p.left}</span>
                  <span className="text-muted-foreground">↔</span>
                  <span>{p.right}</span>
                </div>
              ))}
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
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Accessibility className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span>{spec.accessibility.ariaLabel}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivitySpecGenerator;
