import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, FileText, MessageSquare, Image, HelpCircle, Dumbbell, BookOpen } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface OutlineSlide {
  slideNumber: number;
  title: string;
  type: "text" | "mcq" | "image" | "discussion" | "activity" | "summary";
  summary: string;
}

const TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  text: { label: "Výklad", icon: FileText, color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  mcq: { label: "Kvíz", icon: HelpCircle, color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  image: { label: "Obrázek", icon: Image, color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  discussion: { label: "Diskuse", icon: MessageSquare, color: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200" },
  activity: { label: "Aktivita", icon: Dumbbell, color: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200" },
  summary: { label: "Shrnutí", icon: BookOpen, color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
};

const LessonOutlineGenerator = () => {
  const [topic, setTopic] = useState("");
  const [textbook, setTextbook] = useState("");
  const [generating, setGenerating] = useState(false);
  const [outline, setOutline] = useState<OutlineSlide[] | null>(null);

  const handleGenerate = async () => {
    if (!topic.trim() || !textbook.trim()) {
      toast({ title: "Chyba", description: "Vyplňte téma i učebnici.", variant: "destructive" });
      return;
    }

    setGenerating(true);
    setOutline(null);

    try {
      const { data, error } = await supabase.functions.invoke("generate-lesson-outline", {
        body: { topic: topic.trim(), textbook: textbook.trim() },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.outline) {
        setOutline(data.outline);
        toast({ title: "Osnova vygenerována", description: `${data.outline.length} slidů připraveno.` });
      }
    } catch (e: any) {
      console.error("Outline generation error:", e);
      toast({ title: "Chyba generování", description: e.message || "Nepodařilo se vygenerovat osnovu.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Input form */}
      <div className="space-y-3 p-4 border border-border rounded-lg bg-muted/30">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Generátor osnovy lekce (AI)
        </h3>
        <p className="text-xs text-muted-foreground">
          Zadejte téma a cílovou učebnici – AI vytvoří strukturovanou osnovu se slidy.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Téma</Label>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="např. Alimentární nákazy"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Učebnice</Label>
            <Input
              value={textbook}
              onChange={(e) => setTextbook(e.target.value)}
              placeholder="např. Biologie 8 - řepková, RVP ZŠ"
              className="mt-1"
            />
          </div>
        </div>

        <Button onClick={handleGenerate} disabled={generating} className="w-full">
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generuji osnovu…
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Vygenerovat osnovu
            </>
          )}
        </Button>
      </div>

      {/* Outline result */}
      {outline && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">
              Osnova: {topic} ({outline.length} slidů)
            </h3>
            <Button size="sm" variant="outline" onClick={() => setOutline(null)}>
              Nová osnova
            </Button>
          </div>

          <div className="space-y-2">
            {outline.map((slide) => {
              const meta = TYPE_META[slide.type] || TYPE_META.text;
              const Icon = meta.icon;
              return (
                <div
                  key={slide.slideNumber}
                  className="flex items-start gap-3 p-3 border border-border rounded-lg bg-background hover:bg-muted/20 transition-colors"
                >
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                    {slide.slideNumber}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{slide.title}</span>
                      <Badge className={`text-[10px] ${meta.color}`}>
                        <Icon className="w-3 h-3 mr-1" />
                        {meta.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{slide.summary}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* JSON export */}
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
              Zobrazit JSON výstup
            </summary>
            <pre className="mt-2 p-3 bg-muted rounded-lg overflow-x-auto text-[11px]">
              {JSON.stringify({ outline }, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
};

export default LessonOutlineGenerator;
