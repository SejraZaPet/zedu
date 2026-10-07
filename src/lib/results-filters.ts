/**
 * Filtr „Třída / skupina“ a „Předmět“ ve Výsledcích — čisté funkce, jen čtení.
 * Hodnota rozsahu: ALL, "c:<classId>" nebo "g:<groupId>".
 */
export const ALL_SCOPE = "__all__";
export const NO_SUBJECT = "__none__";
export const NO_SUBJECT_LABEL = "Bez předmětu";

export interface ScopedAssignment {
  id: string;
  class_id: string | null;
  group_id?: string | null;
  subject?: string | null;
}

export const classScope = (id: string) => `c:${id}`;
export const groupScope = (id: string) => `g:${id}`;

export function parseScope(scope: string): { kind: "all" } | { kind: "class" | "group"; id: string } {
  if (scope.startsWith("c:")) return { kind: "class", id: scope.slice(2) };
  if (scope.startsWith("g:")) return { kind: "group", id: scope.slice(2) };
  return { kind: "all" };
}

/**
 * Skupina → třída jen když je to bezpečné: skupina má členy a VŠICHNI jsou
 * v jedné a téže třídě učitelky (a v žádné jiné z jejích tříd zároveň).
 */
export function groupsFullyInClass(
  groupMembers: { group_id: string; student_id: string }[],
  classMembers: { class_id: string; user_id: string }[],
): Map<string, string> {
  const classesOf = new Map<string, Set<string>>();
  classMembers.forEach((m) => {
    if (!classesOf.has(m.user_id)) classesOf.set(m.user_id, new Set());
    classesOf.get(m.user_id)!.add(m.class_id);
  });
  const membersOf = new Map<string, string[]>();
  groupMembers.forEach((m) => {
    if (!membersOf.has(m.group_id)) membersOf.set(m.group_id, []);
    membersOf.get(m.group_id)!.push(m.student_id);
  });
  const out = new Map<string, string>();
  membersOf.forEach((students, gid) => {
    let common: Set<string> | null = null;
    for (const s of students) {
      const cls = classesOf.get(s);
      if (!cls || cls.size === 0) return;
      common = common === null ? new Set(cls) : new Set([...common].filter((c) => cls.has(c)));
      if (common.size === 0) return;
    }
    if (common && common.size === 1) out.set(gid, [...common][0]);
  });
  return out;
}

export function assignmentInScope(
  a: ScopedAssignment,
  scope: string,
  groupToClass: Map<string, string>,
): boolean {
  const p = parseScope(scope);
  if (p.kind === "all") return true;
  if (p.kind === "group") return a.group_id === p.id;
  if (a.class_id === p.id) return true;
  return !a.class_id && !!a.group_id && groupToClass.get(a.group_id) === p.id;
}

export const subjectKey = (a: ScopedAssignment) => (a.subject && a.subject.trim() ? a.subject.trim() : NO_SUBJECT);

/** Možnosti předmětu jen z úkolů v rozsahu; „Bez předmětu“ na konci. */
export function subjectOptions(assignments: ScopedAssignment[]): { value: string; label: string }[] {
  const keys = new Set(assignments.map(subjectKey));
  const named = [...keys].filter((k) => k !== NO_SUBJECT).sort((a, b) => a.localeCompare(b, "cs"));
  const opts = named.map((k) => ({ value: k, label: k }));
  if (keys.has(NO_SUBJECT)) opts.push({ value: NO_SUBJECT, label: NO_SUBJECT_LABEL });
  return opts;
}

/** Předmět zůstane, jen když je v nové nabídce; jinak „Všechny předměty“. */
export function keepSubject(current: string, options: { value: string }[]): string {
  if (current === ALL_SCOPE) return current;
  return options.some((o) => o.value === current) ? current : ALL_SCOPE;
}

export function filterAssignments<T extends ScopedAssignment>(
  list: T[],
  scope: string,
  subject: string,
  groupToClass: Map<string, string>,
): T[] {
  return list.filter(
    (a) => assignmentInScope(a, scope, groupToClass) && (subject === ALL_SCOPE || subjectKey(a) === subject),
  );
}
