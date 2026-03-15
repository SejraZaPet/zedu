import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileDown, FileText, BarChart3, Award, AlertTriangle, Lightbulb, CheckCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  sessionId: string;
  sessionTitle: string;
}

interface Report {
  sessionOverview: {
    title: string;
    date: string;
    totalSlides: number;
    totalParticipants: number;
    totalResponses: number;
    averageScore: number;
  };
  participationSummary: {
    maxPossibleResponses: number;
    actualResponses: number;
    participationRate: number;
  };
  perSlideResults: Array<{
    index: number;
    type: string;
    headline: string;
    totalAnswered: number;
    correctCount: number;
    successRate: number;
    avgTimeMs: number;
    commonMistakes: Array<{ answer: any; count: number }>;
  }>;
  classStatistics: { mean: number; median: number; min: number; max: number };
  commonMistakes: Array<{
    slide: number;
    headline: string;
    successRate: number;
    mistakes: Array<{ answer: any; count: number }>;
  }>;
  recommendations: string[];
  answerKey?: Array<{ slide: number; headline: string; correctAnswer: string }>;
}

const SessionExports = ({ sessionId, sessionTitle }: Props) => {
  const [anonymization, setAnonymization] = useState("pseudonymous");
  const [includeAnswerKey, setIncludeAnswerKey] = useState(true);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [report, setReport] = useState<Report | null>(null);

  const handleCsvExport = async () => {
    setExportingCsv(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-session-csv`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ sessionId, anonymizationMode: anonymization, includeAnswerKey }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Export selhal");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${sessionTitle.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "CSV exportováno" });
    } catch (e: any) {
      toast({ title: "Chyba exportu", description: e.message, variant: "destructive" });
    } finally {
      setExportingCsv(false);
    }
  };

  const handleLoadReport = async () => {
    setLoadingReport(true);
    try {
      const { data, error } = await supabase.functions.invoke("export-session-report", {
        body: { sessionId, anonymizationMode: anonymization, includeAnswerKey },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setReport(data as Report);
    } catch (e: any) {
      toast({ title: "Chyba", description: e.message, variant: "destructive" });
    } finally {
      setLoadingReport(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-4 p-4 border border-border rounded-lg bg-muted/30">
        <div>
          <Label className="text-xs">Anonymizace</Label>
          <Select value={anonymization} onValueChange={setAnonymization}>
            <SelectTrigger className="w-40 mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="named">Se jmény</SelectItem>
              <SelectItem value="pseudonymous">Pseudonymní</SelectItem>
              <SelectItem value="anonymous">Anonymní</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={includeAnswerKey} onCheckedChange={setIncludeAnswerKey} id="answer-key" />
          <Label htmlFor="answer-key" className="text-xs">Klíč odpovědí</Label>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleCsvExport} disabled={exportingCsv}>
            {exportingCsv ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileDown className="w-4 h-4 mr-1" />}
            CSV
          </Button>
          <Button size="sm" onClick={handleLoadReport} disabled={loadingReport}>
            {loadingReport ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileText className="w-4 h-4 mr-1" />}
            Report
          </Button>
        </div>
      </div>

      {/* Report view */}
      {report && (
        <div className="space-y-4 print:space-y-2" id="session-report">
          {/* Overview */}
          <div className="border border-border rounded-lg p-4">
            <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Přehled session
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Účastníci", value: report.sessionOverview.totalParticipants },
                { label: "Slidy", value: report.sessionOverview.totalSlides },
                { label: "Odpovědí", value: report.sessionOverview.totalResponses },
                { label: "Ø skóre", value: report.classStatistics.mean },
              ].map((item) => (
                <div key={item.label} className="text-center p-2 bg-muted/30 rounded">
                  <div className="text-lg font-bold">{item.value}</div>
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Zapojení: {report.participationSummary.participationRate}% ·
              Min: {report.classStatistics.min} · Medián: {report.classStatistics.median} · Max: {report.classStatistics.max}
            </div>
          </div>

          {/* Per-slide results */}
          <div className="border border-border rounded-lg p-4">
            <h3 className="font-bold text-sm mb-2">Výsledky per slide</h3>
            <div className="space-y-2">
              {report.perSlideResults.map((s) => (
                <div key={s.index} className="flex items-center gap-3 text-xs">
                  <span className="w-6 text-right font-mono text-muted-foreground">{s.index}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate max-w-[200px]">{s.headline}</span>
                      <Badge variant="outline" className="text-[10px]">{s.type}</Badge>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                      <div
                        className={`h-1.5 rounded-full ${s.successRate >= 70 ? "bg-green-500" : s.successRate >= 40 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${s.successRate}%` }}
                      />
                    </div>
                  </div>
                  <span className={`font-mono font-bold ${s.successRate >= 70 ? "text-green-600" : s.successRate >= 40 ? "text-amber-600" : "text-red-600"}`}>
                    {s.successRate}%
                  </span>
                  <span className="text-muted-foreground w-16 text-right">{Math.round(s.avgTimeMs / 1000)}s</span>
                </div>
              ))}
            </div>
          </div>

          {/* Common mistakes */}
          {report.commonMistakes.length > 0 && (
            <div className="border border-border rounded-lg p-4">
              <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> Nejčastější chyby
              </h3>
              <div className="space-y-2">
                {report.commonMistakes.map((item) => (
                  <div key={item.slide} className="text-xs">
                    <span className="font-medium">Slide {item.slide}</span>
                    <span className="text-muted-foreground"> · {item.headline} ({item.successRate}%)</span>
                    <div className="ml-4 mt-1 space-y-0.5">
                      {item.mistakes.map((m, i) => (
                        <div key={i} className="text-muted-foreground">
                          ✗ {typeof m.answer === "string" ? m.answer : JSON.stringify(m.answer)} ({m.count}×)
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Recommendations */}
          {report.recommendations.length > 0 && (
            <div className="border border-border rounded-lg p-4 bg-primary/5">
              <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-primary" /> Doporučení
              </h3>
              <ul className="space-y-1">
                {report.recommendations.map((r, i) => (
                  <li key={i} className="text-xs flex items-start gap-2">
                    <CheckCircle className="w-3 h-3 mt-0.5 text-primary flex-shrink-0" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Answer key */}
          {report.answerKey && (
            <div className="border border-border rounded-lg p-4">
              <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
                <Award className="w-4 h-4" /> Klíč odpovědí
              </h3>
              <div className="space-y-1">
                {report.answerKey.map((a) => (
                  <div key={a.slide} className="text-xs flex gap-2">
                    <span className="font-mono text-muted-foreground w-6 text-right">{a.slide}</span>
                    <span className="font-medium">{a.headline}</span>
                    <span className="text-muted-foreground">→ {a.correctAnswer}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SessionExports;
