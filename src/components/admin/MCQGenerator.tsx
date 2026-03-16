import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface McqResult {
  question: string;
  options: string[];
  correctIndex: number;
}

const MCQGenerator = () => {
  const [topic, setTopic] = useState("");
  const [keywordsStr, setKeywordsStr] = useState("");
  const [difficulty, setDifficulty] = useState<string>("střední");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<McqResult | null>(null);

  const handleGenerate = async () => {
    const keywords = keywordsStr.split(",").map((k) => k.trim()).filter(Boolean);
    if (!topic.trim() || keywords.length === 0) {
      toast({ title: "Chyba", description: "Vyplňte téma a alespoň 1 klíčové slovo.", variant: "destructive" });
      return;
    }

    setGenerating(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("generate-mcq", {
        body: { topic: topic.trim(), keywords, difficulty },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.question) {
        setResult(data);
        toast({ title: "Otázka vygenerována" });
      }
    } catch (e: any) {
      console.error("MCQ generation error:", e);
      toast({ title: "Chyba generování", description: e.message || "Nepodařilo se vygenerovat otázku.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3 p-4 border border-border rounded-lg bg-muted/30">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Generátor MCQ otázky (AI)
        </h3>
        <p className="text-xs text-muted-foreground">
          Zadejte téma, klíčová slova a obtížnost – AI vytvoří otázku s výběrem odpovědí.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Téma</Label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="např. Salmonela" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Klíčová slova (čárkou)</Label>
            <Input value={keywordsStr} onChange={(e) => setKeywordsStr(e.target.value)} placeholder="potraviny, teplota, symptomy" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Obtížnost</Label>
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="snadná">Snadná</SelectItem>
                <SelectItem value="střední">Střední</SelectItem>
                <SelectItem value="těžká">Těžká</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={handleGenerate} disabled={generating} className="w-full">
          {generating ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generuji otázku…</>
          ) : (
            <><Sparkles className="w-4 h-4 mr-2" />Vygenerovat MCQ</>
          )}
        </Button>
      </div>

      {result && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Vygenerovaná otázka</h3>
            <Button size="sm" variant="outline" onClick={() => setResult(null)}>Nová otázka</Button>
          </div>

          <div className="p-4 border border-border rounded-lg bg-background space-y-3">
            <p className="font-medium text-sm">{result.question}</p>
            <div className="space-y-2">
              {result.options.map((opt, i) => {
                const isCorrect = i === result.correctIndex;
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm ${
                      isCorrect
                        ? "border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950/30"
                        : "border-border bg-muted/20"
                    }`}
                  >
                    {isCorrect ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                    )}
                    <span className={isCorrect ? "font-medium" : ""}>{opt}</span>
                    {isCorrect && (
                      <Badge className="ml-auto text-[10px] bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        Správná
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
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

export default MCQGenerator;
