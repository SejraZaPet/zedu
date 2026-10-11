import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, LineChart, FilePlus2, Gamepad2 } from "lucide-react";
import { QuickGameDialog } from "@/components/game/QuickGameDialog";
import { weakSpotGameTopic } from "@/lib/assignment-difficulty";
import { toast } from "@/hooks/use-toast";
import { emptyWorksheetSpec } from "@/lib/worksheet-defaults";
import { createWorksheetForTopic } from "@/lib/assignment-difficulty";
import AssignmentDifficultyTrend from "@/components/admin/AssignmentDifficultyTrend";
import { fetchLessonActivities, type LessonActivityInfo } from "@/lib/lesson-activity-index";
import { resultRatio } from "@/lib/best-results";
import { splitStrengthsWeaknesses, summarizePerformance, type StrengthWeaknessRow } from "@/lib/strengths-weaknesses";

interface Props {
  assignmentId: string;
  lessonId?: string | null;
  lessonSource?: string | null;
  worksheetId?: string | null;
  /** Žáci, kteří mají úlohu zadanou – pro filtrování výsledků aktivit. */
  studentIds: string[];
}

interface DifficultyRow extends StrengthWeaknessRow {
  key: string;
  label: string;
  /** Úspěšnost 0–100, null = nelze vyhodnotit automaticky. */
  pct: number | null;
  sampleCount: number;
  /** Index aktivity v lekci (jen u řádků z lekce) – vstup pro trend. */
  activityIndex?: number;
}

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

const CHOICE_LETTERS = "ABCDEFGHIJKLMNOP";

/** Klíč u přiřazování bývá ve tvaru „vlevo=vpravo“ – žák ukládá jen pravou stranu. */
const rightSide = (s: string) => {
  const i = s.indexOf("=");
  return i >= 0 ? s.slice(i + 1) : s;
};

/** Best-effort porovnání odpovědi žáka se správnou odpovědí podle typu položky. */
export const isWorksheetAnswerCorrect = (item: any, answer: unknown, correct: string | string[]): boolean => {
  const type = String(item?.type ?? "");
  if (answer === undefined || answer === null || answer === "") return false;
  switch (type) {
    case "matching": {
      if (!Array.isArray(correct) || !Array.isArray(answer)) return false;
      return correct.length === answer.length
        && correct.every((c, i) => norm(rightSide(String(c))) === norm(answer[i]));
    }
    case "ordering": {
      if (!Array.isArray(correct) || !Array.isArray(answer)) return false;
      const orderItems: string[] = Array.isArray(item?.orderItems) ? item.orderItems : [];
      // Žák do pracovního listu zapisuje čísla pořadí k jednotlivým položkám.
      const numeric = answer.every((v) => /^\d+$/.test(String(v).trim()));
      if (numeric && orderItems.length === answer.length) {
        return orderItems.every((label, i) => {
          const expected = correct.findIndex((c) => norm(c) === norm(label)) + 1;
          return expected > 0 && Number(String(answer[i]).trim()) === expected;
        });
      }
      return correct.length === answer.length && correct.every((c, i) => norm(c) === norm(answer[i]));
    }
    case "mcq": {
      const ca = Array.isArray(correct) ? String(correct[0] ?? "") : String(correct);
      const given = String(answer).trim();
      if (norm(given) === norm(ca)) return true;
      // Žák ukládá písmeno možnosti, klíč bývá plný text odpovědi (nebo naopak).
      const choices: string[] = Array.isArray(item?.choices) ? item.choices : [];
      const letterIdx = given.length === 1 ? CHOICE_LETTERS.indexOf(given.toUpperCase()) : -1;
      if (letterIdx >= 0 && choices[letterIdx] !== undefined) {
        if (norm(choices[letterIdx]) === norm(ca)) return true;
        if (CHOICE_LETTERS[letterIdx] === ca.trim().toUpperCase()) return true;
      }
      const caIdx = choices.findIndex((c) => norm(c) === norm(ca));
      return caIdx >= 0 && given.toUpperCase() === CHOICE_LETTERS[caIdx];
    }
    case "sorting": {
      if (!Array.isArray(correct) || !Array.isArray(answer)) return false;
      const a = [...correct].map(norm).sort();
      const b = [...answer].map(norm).sort();
      return a.length === b.length && a.every((v, i) => v === b[i]);
    }
    case "fill_blank": {
      if (Array.isArray(correct)) {
        const blanks = Array.isArray(answer) ? answer : [answer];
        return correct.every((c, i) => norm(blanks[i]) === norm(c));
      }
      return norm(answer) === norm(correct);
    }
    default:
      if (Array.isArray(correct)) return correct.some((c) => norm(c) === norm(answer));
      return norm(answer) === norm(correct);
  }
};

