import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, ArrowRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface MatchingResult {
  leftItems: string[];
  rightItems: string[];
}

const MatchingGenerator = () => {
  const [termsStr, setTermsStr] = useState("");
  const [defsStr, setDefsStr] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<MatchingResult | null>(null);

  const handleGenerate = async () => {
    const terms = termsStr.split(",").map((t) => t.trim()).filter(Boolean);
    if (terms.length < 2) {
      toast({ title: "Chyba", description: "Zadejte alespoň 2 pojmy oddělené čárkou.", variant: "destructive" });
      return;
    }

    const definitions = defsStr ? defsStr.split(",").map((d) => d.trim()).filter(Boolean) : [];

    setGenerating(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("generate-matching", {
        body: { terms, definitions },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.leftItems) {
        setResult(data);
        toast({ title: "Matching aktivita vygenerována" });
      }
    } catch (e: any) {
      console.error("Matching generation error:", e);
      toast({ title: "Chyba generování", description: e.message || "Nepodařilo se vygenerovat.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3 p-4 border border-border rounded-lg bg-muted/30">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Generátor matching aktivity (AI)
        </h3>
        <p className="text-xs text-muted-foreground">
          Zadejte pojmy (a volitelně definice) – AI vytvoří přiřazovací aktivitu se správnými dvojicemi.
        </p>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Pojmy (čárkou)</Label>
            <Input
              value={termsStr}
              onChange={(e) => setTermsStr(e.target.value)}
              placeholder="Salmonela, Botulismus, Hepatitida"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Definice (volitelné, čárkou – AI je opraví/doplní)</Label>
            <Textarea
              value={defsStr}
              onChange={(e) => setDefsStr(e.target.value)}
              placeholder="bakterie v potravinách, choroba způsobená jedy, zánět jater"
              className="mt-1 min-h-[60px]"
            />
          </div>
        </div>

        <Button onClick={handleGenerate} disabled={generating} className="w-full">
          {generating ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generuji matching…</>
          ) : (
            <><Sparkles className="w-4 h-4 mr-2" />Vygenerovat matching</>
          )}
        </Button>
      </div>

      {result && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Vygenerovaná matching aktivita</h3>
            <Button size="sm" variant="outline" onClick={() => setResult(null)}>Nová aktivita</Button>
          </div>

          <div className="space-y-2">
            {result.leftItems.map((left, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 border border-border rounded-lg bg-background"
              >
                <span className="flex-1 text-sm font-medium px-3 py-1.5 rounded bg-primary/10 text-primary">
                  {left}
                </span>
                <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="flex-1 text-sm px-3 py-1.5 rounded bg-muted">
                  {result.rightItems[i]}
                </span>
              </div>
            ))}
          </div>

          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
              Zobrazit JSON výstup
            </summary>
            <pre className="mt-2 p-3 bg-muted rounded-lg overflow-x-auto text-[11px]">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
};

export default MatchingGenerator;
