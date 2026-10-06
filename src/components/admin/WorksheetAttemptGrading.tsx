import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save } from "lucide-react";

/** Typy bez odpovědi (layout) – v hodnocení se nezobrazují. */
const LAYOUT_TYPES = new Set([
  "section_header", "heading", "text_block", "info_box", "divider", "image", "write_lines", "lesson_block",
]);
const OPEN_TYPES = new Set(["open_answer", "offline_activity"]);
const LETTERS = "ABCDEFGHIJKLMNOP";
const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

export interface ItemGrade { points: number; max: number; comment?: string }
export interface TeacherGrading {
  items: Record<string, ItemGrade>;
  total: number;
  max: number;
  graded_at: string;
  graded_by: string | null;
}

interface Row {
  id: string;
  prompt: string;
  type: string;
  max: number | null;
  answer: unknown;
  correct: boolean | null;
  unknown?: boolean;
  choices?: string[];
}

const isEmpty = (v: unknown) =>
  v === undefined || v === null || v === "" || (Array.isArray(v) && v.every((x) => norm(x) === ""));

function checkCorrect(item: any, answer: unknown, key: any): boolean | null {
  if (!key || OPEN_TYPES.has(item.type)) return null;
  const ca = key.correctAnswer;
  if (ca === undefined || ca === null || ca === "") return null;
  if (isEmpty(answer)) return false;
  if (item.type === "short_answer" && !Array.isArray(ca) && norm(ca) === "") return null;
  if (Array.isArray(ca)) {
    const a = Array.isArray(answer) ? answer : [answer];
    return ca.length === a.length && ca.every((c, i) => norm(c) === norm(a[i]));
  }
  return norm(answer) === norm(ca);
}

function formatAnswer(row: Row): string {
  const a = row.answer;
  if (Array.isArray(a)) return a.map((x) => String(x ?? "")).join(" · ");
  if (row.type === "true_false") return a === "true" ? "Pravda" : a === "false" ? "Nepravda" : String(a);
  if (row.type === "mcq" && typeof a === "string" && a.length === 1 && row.choices) {
    const i = LETTERS.indexOf(a.toUpperCase());
    if (i >= 0 && row.choices[i] !== undefined) return `${a.toUpperCase()}) ${row.choices[i]}`;
  }
  return typeof a === "object" ? JSON.stringify(a) : String(a);
}

interface Props {
  worksheetId: string;
  answers: Record<string, unknown> | null;
  existing: TeacherGrading | null;
  saving: boolean;
  onSave: (grading: Omit<TeacherGrading, "graded_at" | "graded_by">) => void;
}

