import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";

type AuditRow = {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, any> | null;
  created_at: string;
};

type ProfileMini = { id: string; first_name: string | null; last_name: string | null; email: string | null };

const PAGE_SIZE = 25;

const ACTION_LABELS: Record<string, string> = {
  user_created: "Vytvoření uživatele",
  user_deleted: "Smazání uživatele",
  user_status_changed: "Změna stavu uživatele",
  password_reset: "Reset hesla",
  class_created: "Vytvoření třídy",
  class_updated: "Úprava třídy",
  class_deleted: "Smazání třídy",
  class_archived: "Archivace třídy",
  assignment_created: "Vytvoření úkolu",
};

const actionTone = (action: string): "create" | "delete" | "update" | "neutral" => {
  if (action.includes("created")) return "create";
  if (action.includes("deleted")) return "delete";
  if (action.includes("updated") || action.includes("changed") || action.includes("reset") || action.includes("archived")) return "update";
  return "neutral";
};

const toneClasses: Record<string, string> = {
  create: "bg-green-500/15 text-green-400 border-green-500/30",
  delete: "bg-red-500/15 text-red-400 border-red-500/30",
  update: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  neutral: "bg-muted text-muted-foreground border-border",
};

export default function AuditLogViewer() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileMini>>({});
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [knownActions, setKnownActions] = useState<string[]>([]);

  const fetchKnownActions = async () => {
    const { data } = await supabase
      .from("audit_log" as any)
      .select("action")
      .order("created_at", { ascending: false })
      .limit(500);
    const set = new Set<string>();
    (data as any[] | null)?.forEach((r) => r.action && set.add(r.action));
    setKnownActions(Array.from(set).sort());
  };

  const fetchPage = async () => {
    setLoading(true);
    try {
      let q = supabase
        .from("audit_log" as any)
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (actionFilter !== "all") {
        q = q.eq("action", actionFilter);
      }

      const { data, count, error } = await q;
      if (error) {
        console.error(error);
        setRows([]);
        setTotal(0);
        return;
      }
      const list = (data as any as AuditRow[]) ?? [];
      setRows(list);
      setTotal(count ?? 0);

      // Fetch actor profiles
      const actorIds = Array.from(new Set(list.map(r => r.actor_id).filter(Boolean) as string[]));
      if (actorIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email")
          .in("id", actorIds);
        const map: Record<string, ProfileMini> = {};
        (profs ?? []).forEach((p: any) => { map[p.id] = p; });
        setProfiles((prev) => ({ ...prev, ...map }));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchKnownActions(); }, []);
  useEffect(() => { fetchPage(); /* eslint-disable-next-line */ }, [page, actionFilter]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const formatActor = (id: string | null) => {
    if (!id) return <span className="text-muted-foreground italic">Systém</span>;
    const p = profiles[id];
    if (!p) return <span className="text-xs font-mono">{id.slice(0, 8)}…</span>;
    const name = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
    return name || p.email || id.slice(0, 8);
  };

  const formatTarget = (r: AuditRow) => {
    if (!r.target_type) return "—";
    return (
      <span className="text-sm">
        <span className="text-muted-foreground">{r.target_type}</span>
        {r.target_id ? <span className="font-mono text-xs ml-1">{r.target_id.slice(0, 8)}…</span> : null}
      </span>
    );
  };

  const formatDetails = (d: Record<string, any> | null) => {
    if (!d || Object.keys(d).length === 0) return <span className="text-muted-foreground">—</span>;
    return (
      <code className="text-xs text-muted-foreground line-clamp-2 break-all">
        {JSON.stringify(d)}
      </code>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="font-heading text-xl">Audit log</h2>
        <div className="flex items-center gap-2">
          <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Filtr akce" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny akce</SelectItem>
              {knownActions.map((a) => (
                <SelectItem key={a} value={a}>{ACTION_LABELS[a] ?? a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" onClick={fetchPage} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 whitespace-nowrap">Datum</th>
                <th className="text-left px-3 py-2">Uživatel</th>
                <th className="text-left px-3 py-2">Akce</th>
                <th className="text-left px-3 py-2">Cíl</th>
                <th className="text-left px-3 py-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Žádné záznamy.</td></tr>
              )}
              {rows.map((r) => {
                const tone = actionTone(r.action);
                return (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("cs-CZ")}
                    </td>
                    <td className="px-3 py-2">{formatActor(r.actor_id)}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={toneClasses[tone]}>
                        {ACTION_LABELS[r.action] ?? r.action}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">{formatTarget(r)}</td>
                    <td className="px-3 py-2 max-w-[280px]">{formatDetails(r.details)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Celkem: {total} {total === 1 ? "záznam" : total < 5 ? "záznamy" : "záznamů"}
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0 || loading}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Strana {page + 1} / {totalPages}
          </span>
          <Button size="sm" variant="outline" onClick={() => setPage(p => p + 1)} disabled={page + 1 >= totalPages || loading}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
