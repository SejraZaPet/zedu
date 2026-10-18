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