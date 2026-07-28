import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Check, UserX, TrendingDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cs } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface AlertRow {
  id: string;
  student_id: string;
  alert_type: "inactive" | "struggling_topic";
  context: string | null;
  detail: string;
  created_at: string;
  resolved: boolean;
  student?: { first_name: string; last_name: string } | null;
}

interface Props {
  classId?: string;
  studentIds?: string[];
}

const typeMeta = {
  inactive: { Icon: UserX, label: "Neaktivní", color: "text-orange-600" },
  struggling_topic: { Icon: TrendingDown, label: "Zaostává", color: "text-red-600" },
};

const ClassAlertsPanel = ({ classId, studentIds }: Props) => {
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("student_alerts" as any)
      .select("id, student_id, alert_type, context, detail, created_at, resolved")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!showResolved) q = q.eq("resolved", false);
    if (classId) q = q.eq("class_id", classId);
    else if (studentIds && studentIds.length > 0) q = q.in("student_id", studentIds);
    const { data } = await q;
    const rows = ((data as any) ?? []) as AlertRow[];

    const ids = Array.from(new Set(rows.map((r) => r.student_id)));
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", ids);
      const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
      rows.forEach((r) => {
        const p = map.get(r.student_id);
        r.student = p ? { first_name: p.first_name, last_name: p.last_name } : null;
      });
    }
    setAlerts(rows);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, JSON.stringify(studentIds), showResolved]);

  const resolve = async (id: string) => {
    const { error } = await supabase
      .from("student_alerts" as any)
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast({ title: "Nepodařilo se označit", description: error.message, variant: "destructive" });
      return;
    }
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    toast({ title: "Označeno jako vyřešeno" });
  };

  const openCount = alerts.filter((a) => !a.resolved).length;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          Upozornění
          {openCount > 0 && (
            <Badge variant="destructive" className="ml-1">{openCount}</Badge>
          )}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setShowResolved((s) => !s)}>
          {showResolved ? "Skrýt vyřešené" : "Zobrazit vše"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="text-sm text-muted-foreground py-4 text-center">Načítání…</div>
        ) : alerts.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            Žádná aktivní upozornění.
          </div>
        ) : (
          alerts.map((a) => {
            const meta = typeMeta[a.alert_type];
            const Icon = meta.Icon;
            const name = a.student
              ? `${a.student.first_name ?? ""} ${a.student.last_name ?? ""}`.trim() || "Žák"
              : "Žák";
            return (
              <div
                key={a.id}
                className={`flex items-start gap-3 rounded-lg border p-3 ${a.resolved ? "opacity-60" : "bg-background"}`}
              >
                <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${meta.color}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{name}</span>
                    <Badge variant="outline" className="text-xs">{meta.label}</Badge>
                    {a.context && <Badge variant="secondary" className="text-xs">{a.context}</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{a.detail}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: cs })}
                  </p>
                </div>
                {!a.resolved && (
                  <Button size="sm" variant="ghost" onClick={() => resolve(a.id)} title="Vyřešeno">
                    <Check className="w-4 h-4" />
                  </Button>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};

export default ClassAlertsPanel;
