import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, LineChart, FilePlus2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { emptyWorksheetSpec } from "@/lib/worksheet-defaults";
import { createWorksheetForTopic } from "@/lib/assignment-difficulty";
import AssignmentDifficultyTrend from "@/components/admin/AssignmentDifficultyTrend";
import { fetchLessonActivities, type LessonActivityInfo } from "@/lib/lesson-activity-index";

interface Props {
  assignmentId: string;
  lessonId?: string | null;
  lessonSource?: string | null;
  worksheetId?: string | null;
  /** Žáci, kteří mají úlohu zadanou – pro filtrování výsledků aktivit. */
  studentIds: string[];
}

interface DifficultyRow {
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
const isAnswerCorrect = (item: any, answer: unknown, correct: string | string[]): boolean => {
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
const MANUAL_TYPES = new Set(["open_answer", "short_answer", "offline_activity"]);

/** Typy s automaticky vyhodnotitelnou odpovědí – ostatní (layout) do statistiky nepatří. */
const SCORABLE_TYPES = new Set([
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
            .select("user_id, activity_index, score, max_score")
            .eq("lesson_id", lessonId);
          if (studentIds.length > 0) query = query.in("user_id", studentIds);
          const { data } = await query;

          const byIndex = new Map<number, { sum: number; n: number }>();
          ((data as any[]) || []).forEach((r) => {
            const max = Number(r.max_score) || 0;
            if (max <= 0) return;
            const pct = (Number(r.score) || 0) / max;
            const cur = byIndex.get(r.activity_index) ?? { sum: 0, n: 0 };
            byIndex.set(r.activity_index, { sum: cur.sum + pct, n: cur.n + 1 });
          });

          for (const act of activities) {
            const agg = byIndex.get(act.index);
            scored.push({
              key: `a-${act.index}`,
              label: `${act.title}${act.required ? " (povinné)" : ""}`,
              pct: agg && agg.n > 0 ? Math.round((agg.sum / agg.n) * 100) : null,
              sampleCount: agg?.n ?? 0,
            });
          }
        }

        if (worksheetId) {
          const [wsRes, attRes] = await Promise.all([
            supabase.from("worksheets").select("spec").eq("id", worksheetId).maybeSingle(),
            supabase
              .from("assignment_attempts" as any)
              .select("student_id, answers, attempt_number")
              .eq("assignment_id", assignmentId),
          ]);

          const spec = (wsRes.data as any)?.spec;
          const variants: any[] = Array.isArray(spec?.variants) ? spec.variants : [];
          const attempts = ((attRes.data as any[]) || [])
            .slice()
            .sort((a, b) => (b.attempt_number ?? 0) - (a.attempt_number ?? 0));
          // Jeden (nejnovější) pokus na žáka, aby se nepočítalo dvakrát.
          const latestByStudent = new Map<string, any>();
          attempts.forEach((a) => {
            if (!latestByStudent.has(a.student_id)) latestByStudent.set(a.student_id, a);
          });
          const answerSets = [...latestByStudent.values()].map((a) => (a.answers ?? {}) as Record<string, unknown>);

          for (const variant of variants) {
            const keys: any[] = spec?.answerKeys?.[variant.variantId] ?? [];
            const itemMap = new Map<string, any>((variant.items ?? []).map((it: any) => [it.id, it]));
            for (const key of keys) {
              const item = itemMap.get(key.itemId);
              if (!item) continue;
              const label = truncate(String(item.prompt || `Úloha ${item.itemNumber ?? ""}`));
              if (MANUAL_TYPES.has(item.type)) {
                manual.push({ key: `w-${variant.variantId}-${key.itemId}`, label, pct: null, sampleCount: 0 });
                continue;
              }
              // Layoutové bloky (zápis, nadpisy, boxy) nemají odpověď – vynecháme je.
              if (!SCORABLE_TYPES.has(item.type)) continue;
              const relevant = answerSets.filter((ans) => key.itemId in ans);
              const correct = relevant.filter((ans) =>
                isAnswerCorrect(item, ans[key.itemId], key.correctAnswer),
              ).length;
              scored.push({
                key: `w-${variant.variantId}-${key.itemId}`,
                label,
                pct: relevant.length > 0 ? Math.round((correct / relevant.length) * 100) : null,
                sampleCount: relevant.length,
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

  const sorted = useMemo(() => {
    const withData = rows.filter((r) => r.pct !== null).sort((a, b) => (a.pct! - b.pct!));
    const without = rows.filter((r) => r.pct === null);
    return [...withData, ...without];
  }, [rows]);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (sorted.length === 0 && manualRows.length === 0) {
    return <p className="text-sm text-muted-foreground">Pro tuto úlohu nejsou data pro statistiku obtížnosti.</p>;
  }

  return (
    <div className="space-y-3">
      {sorted.length > 0 && (
        <ul className="space-y-2">
          {sorted.map((r) => (
            <li key={r.key} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 flex-1 truncate">{r.label}</span>
                {r.pct === null ? (
                  <Badge variant="outline" className="text-[10px]">Bez odpovědí</Badge>
                ) : (
                  <span className="shrink-0 font-medium">
                    {r.pct}% <span className="text-muted-foreground">({r.sampleCount})</span>
                  </span>
                )}
              </div>
              {r.pct !== null && (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className={`h-full ${barColor(r.pct)}`} style={{ width: `${r.pct}%` }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

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
