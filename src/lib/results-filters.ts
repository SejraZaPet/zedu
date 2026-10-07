/**
 * Filtr „Třída / skupina“ a „Předmět“ ve Výsledcích — čisté funkce, jen čtení.
 * Hodnota rozsahu: ALL, "c:<classId>" nebo "g:<groupId>".
 */
export const ALL_SCOPE = "__all__";
export const NO_SUBJECT = "__none__";
export const NO_SUBJECT_LABEL = "Bez předmětu";
export const ALL_STATUS = "__all_status__";
export type AssignmentStatus = "published" | "scheduled" | "draft";

export interface ScopedAssignment {
  id: string;
  class_id: string | null;
  group_id?: string | null;
  subject_id?: string | null;
  subject?: string | null;
  status?: string | null;
}

export interface SubjectOption { value: string; label: string }
export interface CourseSubjectSource {
  id: string;
  name: string;
  classIds?: string[];
  groupIds?: string[];
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

export const subjectKey = (a: ScopedAssignment) =>
  a.subject_id ? `id:${a.subject_id}` : a.subject && a.subject.trim() ? `name:${a.subject.trim()}` : NO_SUBJECT;

/** Možnosti předmětu jen z úkolů v rozsahu; „Bez předmětu“ na konci. */
export function subjectOptions(assignments: ScopedAssignment[]): { value: string; label: string }[] {
  const labels = new Map<string, string>();
  assignments.forEach((assignment) => {
    const key = subjectKey(assignment);
    if (key !== NO_SUBJECT) labels.set(key, assignment.subject?.trim() || key.replace(/^name:/, ""));
  });
  const keys = new Set(assignments.map(subjectKey));
  const opts = [...labels].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, "cs"));
  if (keys.has(NO_SUBJECT)) opts.push({ value: NO_SUBJECT, label: NO_SUBJECT_LABEL });
  return opts;
}

/** Předměty kurzu: skupina má svůj předmět, třída rozvrh + předměty jejích úloh. */
export function courseSubjectOptions(
  scope: string,
  assignments: ScopedAssignment[],
  catalog: CourseSubjectSource[],
  groupToClass: Map<string, string>,
): SubjectOption[] {
  const parsed = parseScope(scope);
  const allowed = catalog.filter((subject) => {
    if (parsed.kind === "all") return true;
    return parsed.kind === "group" ? subject.groupIds?.includes(parsed.id) : subject.classIds?.includes(parsed.id);
  });
  const options = new Map(allowed.map((subject) => [`id:${subject.id}`, subject.name]));
  assignments.filter((assignment) => assignmentInScope(assignment, scope, groupToClass)).forEach((assignment) => {
    const key = subjectKey(assignment);
    if (key !== NO_SUBJECT) options.set(key, assignment.subject?.trim() || options.get(key) || key.replace(/^name:/, ""));
  });
  return [...options].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, "cs"));
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
  status: string = ALL_STATUS,
): T[] {
  return list.filter(
    (a) => assignmentInScope(a, scope, groupToClass)
      && (subject === ALL_SCOPE || subjectKey(a) === subject)
      && (status === ALL_STATUS || (a.status ?? "draft") === status),
  );
}

export function statusCounts(assignments: ScopedAssignment[]): Record<AssignmentStatus | "all", number> {
  return assignments.reduce((counts, assignment) => {
    const status = assignment.status === "published" || assignment.status === "scheduled" ? assignment.status : "draft";
    counts[status] += 1;
    counts.all += 1;
    return counts;
  }, { all: 0, published: 0, scheduled: 0, draft: 0 });
}
