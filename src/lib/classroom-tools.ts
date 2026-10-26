import { shuffleArray } from "@/lib/shuffle";

export interface ClassroomPerson { id: string; name: string }

export interface ClassroomTarget { classId?: string | null; groupId?: string | null; targetId?: string | null }

/** Invalid/empty phases cannot start a timer; preserve fractional minute durations. */
export function phaseCountdownDuration(timeMin: unknown): number | null {
  if (typeof timeMin !== "string" && typeof timeMin !== "number") return null;
  const minutes = Number(timeMin);
  return Number.isFinite(minutes) && minutes > 0 && minutes <= 999 ? Math.round(minutes * 60000) : null;
}

/** Preselection never grants access: only already authorized options can be selected. */
export function classroomTargetSource(target: ClassroomTarget | undefined, classes: readonly { id: string }[], groups: readonly { id: string }[]): string {
  if (!target) return "manual";
  const groupId = target.groupId || target.targetId;
  if (groupId && groups.some(g => g.id === groupId)) return `group:${groupId}`;
  const classId = target.classId || target.targetId;
  return classId && classes.some(c => c.id === classId) ? `class:${classId}` : "manual";
}

export function parseClassroomNames(text: string): ClassroomPerson[] {
  return text.split(/\r?\n/).map((name, index) => ({ id: `manual-${index}`, name: name.trim() })).filter(p => p.name);
}

/** Identity, not spelling, distinguishes pupils with identical names. */
export function drawClassroomPerson(people: readonly ClassroomPerson[], drawn: readonly string[], noRepeat: boolean, rng = Math.random): ClassroomPerson | null {
  const pool = noRepeat ? people.filter(p => !drawn.includes(p.id)) : [...people];
  return pool.length ? pool[Math.min(pool.length - 1, Math.floor(Math.max(0, rng()) * pool.length))] : null;
}

export function splitClassroomGroups(people: readonly ClassroomPerson[], mode: "count" | "size", value: number, rng = Math.random): ClassroomPerson[][] {
  if (!people.length || !Number.isFinite(value) || value < 1) return [];
  const n = Math.max(1, Math.floor(value));
  const count = mode === "count" ? Math.min(n, people.length) : Math.ceil(people.length / n);
  const groups: ClassroomPerson[][] = Array.from({ length: count }, () => []);
  shuffleArray(people, rng).forEach((p, index) => groups[index % count].push(p));
  return groups;
}

export function formatClassroomTime(ms: number, tenths = false): string {
  const total = Math.floor(Math.max(0, Number.isFinite(ms) ? ms : 0) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor(total / 60) % 60;
  const s = total % 60;
  return `${h ? `${h}:` : ""}${String(h ? m : Math.floor(total / 60)).padStart(2, "0")}:${String(s).padStart(2, "0")}${tenths ? `.${Math.floor(Math.max(0, ms) % 1000 / 100)}` : ""}`;
}
const ABSENT_PREFIX = "bezli.classroom.absent.";

/** Prague calendar day, so absences reset at local midnight. */
export function classroomDayKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Only pupil IDs for today are stored; names never leave memory. Older days are purged. */
export function loadClassroomAbsent(source: string, now = new Date(), storage: Storage | undefined = globalThis.localStorage): string[] {
  if (source === "manual") return [];
  try {
    const day = classroomDayKey(now);
    for (let i = storage.length - 1; i >= 0; i--) {
      const k = storage.key(i);
      if (k?.startsWith(ABSENT_PREFIX) && !k.startsWith(`${ABSENT_PREFIX}${day}.`)) storage.removeItem(k);
    }
    const parsed = JSON.parse(storage.getItem(`${ABSENT_PREFIX}${day}.${source}`) || "[]");
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch { return []; }
}

export function saveClassroomAbsent(source: string, ids: readonly string[], now = new Date(), storage: Storage | undefined = globalThis.localStorage): void {
  if (source === "manual") return;
  try {
    const key = `${ABSENT_PREFIX}${classroomDayKey(now)}.${source}`;
    if (ids.length) storage.setItem(key, JSON.stringify([...ids])); else storage.removeItem(key);
  } catch { /* storage unavailable */ }
}

export function presentClassroomPeople(people: readonly ClassroomPerson[], absent: readonly string[]): ClassroomPerson[] {
  return people.filter(p => !absent.includes(p.id));
}
