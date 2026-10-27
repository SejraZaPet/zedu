/** Čisté pomocné funkce pro fáze technik „Učím se“ (klient). */
import { evaluatePracticeAnswer, type PracticeAnswer, type PracticeQuestion } from "@/lib/student-practice";
import { CLASS_ROSTER_KIND } from "@/lib/notebook";

const base = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

/** Akrostik (víc slov) nebo akronym (jedno slovo): první písmena v pořadí. Diakritika se toleruje (C = Č). */
export function checkAcrostic(text: string, terms: string[]) {
  const letters = terms.map((t) => (t.trim()[0] ?? "").toUpperCase());
  const words = (text.match(/[\p{L}\p{N}]+/gu) ?? []);
  const acronym = words.length === 1 && words[0].length === letters.length && letters.length > 1;
  const got = acronym ? [...words[0]].map((c) => c.toUpperCase()) : words.map((w) => w[0].toUpperCase());
  const items = letters.map((expected, i) => ({
    expected, got: got[i] ?? "", ok: !!got[i] && base(got[i]) === base(expected),
  }));
  return { mode: acronym ? "akronym" as const : "akrostik" as const, items, ok: items.length > 0 && items.every((i) => i.ok) };
}

export const SEQUENCE_PASS_PERCENT = 70;

/** Sekvenční: kolik fází je odemčeno (část se odemkne při ≥ 70 % v předchozí části). */
export function sequenceUnlockedCount(
  phases: { kind: string; questions: PracticeQuestion[] }[],
  answers: Record<string, PracticeAnswer>,
): number {
  let offset = 0;
  for (let p = 0; p < phases.length; p++) {
    const ph = phases[p];
    if (ph.kind !== "section") return p + 1; // závěr po všech částech
    const scorable = ph.questions.map((q, i) => ({ q, i: offset + i })).filter(({ q }) => q.type !== "open");
    offset += ph.questions.length;
    if (p === phases.length - 1) return phases.length;
    if (scorable.length === 0) continue;
    const answered = scorable.every(({ i }) => answers[String(i)] !== undefined && answers[String(i)] !== "");
    const correct = scorable.filter(({ q, i }) => evaluatePracticeAnswer(q, answers[String(i)])).length;
    if (!answered || (correct / scorable.length) * 100 < SEQUENCE_PASS_PERCENT) return p + 1;
  }
  return phases.length;
}

/** Nahradí {{stop:i}} jménem zastávky žáka (loci). */
export const withStops = (text: string, stops: string[]) =>
  text.replace(/\{\{stop:(\d+)\}\}/g, (_, i) => stops[Number(i)]?.trim() || `Zastávka ${Number(i) + 1}`);

/* ---------- Pomodoro (počítá z časových razítek, ne z intervalu) ---------- */
export type PomodoroPreset = { work: number; brk: number; long: number };
export const POMODORO_PRESETS: Record<string, PomodoroPreset> = {
  "25/5": { work: 25, brk: 5, long: 15 },
  "15/3": { work: 15, brk: 3, long: 15 },
  "50/10": { work: 50, brk: 10, long: 30 },
};
export type PomodoroMode = "idle" | "work" | "break" | "long_break";
export type PomodoroState = { mode: PomodoroMode; endsAt: number | null; cycles: number; pausedMs: number | null };
export const POMODORO_IDLE: PomodoroState = { mode: "idle", endsAt: null, cycles: 0, pausedMs: null };
const MIN = 60_000;

export const startWork = (s: PomodoroState, now: number, p: PomodoroPreset): PomodoroState =>
  ({ ...s, mode: "work", endsAt: now + p.work * MIN, pausedMs: null });

export const remainingMs = (s: PomodoroState, now: number) =>
  s.pausedMs ?? (s.endsAt ? Math.max(0, s.endsAt - now) : 0);

export const pause = (s: PomodoroState, now: number): PomodoroState =>
  s.endsAt && s.pausedMs === null ? { ...s, pausedMs: remainingMs(s, now) } : s;
export const resume = (s: PomodoroState, now: number): PomodoroState =>
  s.pausedMs !== null ? { ...s, endsAt: now + s.pausedMs, pausedMs: null } : s;

/** Posune stav, pokud čas vypršel. Po 4. cyklu dlouhá pauza. Po pauze čeká (idle). */
export function advance(s: PomodoroState, now: number, p: PomodoroPreset): { state: PomodoroState; finished: PomodoroMode | null } {
  if (s.mode === "idle" || s.pausedMs !== null || !s.endsAt || now < s.endsAt) return { state: s, finished: null };
  if (s.mode === "work") {
    const cycles = s.cycles + 1;
    const long = cycles % 4 === 0;
    return { state: { mode: long ? "long_break" : "break", endsAt: s.endsAt + (long ? p.long : p.brk) * MIN, cycles, pausedMs: null }, finished: "work" };
  }
  return { state: { ...s, mode: "idle", endsAt: null }, finished: s.mode };
}

export const formatMs = (ms: number) => {
  const t = Math.ceil(ms / 1000);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

/* ---------- Zdroj ze sešitu: jen textová pole ---------- */
export function notebookPageText(content: unknown): string {
  const boxes = (content as any)?.textBoxes;
  if (!Array.isArray(boxes)) return "";
  return boxes
    .filter((b: any) => b && b.kind !== CLASS_ROSTER_KIND && typeof b.text === "string")
    .map((b: any) => b.text.trim())
    .filter(Boolean)
    .join("\n\n");
}

/* ---------- Předání vlastního zdroje do procvičování (jen relace prohlížeče) ---------- */
export const PRACTICE_SOURCE_KEY = "bezli.practice.source";
export type PracticeSource = { kind: "text" | "file" | "notebook" | "portfolio"; text: string; label: string };

export function savePracticeSource(src: PracticeSource) {
  try { sessionStorage.setItem(PRACTICE_SOURCE_KEY, JSON.stringify(src)); return true; } catch { return false; }
}
export function readPracticeSource(): PracticeSource | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(PRACTICE_SOURCE_KEY) ?? "null");
    return v && typeof v.text === "string" && typeof v.kind === "string" ? v : null;
  } catch { return null; }
}
