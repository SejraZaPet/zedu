import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AiContentBadge from "@/components/ai/AiContentBadge";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Cluster {
  label: string;
  summary: string;
  count: number;
  examples?: string[];
}

interface Props {
  texts: string[];
  question?: string;
  label?: string;
}

/** Tlačítko pro AI shlukování otevřených odpovědí (Zeď, slovní mrak). */
const AiClusterButton = ({ texts, question, label = "AI shrnutí odpovědí" }: Props) => {
  const [loading, setLoading] = useState(false);
  const [clusters, setClusters] = useState<Cluster[] | null>(null);
  const [outliers, setOutliers] = useState<string[]>([]);

  const run = async () => {
    if (texts.length < 2) {
      toast({
        title: "Málo odpovědí",
        description: "Pro shrnutí potřebujete alespoň 2 odpovědi žáků.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("cluster-open-responses", {
      body: { texts, question },
    });
    setLoading(false);
    if (error) {
      toast({
        title: "Shrnutí se nepodařilo",
        description: error.message ?? "Zkuste to prosím znovu.",
        variant: "destructive",
      });
      return;
    }
    if ((data as any)?.error) {
      toast({ title: "Shrnutí se nepodařilo", description: (data as any).error, variant: "destructive" });
      return;
    }
    setClusters(((data as any)?.clusters ?? []) as Cluster[]);
    setOutliers(((data as any)?.outliers ?? []) as string[]);
  };

  return (
    <div className="space-y-2">
      <Button size="sm" variant="outline" onClick={run} disabled={loading} className="gap-1.5">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {loading ? "Shlukuji odpovědi…" : label}
      </Button>

      {clusters && (
        <div className="space-y-2 border border-border rounded-md p-3 bg-muted/30">
          <AiContentBadge aiGenerated />
          {clusters.length === 0 ? (
            <p className="text-xs text-muted-foreground">AI nenašla žádné skupiny.</p>
          ) : (
            clusters.map((c, i) => (
              <div key={i} className="text-sm bg-card border border-border rounded p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{c.label}</span>
                  <Badge variant="secondary" className="text-[10px]">{c.count}×</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{c.summary}</p>
                {c.examples && c.examples.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {c.examples.map((e, j) => (
                      <li key={j} className="text-[11px] text-muted-foreground italic">„{e}“</li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          )}
          {outliers.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Mimo skupiny: {outliers.map((o) => `„${o}“`).join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default AiClusterButton;
