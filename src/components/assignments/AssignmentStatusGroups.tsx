import { Fragment, useEffect, useId, useState, type ReactNode } from "react";
import { Clock, Check, CircleCheck, CircleAlert, CalendarClock, ChevronDown, ChevronRight, Hourglass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ASSIGNMENT_GROUPS, sortStatusAssignments, type AssignmentStatus, type StatusAssignment } from "@/lib/assignment-status";

const ICONS = { pending: Clock, soon: Clock, submitted: Hourglass, overdue: CircleAlert, graded: CircleCheck, preparing: CalendarClock };
export function AssignmentStateIcon({ status }: { status: AssignmentStatus }) {
  const Icon = ICONS[status.state];
  return <span className="assignment-state-icon"><Icon aria-hidden="true" className="h-5 w-5" /></span>;
}
export function AssignmentStateBadge({ status }: { status: AssignmentStatus }) {
  return <span className="assignment-state-badge">{status.label}</span>;
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

export function AssignmentStatusGroups<T extends StatusAssignment & { id: string }>({ items, statusOf, storageKey, renderItem }: {
  items: readonly T[]; statusOf: (item: T) => AssignmentStatus; storageKey: string;
  renderItem: (item: T, status: AssignmentStatus) => ReactNode;
}) {
  const uid = useId();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try { return { submitted: true, graded: true, ...JSON.parse(sessionStorage.getItem(storageKey) ?? "{}") }; }
    catch { return { submitted: true, graded: true }; }
  });
  useEffect(() => { try { sessionStorage.setItem(storageKey, JSON.stringify(collapsed)); } catch { /* unavailable storage */ } }, [collapsed, storageKey]);
  const sorted = sortStatusAssignments(items, statusOf);
  return <div className="space-y-5">{ASSIGNMENT_GROUPS.map((group) => {
    const rows = sorted.filter((item) => statusOf(item).group === group.key);
    if (!rows.length) return null;
    const id = `${uid}-${group.key}`;
    return <section key={group.key} aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>
        <Button variant="ghost" className="mb-2 h-auto py-2 px-1 gap-2" aria-expanded={!collapsed[group.key]} aria-controls={id}
          onClick={() => setCollapsed((prev) => ({ ...prev, [group.key]: !prev[group.key] }))}>
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