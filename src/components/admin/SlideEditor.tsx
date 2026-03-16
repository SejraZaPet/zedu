import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, ArrowDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const EXAMPLE_SLIDE = JSON.stringify(
  { question: "Co je Salmonella?", options: ["virus", "bakterie", "houba"], correctIndex: 1 },
  null,
  2
);

const SlideEditor = () => {
  const [slideJson, setSlideJson] = useState(EXAMPLE_SLIDE);
  const [instruction, setInstruction] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<Record<string, any> | null>(null);

  const handleEdit = async () => {
    let slide: any;
    try {
      slide = JSON.parse(slideJson);
    } catch {
      toast({ title: "Chyba", description: "Neplatný JSON slide.", variant: "destructive" });
      return;
    }

    setGenerating(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("edit-slide", {
        body: { slide, instruction: instruction.trim() || undefined },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.slide) {
        setResult(data.slide);
        toast({ title: "Slide upraven" });
      }
    } catch (e: any) {
      console.error("Slide edit error:", e);
      toast({ title: "Chyba úpravy", description: e.message || "Nepodařilo se upravit slide.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const applyResult = () => {
    if (result) {
      setSlideJson(JSON.stringify(result, null, 2));
      setResult(null);
      setInstruction("");
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3 p-4 border border-border rounded-lg bg-muted/30">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Editor slidu (AI)
        </h3>
        <p className="text-xs text-muted-foreground">
          Vložte JSON slidu a instrukci – AI slide upraví podle vašich pokynů.
        </p>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Slide (JSON)</Label>
            <Textarea
              value={slideJson}
              onChange={(e) => setSlideJson(e.target.value)}
              className="mt-1 min-h-[120px] font-mono text-xs"
              placeholder='{ "question": "...", "options": [...] }'
            />
          </div>
          <div>
            <Label className="text-xs">Instrukce k úpravě</Label>
            <Input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="např. udělej otázku složitější, přidej vysvětlení"
              className="mt-1"
            />
          </div>
        </div>

        <Button onClick={handleEdit} disabled={generating} className="w-full">
          {generating ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Upravuji slide…</>
          ) : (
            <><Sparkles className="w-4 h-4 mr-2" />Upravit slide</>
          )}
        </Button>
      </div>

      {result && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Upravený slide</h3>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setResult(null)}>Zrušit</Button>
              <Button size="sm" onClick={applyResult}>
                <ArrowDown className="w-4 h-4 mr-1" />
                Použít jako vstup
              </Button>
            </div>
          </div>

          {/* Visual diff: before → after */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 border border-border rounded-lg bg-background">
              <p className="text-[10px] font-medium text-muted-foreground mb-2 uppercase">Původní</p>
              <pre className="text-[11px] overflow-x-auto whitespace-pre-wrap">{slideJson}</pre>
            </div>
            <div className="p-3 border border-primary/30 rounded-lg bg-primary/5">
              <p className="text-[10px] font-medium text-primary mb-2 uppercase">Upravený</p>
              <pre className="text-[11px] overflow-x-auto whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SlideEditor;
