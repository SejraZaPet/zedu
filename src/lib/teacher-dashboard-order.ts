export const TEACHER_DASHBOARD_STORAGE_KEY = "teacher-dashboard-widget-order-v2";
export const TEACHER_DASHBOARD_LEGACY_STORAGE_KEY = "teacher-dashboard-widget-order-v1";

export const TEACHER_DASHBOARD_GROUPS = ["priority", "teaching", "preparation", "classes", "personal"] as const;
export type TeacherDashboardGroup = typeof TEACHER_DASHBOARD_GROUPS[number];
export type TeacherDashboardOrder = Record<TeacherDashboardGroup, string[]>;

export const DEFAULT_TEACHER_DASHBOARD_ORDER: TeacherDashboardOrder = {
  priority: ["activities", "review"],
  teaching: ["classroom-tools", "assignments", "results"],
  preparation: ["textbooks", "worksheets", "lesson-plans", "suggest-method"],
  classes: ["classes", "subjects", "svp", "notifications"],
  personal: ["calendar", "todos", "academy"],
};

export function createDefaultTeacherDashboardOrder(): TeacherDashboardOrder {
  return Object.fromEntries(
    TEACHER_DASHBOARD_GROUPS.map((group) => [group, [...DEFAULT_TEACHER_DASHBOARD_ORDER[group]]]),
  ) as TeacherDashboardOrder;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function mergeGroup(saved: readonly unknown[], defaults: readonly string[]): string[] {
  const merged = [...new Set(saved.filter((id): id is string => typeof id === "string" && defaults.includes(id)))];
  return [...merged, ...defaults.filter((id) => !merged.includes(id))];
}

/** Migrates the old flat v1 order and sanitizes v2 without allowing cross-group movement. */
export function migrateTeacherDashboardOrder(saved: unknown): TeacherDashboardOrder {
  const defaults = createDefaultTeacherDashboardOrder();
  if (Array.isArray(saved)) {
    for (const group of TEACHER_DASHBOARD_GROUPS) {
      defaults[group] = mergeGroup(saved, DEFAULT_TEACHER_DASHBOARD_ORDER[group]);
    }
    return defaults;
  }
  if (!isRecord(saved) || saved.version !== 2 || !isRecord(saved.groups)) return defaults;

  for (const group of TEACHER_DASHBOARD_GROUPS) {
    const savedGroup = saved.groups[group];
    defaults[group] = mergeGroup(Array.isArray(savedGroup) ? savedGroup : [], DEFAULT_TEACHER_DASHBOARD_ORDER[group]);
  }
  return defaults;
}

export function parseTeacherDashboardOrder(raw: string | null): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

export function serializeTeacherDashboardOrder(order: TeacherDashboardOrder): string {
  return JSON.stringify({ version: 2, groups: order });
}

export function moveTeacherDashboardTile(
  order: TeacherDashboardOrder,
  activeId: string,
  overId: string,
): TeacherDashboardOrder {
  if (activeId === overId) return order;
  const group = TEACHER_DASHBOARD_GROUPS.find((candidate) => order[candidate].includes(activeId));
  if (!group || !order[group].includes(overId)) return order;

  const ids = order[group];
  const oldIndex = ids.indexOf(activeId);
  const newIndex = ids.indexOf(overId);
  const moved = [...ids];
  moved.splice(oldIndex, 1);
  moved.splice(newIndex, 0, activeId);
  return { ...order, [group]: moved };
}
