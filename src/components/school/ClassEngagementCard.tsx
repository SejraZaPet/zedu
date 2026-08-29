import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, TrendingDown, TrendingUp, Minus, BarChart3, Info } from "lucide-react";

export interface EngagementStudent {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  last_sign_in_at: string | null;
  days_since_signin: number | null;
  assigned_total: number;
  submitted_total: number;
  missed_total: number;
  completion_rate: number | null;
  avg_recent: number | null;
  avg_previous: number | null;
  grade_trend: "up" | "down" | "stable" | "unknown";
  activities_30d: number;
  lessons_30d: number;
  recognitions_30d: number;
  attention_reasons: string[];
  strength_reasons: string[];
}

const REASON_LABELS: Record<string, string> = {
  grades_down: "Klesající výsledky (−10 b. a více)",
  low_completion: "Plnění úkolů pod 50 %",
  missed_assignments: "3 a více nesplněných úkolů po termínu",
  long_inactivity: "Bez přihlášení 14+ dní",
  grades_up: "Zlepšující se výsledky (+10 b. a více)",
  high_completion: "Plnění úkolů 90 % a více",
  high_activity: "Vysoká aktivita v platformě",
  high_score: "Průměr 85 % a více",
};

const TrendIcon = ({ trend }: { trend: EngagementStudent["grade_trend"] }) => {
  if (trend === "up") return <TrendingUp className="w-4 h-4 text-emerald-600" />;
  if (trend === "down") return <TrendingDown className="w-4 h-4 text-destructive" />;
  if (trend === "stable") return <Minus className="w-4 h-4 text-muted-foreground" />;
  return <span className="text-xs text-muted-foreground">—</span>;
};

const fullName = (s: EngagementStudent) =>
  [s.first_name, s.last_name].filter(Boolean).join(" ") || s.email || "Žák";

const ClassEngagementCard = ({ classId, className }: { classId: string; className?: string }) => {
  const [students, setStudents] = useState<EngagementStudent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("class_engagement_stats", { _class_id: classId });
      if (cancelled) return;
      if (error) setError(error.message);
      else setStudents((((data as any)?.students ?? []) as EngagementStudent[]));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [classId]);

  const attention = (students ?? []).filter((s) => s.attention_reasons.length > 0);
  const strengths = (students ?? []).filter((s) => s.strength_reasons.length > 0 && s.attention_reasons.length === 0);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" /> Akademické zapojení třídy
        </CardTitle>
        <CardDescription className="flex items-start gap-2">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          Neutrální statistický přehled z dat platformy (odevzdané úkoly, výsledky, přihlášení). Nejde o diagnózu ani
          hodnocení osobnosti žáka. Vidíte ho jen vy jako učitel této třídy a správa školy.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Načítám statistiky…
          </div>
        )}
        {error && <p className="text-sm text-destructive">Statistiky se nepodařilo načíst: {error}</p>}

        {!loading && !error && students && students.length === 0 && (
          <p className="text-sm text-muted-foreground">Ve třídě nejsou žádní žáci.</p>
        )}

        {!loading && !error && students && students.length > 0 && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium mb-2">Upozornění na zapojení ({attention.length})</p>
                {attention.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Žádný žák nesplňuje kritéria upozornění.</p>
                ) : (
                  <ul className="space-y-2">
                    {attention.map((s) => (
                      <li key={s.id} className="text-sm">
                        <span className="font-medium">{fullName(s)}</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {s.attention_reasons.map((r) => (
                            <Badge key={r} variant="outline" className="text-[11px] border-destructive/40">
                              {REASON_LABELS[r] ?? r}
                            </Badge>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium mb-2">Nejlepší zapojení ({strengths.length})</p>
                {strengths.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Zatím není dost dat.</p>
                ) : (
                  <ul className="space-y-2">
                    {strengths.map((s) => (
                      <li key={s.id} className="text-sm">
                        <span className="font-medium">{fullName(s)}</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {s.strength_reasons.map((r) => (
                            <Badge key={r} variant="outline" className="text-[11px] border-emerald-500/40">
                              {REASON_LABELS[r] ?? r}
                            </Badge>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div>
              <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
                {showAll ? "Skrýt tabulku všech žáků" : "Zobrazit tabulku všech žáků"}
              </Button>
              {showAll && (
                <div className="mt-2 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Žák</TableHead>
                        <TableHead className="text-right">Odevzdáno</TableHead>
                        <TableHead className="text-right">Po termínu</TableHead>
                        <TableHead className="text-right">Plnění</TableHead>
                        <TableHead className="text-right">Průměr 30 d</TableHead>
                        <TableHead className="text-center">Trend</TableHead>
                        <TableHead className="text-right">Aktivity 30 d</TableHead>
                        <TableHead className="text-right">Poslední přihlášení</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{fullName(s)}</TableCell>
                          <TableCell className="text-right">
                            {s.submitted_total} / {s.assigned_total}
                          </TableCell>
                          <TableCell className="text-right">{s.missed_total}</TableCell>
                          <TableCell className="text-right">
                            {s.completion_rate === null ? "—" : `${s.completion_rate} %`}
                          </TableCell>
                          <TableCell className="text-right">
                            {s.avg_recent === null ? "—" : `${s.avg_recent} %`}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center">
                              <TrendIcon trend={s.grade_trend} />
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{s.activities_30d + s.lessons_30d}</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {s.last_sign_in_at
                              ? `${new Date(s.last_sign_in_at).toLocaleDateString("cs-CZ")} (${s.days_since_signin} d)`
                              : "nikdy"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ClassEngagementCard;