/** Přehled odpovědí žáka v pracovním listu s bodováním po položkách (jen čte odpovědi). */
export default function WorksheetAttemptGrading({ worksheetId, answers, existing, saving, onSave }: Props) {
  const [spec, setSpec] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState<Record<string, string>>({});
  const [maxes, setMaxes] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});

  useEffect(() => {
    let c = false;
    setLoading(true);
    supabase.from("worksheets").select("spec").eq("id", worksheetId).maybeSingle().then(({ data }) => {
      if (!c) { setSpec((data as any)?.spec ?? null); setLoading(false); }
    });
    return () => { c = true; };
  }, [worksheetId]);

  const rows = useMemo<Row[]>(() => {
    const ans = answers ?? {};
    const items = new Map<string, any>();
    const keys = new Map<string, any>();
    for (const v of (spec?.variants ?? []) as any[]) {
      for (const it of v.items ?? []) if (!items.has(it.id)) items.set(it.id, it);
      for (const k of spec?.answerKeys?.[v.variantId] ?? []) if (!keys.has(k.itemId)) keys.set(k.itemId, k);
    }
    const out: Row[] = [];
    // Pořadí z první varianty, která obsahuje odpovězené položky.
    const variant = ((spec?.variants ?? []) as any[]).find((v) => (v.items ?? []).some((it: any) => it.id in ans))
      ?? spec?.variants?.[0];
    const seen = new Set<string>();
    for (const it of (variant?.items ?? []) as any[]) {
      seen.add(it.id);
      if (LAYOUT_TYPES.has(it.type) && !(it.id in ans)) continue;
      const pts = Number(it.points);
      out.push({
        id: it.id,
        prompt: String(it.prompt || `Úloha ${it.itemNumber ?? ""}`),
        type: String(it.type),
        max: Number.isFinite(pts) && pts > 0 ? pts : null,
        answer: ans[it.id],
        correct: checkCorrect(it, ans[it.id], keys.get(it.id)),
        choices: Array.isArray(it.choices) ? it.choices : undefined,
      });
    }
    for (const id of Object.keys(ans)) {
      if (seen.has(id) || id.startsWith("_")) continue;
      const it = items.get(id);
      out.push({
        id,
        prompt: it ? String(it.prompt || id) : "Neznámé zadání (položka už v listu není)",
        type: it ? String(it.type) : "unknown",
        max: it && Number(it.points) > 0 ? Number(it.points) : null,
        answer: ans[id],
        correct: it ? checkCorrect(it, ans[id], keys.get(id)) : null,
        unknown: !it,
      });
    }
    return out;
  }, [spec, answers]);

  // Předvyplnění: uložené hodnocení, jinak automatické body uzavřených položek.
  useEffect(() => {
    const p: Record<string, string> = {}, m: Record<string, string> = {}, cm: Record<string, string> = {};
    for (const r of rows) {
      const g = existing?.items?.[r.id];
      const max = g?.max ?? r.max ?? 1;
      m[r.id] = String(max);
      p[r.id] = g ? String(g.points) : r.correct === true ? String(max) : r.correct === false ? "0" : "";
      cm[r.id] = g?.comment ?? "";
    }
    setPoints(p); setMaxes(m); setComments(cm);
  }, [rows, existing]);

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">V pracovním listu nejsou žádné položky k hodnocení.</p>;

  const num = (s: string | undefined) => { const n = Number(String(s ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
  const total = rows.reduce((s, r) => s + Math.min(Math.max(num(points[r.id]), 0), num(maxes[r.id])), 0);
  const maxTotal = rows.reduce((s, r) => s + num(maxes[r.id]), 0);
  const invalid = rows.some((r) => {
    const p = num(points[r.id]);
    return p < 0 || p > num(maxes[r.id]) || num(maxes[r.id]) <= 0;
  });

  const save = () => {
    const items: Record<string, ItemGrade> = {};
    for (const r of rows) {
      const c = (comments[r.id] ?? "").trim();
      items[r.id] = { points: num(points[r.id]), max: num(maxes[r.id]), ...(c ? { comment: c.slice(0, 500) } : {}) };
    }
    onSave({ items, total: Math.round(total), max: Math.round(maxTotal) });
  };

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <h5 className="text-xs font-semibold">Odpovědi v pracovním listu</h5>
      <ol className="space-y-2">
        {rows.map((r, i) => {
          const empty = isEmpty(r.answer);
          const editableMax = r.max === null;
          return (
            <li key={r.id} className="space-y-1.5 rounded-md border border-border bg-muted/20 p-2">
              <p className="text-sm font-medium">
                {i + 1}. {r.prompt}
                {r.unknown && <Badge variant="outline" className="ml-2 text-[10px]">neznámé zadání</Badge>}
              </p>
              <div className="flex flex-wrap items-start gap-2 text-sm">
                {empty ? (
                  <span className="italic text-muted-foreground">bez odpovědi</span>
                ) : (
                  <span className="whitespace-pre-wrap rounded bg-background px-2 py-1">{formatAnswer(r)}</span>
                )}
                {r.correct === true && <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">Správně</Badge>}
                {r.correct === false && !empty && <Badge variant="destructive" className="text-[10px]">Špatně</Badge>}
                {r.correct === null && !empty && <Badge variant="outline" className="text-[10px]">Ruční hodnocení</Badge>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1 text-xs">
                  Body
                  <Input
                    type="number" min={0} max={num(maxes[r.id])} step={0.5}
                    className="h-8 w-20"
                    aria-label={`Body za položku ${i + 1}`}
                    value={points[r.id] ?? ""}
                    onChange={(e) => setPoints((p) => ({ ...p, [r.id]: e.target.value }))}
                  />
                  /
                  {editableMax ? (
                    <Input
                      type="number" min={1} step={1} className="h-8 w-16"
                      aria-label={`Maximum bodů za položku ${i + 1}`}
                      value={maxes[r.id] ?? "1"}
                      onChange={(e) => setMaxes((m) => ({ ...m, [r.id]: e.target.value }))}
                    />
                  ) : (
                    <span>{r.max}</span>
                  )}
                </label>
                <Input
                  className="h-8 min-w-[12rem] flex-1 text-xs"
                  placeholder="Komentář k položce (nepovinné)"
                  aria-label={`Komentář k položce ${i + 1}`}
                  maxLength={500}
                  value={comments[r.id] ?? ""}
                  onChange={(e) => setComments((c) => ({ ...c, [r.id]: e.target.value }))}
                />
              </div>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <span className="text-sm font-semibold">Celkem: {Math.round(total * 10) / 10} / {maxTotal}</span>
        {invalid && <span className="text-xs text-destructive">Body musí být mezi 0 a maximem položky.</span>}
        <Button size="sm" disabled={saving || invalid} onClick={save}>
          {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
          Uložit hodnocení
        </Button>
        {existing?.graded_at && (
          <span className="text-[11px] text-muted-foreground">Ohodnoceno {new Date(existing.graded_at).toLocaleString("cs-CZ")}</span>
        )}
      </div>
    </div>
  );
}
