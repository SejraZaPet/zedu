import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileDown, FileText, BarChart3, Award, AlertTriangle, Lightbulb, CheckCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { sortParticipants } from "@/lib/session-participants-sort";
import { DEFAULT_SCREEN_NAME_MODE, DEFAULT_EXPORT_NAME_MODE, type ResultNameMode } from "../../../supabase/functions/_shared/session-display-name";

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
    graded?: boolean;
    needsPractice?: boolean;
    distribution?: Array<{ label: string; correct: boolean; count: number }>;
  }>;
  participants?: Array<{ playerId: string; name: string; correct: number; graded: number; successRate: number | null; score: number; avgTimeMs: number | null }>;
  successSummary?: { averageSuccessRate: number | null; needHelpCount: number; ratedCount: number };
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

const barTone = (r: number) => (r >= 70 ? "bg-green-500" : r >= 40 ? "bg-amber-500" : "bg-red-500");
const textTone = (r: number) => (r >= 70 ? "text-green-700 dark:text-green-400" : r >= 40 ? "text-amber-700 dark:text-amber-400" : "text-red-700 dark:text-red-400");
type SortKey = "success" | "name" | "score";

const SessionExports = ({ sessionId, sessionTitle }: Props) => {
  const [anonymization, setAnonymization] = useState<ResultNameMode>(DEFAULT_SCREEN_NAME_MODE);
  const [exportNameMode, setExportNameMode] = useState<ResultNameMode>(DEFAULT_EXPORT_NAME_MODE);
  const [includeAnswerKey, setIncludeAnswerKey] = useState(true);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("success");
  const [openSlide, setOpenSlide] = useState<number | null>(null);
  const sortedParticipants = useMemo(
    () => sortParticipants(report?.participants ?? [], sortKey),
    [report, sortKey],
  );

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
          body: JSON.stringify({ sessionId, anonymizationMode: exportNameMode, includeAnswerKey }),
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

  // Přehled se načte hned po ukončení (a po změně anonymizace / klíče), ne až po kliknutí na Report.
  useEffect(() => {
    void handleLoadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, anonymization, includeAnswerKey]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-4 p-4 border border-border rounded-lg bg-muted/30">
        <div>
          <Label className="text-xs">Jména v přehledu</Label>
          <Select value={anonymization} onValueChange={(value) => setAnonymization(value as ResultNameMode)}>
            <SelectTrigger aria-label="Jména v přehledu" className="w-40 mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nickname">Přezdívky</SelectItem>
              <SelectItem value="named">Se jmény</SelectItem>
              <SelectItem value="pseudonymous">Pseudonymní</SelectItem>
              <SelectItem value="anonymous">Anonymní</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Jména v exportu</Label>
          <Select value={exportNameMode} onValueChange={(value) => setExportNameMode(value as ResultNameMode)}>
            <SelectTrigger aria-label="Jména v exportu" className="w-40 mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nickname">Přezdívky</SelectItem>
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

      {!report && loadingReport && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="w-4 h-4 animate-spin" /> Načítám přehled…
        </p>
      )}
      {report && (report.sessionOverview?.totalResponses ?? 0) === 0 && (
        <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground" role="status">
          Zatím žádné odpovědi.
        </p>
      )}

      {/* Report view */}
      {report && (
        <div className="space-y-4 print:space-y-2" id="session-report">
          {/* Overview */}
          <div className="border border-border rounded-lg p-4">
            <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Přehled session
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: "Účastníci", value: report.sessionOverview.totalParticipants },
                { label: "Slidy", value: report.sessionOverview.totalSlides },
                { label: "Odpovědí", value: report.sessionOverview.totalResponses },
                { label: "Ø skóre", value: report.classStatistics.mean },
                ...(report.successSummary ? [
                  { label: "Ø úspěšnost třídy", value: report.successSummary.averageSuccessRate === null ? "–" : `${report.successSummary.averageSuccessRate} %` },
                  { label: "Potřebuje pomoc (pod 50 %)", value: report.successSummary.needHelpCount },
                ] : []),
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
              {report.perSlideResults.map((s) => {
                const dist = s.distribution ?? [];
                const open = openSlide === s.index;
                return (
                <div key={s.index} className="text-xs">
                  <button type="button" className="flex w-full items-center gap-3 text-left rounded hover:bg-muted/40 p-1 disabled:cursor-default"
                    onClick={() => setOpenSlide(open ? null : s.index)} disabled={!dist.length} aria-expanded={dist.length ? open : undefined}>
                  <span className="w-6 text-right font-mono text-muted-foreground shrink-0">{s.index}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate max-w-[200px]">{s.headline}</span>
                      <Badge variant="outline" className="text-[10px]">{s.type}</Badge>
                      {s.needsPractice && <Badge variant="destructive" className="text-[10px]">Procvičit</Badge>}
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                      <div className={`h-1.5 rounded-full ${barTone(s.successRate)}`} style={{ width: `${s.successRate}%` }} />
                    </div>
                  </div>
                  <span className="text-right shrink-0">
                    <span className={`block font-mono font-bold ${textTone(s.successRate)}`}>{s.graded === false ? "–" : `${s.successRate}%`}</span>
                    <span className="block text-muted-foreground">{s.correctCount} z {s.totalAnswered}</span>
                  </span>
                  <span className="text-muted-foreground w-10 text-right shrink-0">{Math.round(s.avgTimeMs / 1000)}s</span>
                  </button>
                  {open && dist.length > 0 && (
                    <ul className="ml-9 mt-1 mb-2 space-y-1">
                      {dist.map((d, i) => (
                        <li key={i} className={`flex items-center gap-2 ${d.correct ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                          <span className="w-5 text-right font-mono">{d.count}×</span>
                          <span className="min-w-0 flex-1 break-words">{d.label || `Možnost ${i + 1}`}</span>
                          {d.correct && <Badge className="text-[10px]">Správně</Badge>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                );
              })}
            </div>
          </div>

          {/* Participants */}
          {report.participants && (
            <div className="border border-border rounded-lg p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h3 className="font-bold text-sm">Účastníci</h3>
                <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                  <SelectTrigger className="w-40 h-8 text-xs" aria-label="Řadit účastníky"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="success">Podle úspěšnosti</SelectItem>
                    <SelectItem value="name">Podle jména</SelectItem>
                    <SelectItem value="score">Podle skóre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {sortedParticipants.length === 0 ? <p className="text-xs text-muted-foreground">Žádní účastníci.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-muted-foreground">
                      <tr className="text-left">
                        <th className="py-1 pr-2 font-medium">#</th>
                        <th className="py-1 pr-2 font-medium">Jméno</th>
                        <th className="py-1 pr-2 font-medium">Úspěšnost</th>
                        <th className="py-1 pr-2 font-medium whitespace-nowrap">Správně</th>
                        <th className="py-1 pr-2 font-medium text-right">Skóre</th>
                        <th className="py-1 font-medium text-right whitespace-nowrap">Ø čas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedParticipants.map((p, i) => (
                        <tr key={p.playerId} className="border-t border-border">
                          <td className="py-1.5 pr-2 font-mono text-muted-foreground">{i + 1}.</td>
                          <td className="py-1.5 pr-2 font-medium max-w-[9rem] truncate" title={p.name}>{p.name}</td>
                          <td className="py-1.5 pr-2 min-w-[6rem]">
                            {p.successRate === null ? <span className="text-muted-foreground">–</span> : (
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-12 sm:w-20 rounded-full bg-muted shrink-0"><div className={`h-1.5 rounded-full ${barTone(p.successRate)}`} style={{ width: `${p.successRate}%` }} /></div>
                                <span className={`font-mono font-bold ${textTone(p.successRate)}`}>{p.successRate}%</span>
                              </div>
                            )}
                          </td>
                          <td className="py-1.5 pr-2 whitespace-nowrap">{p.graded ? `${p.correct} z ${p.graded}` : "–"}</td>
                          <td className="py-1.5 pr-2 text-right font-mono">{p.score}</td>
                          <td className="py-1.5 text-right whitespace-nowrap">{p.avgTimeMs === null ? "–" : `${(p.avgTimeMs / 1000).toFixed(1)} s`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

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