/** Typy, které nelze automaticky vyhodnotit. */
export const MANUAL_WORKSHEET_TYPES = new Set(["open_answer", "short_answer", "offline_activity"]);

/** Typy s automaticky vyhodnotitelnou odpovědí – ostatní (layout) do statistiky nepatří. */
export const SCORABLE_WORKSHEET_TYPES = new Set([
  "mcq",
  "true_false",
  "fill_blank",
  "matching",
  "ordering",
  "sorting",
  "image_label",
]);

const barColor = (pct: number) =>
  pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-destructive";

const truncate = (s: string, n = 110) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/**
 * Žebříček obtížnosti – aktivity lekce nebo otázky pracovního listu
 * seřazené od nejnižší úspěšnosti napříč všemi žáky úlohy.
 */
const AssignmentDifficultyStats = ({
  assignmentId,
  lessonId,
  lessonSource,
  worksheetId,
  studentIds,
}: Props) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<DifficultyRow[]>([]);
  const [manualRows, setManualRows] = useState<DifficultyRow[]>([]);
  /** Kolik úkolů zadává stejnou lekci – trend má smysl až od dvou. */
  const [sameLessonCount, setSameLessonCount] = useState(0);
  const [trendRow, setTrendRow] = useState<DifficultyRow | null>(null);
  const [subjectName, setSubjectName] = useState("");
  const [classYear, setClassYear] = useState<number | null>(null);
  const [worksheetBusyKey, setWorksheetBusyKey] = useState<string | null>(null);
  const [gameTopic, setGameTopic] = useState<string | null>(null);

  // Kontext úlohy (předmět, ročník třídy) a počet úkolů se stejnou lekcí.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("assignments")
        .select("subject_id, class_id, subjects(name), classes(year)")
        .eq("id", assignmentId)
        .maybeSingle();
      const row = data as any;
      if (!cancelled) {
        setSubjectName(row?.subjects?.name ?? "");
        setClassYear(typeof row?.classes?.year === "number" ? row.classes.year : null);
      }
      if (lessonId) {
        const { count } = await supabase
          .from("assignments")
          .select("id", { count: "exact", head: true })
          .eq("lesson_id", lessonId);
        if (!cancelled) setSameLessonCount(count ?? 0);
      } else if (!cancelled) {
        setSameLessonCount(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assignmentId, lessonId]);

  /** Vytvoří pracovní list zaměřený na slabé místo a otevře AI generování. */
  const generateSupportWorksheet = async (row: DifficultyRow) => {
    setWorksheetBusyKey(row.key);
    try {
      const topic = row.label.replace(/\s*\(povinné\)$/, "").trim() || "Opakování";
      const id = await createWorksheetForTopic(
        topic,
        subjectName,
        emptyWorksheetSpec({ title: topic, subject: subjectName }),
      );
      const params = new URLSearchParams({ topic });
      if (classYear !== null) params.set("topic_rocnik", String(classYear));
      if (subjectName) params.set("topic_subject", subjectName);
      params.set("focus", topic);
      navigate(`/ucitel/pracovni-listy/${id}?${params.toString()}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Nepodařilo se otevřít generování", description: msg, variant: "destructive" });
    } finally {
      setWorksheetBusyKey(null);
    }
  };


  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const scored: DifficultyRow[] = [];
      const manual: DifficultyRow[] = [];

      try {
        if (lessonId) {
          const activities: LessonActivityInfo[] = await fetchLessonActivities(lessonId, lessonSource);
          let query = supabase
            .from("student_activity_results")
            .select("user_id, activity_index, score, max_score, completed_at")
            .eq("lesson_id", lessonId);
          if (studentIds.length > 0) query = query.in("user_id", studentIds);
          const { data } = await query;

          const resultRows = ((data as any[]) || []);
          const profileIds = [...new Set(resultRows.map((row) => row.user_id))];
          const { data: profiles } = profileIds.length
            ? await supabase.from("profiles").select("id, first_name, last_name").in("id", profileIds)
            : { data: [] as any[] };
          const names = new Map(((profiles ?? []) as any[]).map((profile) => [profile.id, `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim()]));

          for (const act of activities) {
            const activityRows = resultRows.filter((row) => row.activity_index === act.index);
            const learners = [...new Set(activityRows.map((row) => row.user_id))].map((userId) => ({
              learnerId: userId,
              learnerName: names.get(userId) || "Žák",
              attempts: activityRows.filter((row) => row.user_id === userId).map((row) => ({
                correctRatio: resultRatio(row) ?? 0,
                order: new Date(row.completed_at ?? 0).getTime(),
                completedAt: row.completed_at,
              })),
            }));
            const summary = summarizePerformance({ key: `a-${act.index}`, label: `${act.title}${act.required ? " (povinné)" : ""}` }, learners);
            scored.push({
              key: `a-${act.index}`,
              label: `${act.title}${act.required ? " (povinné)" : ""}`,
              pct: summary.firstPct,
              sampleCount: summary.learnerCount,
              activityIndex: act.index,
              ...summary,
            });
          }
        }

        if (worksheetId) {
          const [wsRes, attRes] = await Promise.all([
            supabase.from("worksheets").select("spec").eq("id", worksheetId).maybeSingle(),
            supabase
              .from("assignment_attempts" as any)
              .select("student_id, answers, attempt_number, status, submitted_at")
              .eq("assignment_id", assignmentId),
          ]);

          const spec = (wsRes.data as any)?.spec;
          const variants: any[] = Array.isArray(spec?.variants) ? spec.variants : [];
          const attempts = ((attRes.data as any[]) || []).filter((attempt) => attempt.status === "submitted");
          const attemptProfileIds = [...new Set(attempts.map((attempt) => attempt.student_id))];
          const { data: attemptProfiles } = attemptProfileIds.length
            ? await supabase.from("profiles").select("id, first_name, last_name").in("id", attemptProfileIds)
            : { data: [] as any[] };
          const attemptNames = new Map(((attemptProfiles ?? []) as any[]).map((profile) => [profile.id, `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim()]));

          for (const variant of variants) {
            const keys: any[] = spec?.answerKeys?.[variant.variantId] ?? [];
            const itemMap = new Map<string, any>((variant.items ?? []).map((it: any) => [it.id, it]));
            for (const key of keys) {
              const item = itemMap.get(key.itemId);
              if (!item) continue;
              const label = truncate(String(item.prompt || `Úloha ${item.itemNumber ?? ""}`));
               if (MANUAL_WORKSHEET_TYPES.has(item.type)) {
                manual.push({ key: `w-${variant.variantId}-${key.itemId}`, label, pct: null, sampleCount: 0, learnerCount: 0, firstPct: null, bestPct: null, repeaters: 0, averageAttempts: 0, failedLearners: [], category: "other" });
                continue;
              }
              // Layoutové bloky (zápis, nadpisy, boxy) nemají odpověď – vynecháme je.
               if (!SCORABLE_WORKSHEET_TYPES.has(item.type)) continue;
              const learners = [...new Set(attempts.map((attempt) => attempt.student_id))].flatMap((studentId) => {
                const studentAttempts = attempts.filter((attempt) => attempt.student_id === studentId && key.itemId in (attempt.answers ?? {}));
                if (!studentAttempts.length) return [];
                return [{
                  learnerId: studentId,
                  learnerName: attemptNames.get(studentId) || "Žák",
                  attempts: studentAttempts.map((attempt) => ({
                     correctRatio: isWorksheetAnswerCorrect(item, attempt.answers[key.itemId], key.correctAnswer) ? 1 : 0,
                    order: Number(attempt.attempt_number) || 0,
                    completedAt: attempt.submitted_at,
                  })),
                }];
              });
              const summary = summarizePerformance({ key: `w-${variant.variantId}-${key.itemId}`, label }, learners);
              scored.push({
                key: `w-${variant.variantId}-${key.itemId}`,
                label,
                pct: summary.firstPct,
                sampleCount: summary.learnerCount,
                ...summary,
              });
            }
          }
        }
      } finally {
        if (!cancelled) {
          setRows(scored);
          setManualRows(manual);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assignmentId, lessonId, lessonSource, worksheetId, studentIds.join(",")]);

  const split = useMemo(() => {
    const grouped = splitStrengthsWeaknesses(rows);
    return {
      strong: grouped.strong as DifficultyRow[],
      weak: grouped.weak as DifficultyRow[],
      other: grouped.other as DifficultyRow[],
    };
  }, [rows]);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

   if (rows.length === 0 && manualRows.length === 0) {
     return <p className="text-sm text-muted-foreground">Pro tuto úlohu nejsou data pro silné a slabé stránky.</p>;
  }

  return (
    <div className="space-y-3">
      {([...[{ title: "Silné stránky", rows: split.strong }, { title: "Slabé stránky", rows: split.weak }]] as const).map((section) => section.rows.length > 0 && (
        <div key={section.title} className="space-y-2">
          <h4 className="text-sm font-semibold">{section.title}</h4>
          <ul className="space-y-2">
          {section.rows.map((r) => (
            <li key={r.key} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 flex-1 truncate">{r.label}</span>
                {r.pct === null ? (
                  <Badge variant="outline" className="text-[10px]">Bez odpovědí</Badge>
                ) : (
                  <span className="shrink-0 font-medium">
                     první {r.firstPct}% · nejlepší {r.bestPct}% <span className="text-muted-foreground">({r.sampleCount} žáků)</span>
                  </span>
                )}
              </div>
              {r.pct !== null && (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className={`h-full ${barColor(r.pct)}`} style={{ width: `${r.pct}%` }} />
                </div>
              )}
              <div className="flex flex-wrap gap-1">
                 <span className="text-[11px] text-muted-foreground">Opakovalo {r.repeaters} · průměr {r.averageAttempts} pokusu</span>
                {typeof r.activityIndex === "number" && sameLessonCount > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 gap-1 px-1.5 text-[11px]"
                    onClick={() => setTrendRow(r)}
                  >
                    <LineChart className="h-3 w-3" /> Zobrazit trend
                  </Button>
                )}
                {r.pct !== null && r.pct < 50 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 gap-1 px-1.5 text-[11px]"
                    onClick={() => generateSupportWorksheet(r)}
                    disabled={worksheetBusyKey === r.key}
                  >
                    {worksheetBusyKey === r.key ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <FilePlus2 className="h-3 w-3" />
                    )}
                    Vygenerovat doplňkový list
                  </Button>
                )}
                {r.pct !== null && r.pct < 50 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 gap-1 px-1.5 text-[11px]"
                    onClick={() => setGameTopic(weakSpotGameTopic(r.label.replace(/\s*\(povinné\)$/, ""), r.pct))}
                  >
                    <Gamepad2 className="h-3 w-3" /> Vytvořit hru na tohle
                  </Button>
                )}
              </div>
               {r.category === "weak" && r.failedLearners.length > 0 && (
                 <p className="text-[11px] text-destructive">Pod 50 % i v nejlepším pokusu: {r.failedLearners.join(", ")}</p>
               )}
            </li>
          ))}
          </ul>
        </div>
      ))}

      {split.other.length > 0 && (
        <details className="rounded-md border border-border p-2">
          <summary className="cursor-pointer text-sm font-medium">Ostatní ({split.other.length})</summary>
          <ul className="mt-2 space-y-1">{split.other.map((row) => <li key={row.key} className="text-xs">{row.label} · první {row.firstPct ?? "—"}% · nejlepší {row.bestPct ?? "—"}%</li>)}</ul>
        </details>
      )}

      {trendRow && lessonId && typeof trendRow.activityIndex === "number" && (
        <AssignmentDifficultyTrend
          open
          onOpenChange={(o) => !o && setTrendRow(null)}
          lessonId={lessonId}
          activityIndex={trendRow.activityIndex}
          activityTitle={trendRow.label}
        />
      )}

      <QuickGameDialog
        open={gameTopic !== null}
        onOpenChange={(o) => !o && setGameTopic(null)}
        onSaved={() => setGameTopic(null)}
        initialTopic={gameTopic ?? undefined}
        initialType="mcq"
        initialSubject={subjectName || undefined}
      />

      {manualRows.length > 0 && (
        <div className="space-y-1 rounded-md border border-border bg-muted/20 p-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Vyžaduje ruční kontrolu
          </p>
          <ul className="space-y-0.5">
            {manualRows.map((r) => (
              <li key={r.key} className="truncate text-xs text-muted-foreground">{r.label}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default AssignmentDifficultyStats;
