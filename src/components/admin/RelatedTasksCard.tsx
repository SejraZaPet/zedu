import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ListChecks, Plus } from "lucide-react";
import StaffTaskDialog, { TASK_PRIORITIES, TASK_STATUSES } from "./StaffTaskDialog";

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string;
  priority: string;
  color: string | null;
  assigned_to: string;
  related_organization_id: string | null;
  related_user_id: string | null;
}

interface Props {
  /** Vazba na CRM organizaci (klienta) */
  organizationId?: string;
  /** Vazba na konkrétního uživatele (učitele/lektora) */
  userId?: string;
  /** Bez oprávnění k editaci se zobrazí jen seznam */
  canEdit?: boolean;
  /** Vlastní obal (Card) – vypnuto při vkládání do dialogu */
  bare?: boolean;
}

const statusLabel = (v: string) => TASK_STATUSES.find((s) => s.value === v)?.label ?? v;
const priorityLabel = (v: string) => TASK_PRIORITIES.find((p) => p.value === v)?.label ?? v;

/** Úkoly a připomínky navázané na CRM organizaci nebo na konkrétního uživatele. */
const RelatedTasksCard = ({ organizationId, userId, canEdit = true, bare }: Props) => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TaskRow | null>(null);

  const load = useCallback(async () => {
    if (!organizationId && !userId) return;
    setLoading(true);
    let query = supabase
      .from("staff_tasks")
      .select("id, title, description, due_date, status, priority, color, assigned_to, related_organization_id, related_user_id")
      .order("due_date", { ascending: true, nullsFirst: false });
    query = organizationId
      ? query.eq("related_organization_id", organizationId)
      : query.eq("related_user_id", userId as string);
    const { data } = await query;
    setTasks((data ?? []) as TaskRow[]);
    setLoading(false);
  }, [organizationId, userId]);

  useEffect(() => { void load(); }, [load]);

  const body = (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-heading flex items-center gap-2 text-sm">
          <ListChecks className="h-4 w-4" /> Úkoly a připomínky
        </h3>
        {canEdit && user && (
          <Button size="sm" variant="outline" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Přidat úkol/připomínku
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Načítání…</p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">Zatím žádné navázané úkoly.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {tasks.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => { if (canEdit) { setEditing(t); setDialogOpen(true); } }}
                className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50"
              >
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: t.color || "hsl(var(--primary))" }}
                />
                <span className={t.status === "done" ? "line-through text-muted-foreground" : ""}>{t.title}</span>
                <span className="ml-auto flex items-center gap-2">
                  {t.due_date && (
                    <span className="tabular-nums text-xs text-muted-foreground">
                      {new Date(t.due_date).toLocaleDateString("cs-CZ")}
                    </span>
                  )}
                  <Badge variant="secondary" className="text-[11px]">{statusLabel(t.status)}</Badge>
                  <span className="text-xs text-muted-foreground">{priorityLabel(t.priority)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {user && (
        <StaffTaskDialog
          open={dialogOpen}
          onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
          assignedTo={user.id}
          assignedBy={user.id}
          allowPickAssignee
          editing={editing}
          relatedOrganizationId={organizationId ?? null}
          relatedUserId={userId ?? null}
          onCreated={() => void load()}
        />
      )}
    </div>
  );

  return bare ? body : <Card className="space-y-3 p-5">{body}</Card>;
};

export default RelatedTasksCard;
