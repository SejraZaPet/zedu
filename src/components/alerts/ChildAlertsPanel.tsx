import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, UserX, TrendingDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cs } from "date-fns/locale";

interface AlertRow {
  id: string;
  student_id: string;
  alert_type: "inactive" | "struggling_topic";
  context: string | null;
  detail: string;
  created_at: string;
  student?: { first_name: string; last_name: string } | null;
}

const typeMeta = {
  inactive: { Icon: UserX, label: "Neaktivita", color: "text-orange-600" },
  struggling_topic: { Icon: TrendingDown, label: "Zaostávání", color: "text-red-600" },
};

const ChildAlertsPanel = ({ studentIds }: { studentIds: string[] }) => {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (studentIds.length === 0) {
        setAlerts([]);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("student_alerts" as any)
        .select("id, student_id, alert_type, context, detail, created_at, student:profiles!student_alerts_student_id_fkey(first_name, last_name)")
        .in("student_id", studentIds)
        .eq("resolved", false)
        .order("created_at", { ascending: false })
        .limit(20);
      setAlerts((data as any) ?? []);
      setLoading(false);
    })();
  }, [JSON.stringify(studentIds)]);

  if (loading || alerts.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          Upozornění
          <Badge variant="destructive" className="ml-1">{alerts.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.map((a) => {
          const meta = typeMeta[a.alert_type];
          const Icon = meta.Icon;
          const name = a.student
            ? `${a.student.first_name ?? ""} ${a.student.last_name ?? ""}`.trim() || "Dítě"
            : "Dítě";
          return (
            <div key={a.id} className="flex items-start gap-3 rounded-lg border p-3 bg-background">
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
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default ChildAlertsPanel;
