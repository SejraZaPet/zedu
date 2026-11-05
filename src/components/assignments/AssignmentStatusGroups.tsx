import { Fragment, useId, useState, type ReactNode } from "react";
import { Clock, CircleCheck, CircleAlert, CalendarClock, ChevronDown, ChevronRight, Hourglass, ClipboardCheck, Lock, BookOpen, Megaphone, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ASSIGNMENT_GROUPS, TEACHER_ASSIGNMENT_GROUPS, sortStatusAssignments, type AssignmentStatus, type StatusAssignment } from "@/lib/assignment-status";

const ICONS = { pending: Clock, soon: Clock, submitted: Hourglass, overdue: CircleAlert, graded: CircleCheck, preparing: CalendarClock, review: ClipboardCheck, closed: Lock, material: BookOpen, announcement: Megaphone };
export function AssignmentStateIcon({ status }: { status: AssignmentStatus }) {
  const Icon = ICONS[status.state];
  return <span className="assignment-state-icon"><Icon aria-hidden="true" className="h-5 w-5" /></span>;
}
export function AssignmentStateBadge({ status }: { status: AssignmentStatus }) {
  return <span className="inline-flex flex-wrap items-center justify-end gap-1">
    <span className="assignment-state-badge">{status.label}</span>
    {status.badges?.map((b) => <span key={b} className="assignment-state-badge assignment-extra-badge">{b}</span>)}
    {status.progress && <span className={`assignment-progress-badge assignment-progress-${status.progress.tone}`}>
      <Users aria-hidden="true" className="h-3.5 w-3.5" />{status.progress.text}</span>}
  </span>;
}

export function AssignmentStatusCard({ status, title, children, actions }: {
  status: AssignmentStatus; title: string; children?: ReactNode; actions?: ReactNode;
}) {
  return <Card className={`assignment-status-card assignment-status-${status.state} p-4`}>
    <div className="flex items-start gap-3 min-w-0">
      <AssignmentStateIcon status={status} />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="font-semibold break-words min-w-0 flex-1">{title}</h3>
          <AssignmentStateBadge status={status} />
        </div>
        {children}
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  </Card>;
}

export function AssignmentStatusGroups<T extends StatusAssignment & { id: string }>({ items, statusOf, storageKey, renderItem, teacher = false }: {
  items: readonly T[]; statusOf: (item: T) => AssignmentStatus; storageKey: string; teacher?: boolean;
  renderItem: (item: T, status: AssignmentStatus) => ReactNode;
}) {
  const uid = useId();
  // Re-read when storageKey changes (same component reused across subjects/classes).
  const [state, setState] = useState(() => ({ key: storageKey, map: readCollapsed(storageKey, teacher) }));
  const collapsed = state.key === storageKey ? state.map : readCollapsed(storageKey, teacher);
  const toggle = (group: string) => {
    const map = { ...collapsed, [group]: !collapsed[group] };
    writeCollapsed(storageKey, map);
    setState({ key: storageKey, map });
  };
  const sorted = sortStatusAssignments(items, statusOf);
  return <div className="space-y-5">{(teacher ? TEACHER_ASSIGNMENT_GROUPS : ASSIGNMENT_GROUPS).map((group) => {
    const rows = sorted.filter((item) => statusOf(item).group === group.key);
    if (!rows.length) return null;
    const id = `${uid}-${group.key}`;
    return <section key={group.key} aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>
        <Button variant="ghost" className="mb-2 h-auto py-2 px-1 gap-2" aria-expanded={!collapsed[group.key]} aria-controls={id}
          onClick={() => toggle(group.key)}>
          {collapsed[group.key] ? <ChevronRight aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
          <span className="font-semibold">{group.label}</span><span className="text-muted-foreground tabular-nums">({rows.length})</span>
        </Button>
      </h2>
      <div id={id} hidden={!!collapsed[group.key]} className="space-y-3">
        {rows.map((item) => <Fragment key={item.id}>{renderItem(item, statusOf(item))}</Fragment>)}
      </div>
    </section>;
  })}</div>;
}

const STUDENT_OPEN = new Set(["pending", "announcement"]);
const TEACHER_OPEN = new Set(["review", "pending"]);
/** Výchozí sbalení skupin bez uložené volby. */
export function defaultCollapsed(teacher: boolean): Record<string, boolean> {
  const open = teacher ? TEACHER_OPEN : STUDENT_OPEN;
  return Object.fromEntries((teacher ? TEACHER_ASSIGNMENT_GROUPS : ASSIGNMENT_GROUPS).map((g) => [g.key, !open.has(g.key)]));
}
const STORAGE_PREFIX = "bezli:collapsed:";
export function readCollapsed(storageKey: string, teacher: boolean): Record<string, boolean> {
  const base = defaultCollapsed(teacher);
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + storageKey);
    const saved = raw ? JSON.parse(raw) : null;
    if (saved && typeof saved === "object") for (const [k, v] of Object.entries(saved)) if (typeof v === "boolean") base[k] = v;
  } catch { /* private mode / corrupt value → defaults */ }
  return base;
}
export function writeCollapsed(storageKey: string, map: Record<string, boolean>) {
  try { localStorage.setItem(STORAGE_PREFIX + storageKey, JSON.stringify(map)); } catch { /* unavailable storage */ }
}
