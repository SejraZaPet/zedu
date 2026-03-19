import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Video, Clock, CheckCircle2, Plus, Trash2, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Checkpoint {
  timeSec: number;
  question: string;
  options: string[];
  correctIndex: number;
}

interface VideoCheckpointResult {
  videoUrl: string;
  checkpoints: Checkpoint[];
}

const VideoCheckpointGenerator = () => {
  const [videoUrl, setVideoUrl] = useState("");
  const [topic, setTopic] = useState("");
  const [manualCheckpoints, setManualCheckpoints] = useState<{ timeSec: string; question: string }[]>([]);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<VideoCheckpointResult | null>(null);

  const addManualCheckpoint = () => {
    setManualCheckpoints((prev) => [...prev, { timeSec: "", question: "" }]);
  };

  const removeManualCheckpoint = (index: number) => {
    setManualCheckpoints((prev) => prev.filter((_, i) => i !== index));
  };

  const updateManualCheckpoint = (index: number, field: "timeSec" | "question", value: string) => {
    setManualCheckpoints((prev) => prev.map((cp, i) => (i === index ? { ...cp, [field]: value } : cp)));
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleGenerate = async () => {
    if (!videoUrl.trim()) {
      toast({ title: "Chyba", description: "Zadejte URL videa.", variant: "destructive" });
      return;
    }

    setGenerating(true);
    setResult(null);

    try {
      const checkpoints = manualCheckpoints
        .filter((cp) => cp.timeSec)
        .map((cp) => ({
          timeSec: parseInt(cp.timeSec, 10),
          question: cp.question || "",
          options: [],
          correctIndex: 0,
        }));

      const { data, error } = await supabase.functions.invoke("generate-video-checkpoints", {
        body: {
          videoUrl: videoUrl.trim(),
          topic: topic.trim() || undefined,
          checkpoints: checkpoints.length > 0 ? checkpoints : undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.checkpoints) {
        setResult(data);
        toast({ title: "Checkpointy vygenerovány", description: `${data.checkpoints.length} kontrolních bodů.` });
      }
    } catch (e: any) {
      console.error("Video checkpoint generation error:", e);
      toast({ title: "Chyba generování", description: e.message || "Nepodařilo se vygenerovat checkpointy.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3 p-4 border border-border rounded-lg bg-muted/30">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Video className="w-4 h-4 text-primary" />
          Generátor interaktivního videa (AI)
        </h3>
        <p className="text-xs text-muted-foreground">
          Zadejte URL videa a volitelně téma nebo vlastní časové body – AI vytvoří kontrolní otázky.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">URL videa *</Label>
            <Input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://youtu.be/..."
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Téma (volitelné)</Label>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="např. Alimentární nákazy"
              className="mt-1"
            />
          </div>
        </div>

        {/* Manual checkpoints */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Vlastní časové body (volitelné)</Label>
            <Button type="button" size="sm" variant="outline" onClick={addManualCheckpoint}>
              <Plus className="w-3 h-3 mr-1" /> Přidat bod
            </Button>
          </div>
          {manualCheckpoints.map((cp, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={cp.timeSec}
                onChange={(e) => updateManualCheckpoint(i, "timeSec", e.target.value)}
                placeholder="Čas (s)"
                className="w-24"
                type="number"
              />
              <Input
                value={cp.question}
                onChange={(e) => updateManualCheckpoint(i, "question", e.target.value)}
                placeholder="Otázka (volitelné – AI doplní)"
                className="flex-1"
              />
              <Button type="button" size="icon" variant="ghost" onClick={() => removeManualCheckpoint(i)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>

        <Button onClick={handleGenerate} disabled={generating} className="w-full">
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generuji checkpointy…
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Vygenerovat checkpointy
            </>
          )}
        </Button>
      </div>

      {/* Result */}
      {result && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">
              Interaktivní video ({result.checkpoints.length} checkpointů)
            </h3>
            <Button size="sm" variant="outline" onClick={() => setResult(null)}>
              Nový výstup
            </Button>
          </div>

          <div className="p-3 border border-border rounded-lg bg-muted/20">
            <p className="text-xs text-muted-foreground mb-1">Video URL</p>
            <a href={result.videoUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline break-all">
              {result.videoUrl}
            </a>
          </div>

          <div className="space-y-3">
            {result.checkpoints.map((cp, i) => (
              <div key={i} className="p-3 border border-border rounded-lg bg-background">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary" className="text-[10px]">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatTime(cp.timeSec)}
                  </Badge>
                  <span className="font-medium text-sm">{cp.question}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 ml-4">
                  {cp.options.map((opt, oi) => (
                    <div
                      key={oi}
                      className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-md ${
                        oi === cp.correctIndex
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 font-medium"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {oi === cp.correctIndex && <CheckCircle2 className="w-3 h-3 flex-shrink-0" />}
                      <span>{opt}</span>
                    </div>
                  ))}
                </div>
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

export default VideoCheckpointGenerator;
