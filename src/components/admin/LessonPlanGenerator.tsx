import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Monitor, Smartphone, StickyNote, ChevronLeft, ChevronRight, Save, Zap, Play } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import ActivitySpecGenerator from "./ActivitySpecGenerator";
import ExportPanel from "./ExportPanel";

interface Slide {
  slideId: string;
  type: string;
  projector: { headline: string; body: string; assetRefs?: string[] };
  device: { instructions: string; activityRefs?: string[] };
  teacherNotes: string;
}

interface LessonPlan {
  title: string;
  subject: string;
  gradeBand: string;
  slides: Slide[];
}

interface Props {
  lessonId: string;
  lessonTitle: string;
  lessonBlocks: any[];
}

const SLIDE_TYPE_LABELS: Record<string, string> = {
  intro: "Úvod",
  objective: "Cíl",
  explain: "Výklad",
  practice: "Procvičení",
  activity: "Aktivita",
  summary: "Shrnutí",
  exit: "Exit ticket",
};

const SLIDE_TYPE_COLORS: Record<string, string> = {
  intro: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  objective: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  explain: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  practice: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  activity: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
  summary: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  exit: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

const LessonPlanGenerator = ({ lessonId, lessonTitle, lessonBlocks }: Props) => {
  const navigate = useNavigate();
  const [subject, setSubject] = useState("");
  const [gradeBand, setGradeBand] = useState("");
  const [durationMin, setDurationMin] = useState(45);
  const [keyConcepts, setKeyConcepts] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [savedPlanId, setSavedPlanId] = useState<string | null>(null);
  const [plan, setPlan] = useState<LessonPlan | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  // Extract source text from lesson blocks
  const extractSourceText = (): string => {
    if (!lessonBlocks || lessonBlocks.length === 0) return "";
    return lessonBlocks
      .filter((b: any) => ["paragraph", "heading", "bullet_list", "summary", "callout", "two_column"].includes(b.type))
      .map((b: any) => {
        if (b.type === "heading") return b.props?.text || "";
        if (b.type === "paragraph") return b.props?.text?.replace(/<[^>]*>/g, "") || "";
        if (b.type === "bullet_list") return (b.props?.items || []).join("\n");
        if (b.type === "summary") return `${b.props?.title || ""}\n${b.props?.text?.replace(/<[^>]*>/g, "") || ""}`;
        if (b.type === "callout") return b.props?.text?.replace(/<[^>]*>/g, "") || "";
        if (b.type === "two_column") return `${b.props?.left?.replace(/<[^>]*>/g, "") || ""}\n${b.props?.right?.replace(/<[^>]*>/g, "") || ""}`;
        return "";
      })
      .filter(Boolean)
      .join("\n\n");
  };

  const handleGenerate = async () => {
    const sourceText = extractSourceText();
    if (!sourceText && !lessonTitle) {
      toast({ title: "Chyba", description: "Lekce nemá žádný obsah pro generování plánu.", variant: "destructive" });
      return;
    }

    setGenerating(true);
    setPlan(null);

    try {
      const { data, error } = await supabase.functions.invoke("generate-lesson-plan", {
        body: {
          textbookLesson: {
            title: lessonTitle,
            subject: subject || "nespecifikováno",
            gradeBand: gradeBand || "nespecifikováno",
            durationMin,
            keyConcepts: keyConcepts.split(",").map((s) => s.trim()).filter(Boolean),
            sourceText: sourceText || lessonTitle,
          },
          style: "přehledný, školní, minimalistický",
          language: "cs-CZ",
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.lessonPlan) {
        setPlan(data.lessonPlan);
        setActiveSlide(0);
        toast({ title: "Plán vygenerován", description: `${data.lessonPlan.slides?.length || 0} slidů připraveno.` });
      }
    } catch (e: any) {
      console.error("Generation error:", e);
      toast({ title: "Chyba generování", description: e.message || "Nepodařilo se vygenerovat plán.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!plan) return;
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nepřihlášen");

      const { data: inserted, error } = await supabase.from("lesson_plans" as any).insert({
        lesson_id: lessonId,
        teacher_id: user.id,
        title: plan.title,
        subject: plan.subject,
        grade_band: plan.gradeBand,
        slides: plan.slides,
        input_data: { keyConcepts: keyConcepts.split(",").map((s) => s.trim()).filter(Boolean), durationMin },
      } as any).select("id").single();

      if (error) throw error;
      setSavedPlanId((inserted as any)?.id || null);
      toast({ title: "Plán uložen", description: "Plán lekce byl uložen do databáze." });
    } catch (e: any) {
      console.error("Save error:", e);
      toast({ title: "Chyba ukládání", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleLaunchLive = async () => {
    if (!plan) return;
    setLaunching(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-live-session", {
        body: {
          lessonPlanId: lessonId,
          title: plan.title,
          slides: plan.slides,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Live session vytvořena", description: `Kód: ${data.gameCode}` });
      navigate(`/live/ucitel/${data.sessionId}`);
    } catch (e: any) {
      console.error("Launch error:", e);
      toast({ title: "Chyba", description: e.message, variant: "destructive" });
    } finally {
      setLaunching(false);
    }
  };

  const currentSlide = plan?.slides?.[activeSlide];

  return (
    <div className="space-y-4">
      {/* Input form */}
      {!plan && (
        <div className="space-y-3 p-4 border border-border rounded-lg bg-muted/30">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Generátor plánu lekce (AI)
          </h3>
          <p className="text-xs text-muted-foreground">
            AI vytvoří strukturovaný plán se slidy pro projektor a zařízení žáků na základě obsahu lekce.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Předmět</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="např. Český jazyk" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Ročník</Label>
              <Input value={gradeBand} onChange={(e) => setGradeBand(e.target.value)} placeholder="např. 4.–5. ročník" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Délka (min)</Label>
              <Input type="number" value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Klíčové pojmy (čárkou)</Label>
              <Input value={keyConcepts} onChange={(e) => setKeyConcepts(e.target.value)} placeholder="pojem1, pojem2" className="mt-1" />
            </div>
          </div>

          <Button onClick={handleGenerate} disabled={generating} className="w-full">
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generuji plán…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Vygenerovat plán lekce
              </>
            )}
          </Button>
        </div>
      )}

      {/* Plan preview */}
      {plan && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">{plan.title}</h3>
              <p className="text-xs text-muted-foreground">{plan.subject} · {plan.gradeBand} · {plan.slides.length} slidů</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => setPlan(null)}>Nový plán</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                Uložit
              </Button>
              <Button size="sm" variant="default" onClick={handleLaunchLive} disabled={launching} className="bg-green-600 hover:bg-green-700 text-white">
                {launching ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1" />}
                Spustit live výuku
              </Button>
            </div>
          </div>

          {/* Slide navigation strip */}
          <div className="flex gap-1 overflow-x-auto pb-1">
            {plan.slides.map((s, i) => (
              <button
                key={s.slideId}
                onClick={() => setActiveSlide(i)}
                className={`flex-shrink-0 px-2 py-1 rounded text-xs font-medium transition-colors ${
                  i === activeSlide
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>

          {/* Active slide detail */}
          {currentSlide && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge className={SLIDE_TYPE_COLORS[currentSlide.type] || "bg-muted text-muted-foreground"}>
                  {SLIDE_TYPE_LABELS[currentSlide.type] || currentSlide.type}
                </Badge>
                <span className="text-xs text-muted-foreground">Slide {activeSlide + 1} / {plan.slides.length}</span>
              </div>

              {/* Projector view */}
              <div className="border border-border rounded-lg p-4 bg-background">
                <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground">
                  <Monitor className="w-3.5 h-3.5" />
                  PROJEKTOR
                </div>
                <h4 className="font-bold text-lg">{currentSlide.projector.headline}</h4>
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{currentSlide.projector.body}</p>
              </div>

              {/* Device view */}
              <div className="border border-border rounded-lg p-4 bg-muted/30">
                <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground">
                  <Smartphone className="w-3.5 h-3.5" />
                  ZAŘÍZENÍ ŽÁKA
                </div>
                <p className="text-sm whitespace-pre-wrap">{currentSlide.device.instructions}</p>
              </div>

              {/* Teacher notes */}
              {currentSlide.teacherNotes && (
                <div className="border border-dashed border-border rounded-lg p-3 bg-muted/10">
                  <div className="flex items-center gap-2 mb-1 text-xs font-medium text-muted-foreground">
                    <StickyNote className="w-3.5 h-3.5" />
                    POZNÁMKY PRO UČITELE
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{currentSlide.teacherNotes}</p>
                </div>
              )}

              {/* Activity generator for practice/activity/exit slides */}
              {["practice", "activity", "exit"].includes(currentSlide.type) && (
                <ActivitySpecGenerator
                  slideContext={{
                    headline: currentSlide.projector.headline,
                    body: currentSlide.projector.body,
                    type: currentSlide.type,
                  }}
                  gradeBand={plan.gradeBand}
                />
              )}

              {/* Navigation */}
              <div className="flex justify-between">
                <Button size="sm" variant="outline" disabled={activeSlide === 0} onClick={() => setActiveSlide((p) => p - 1)}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Předchozí
                </Button>
                <Button size="sm" variant="outline" disabled={activeSlide >= plan.slides.length - 1} onClick={() => setActiveSlide((p) => p + 1)}>
                  Další <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Export panel - shown after save */}
          {savedPlanId && (
            <div className="border-t border-border pt-4">
              <ExportPanel
                lessonPlanId={savedPlanId}
                planTitle={plan.title}
                planSlides={plan.slides}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LessonPlanGenerator;
