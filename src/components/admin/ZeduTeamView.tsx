import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import UserStaffRoleSection from "./UserStaffRoleSection";
import { UserCog } from "lucide-react";

interface TeamRow {
  id: string;
  profile_id: string;
  position: string | null;
  active: boolean;
  work_email: string | null;
  name: string;
  email: string;
}

/** Přehled interního týmu ZEdu (uživatelé se záznamem ve staff_members). */
const ZeduTeamView = () => {
  const [rows, setRows] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<TeamRow | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: staff } = await supabase
      .from("staff_members")
      .select("id, profile_id, position, active, work_email");
    const ids = (staff ?? []).map((s) => s.profile_id);
    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("id, first_name, last_name, email").in("id", ids)
      : { data: [] as any[] };
    const byId = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    setRows(
      (staff ?? []).map((s) => {
        const p = byId.get(s.profile_id);
        return {
          id: s.id,
          profile_id: s.profile_id,
          position: s.position,
          active: s.active,
          work_email: s.work_email,
          name: p ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "—" : "—",
          email: p?.email ?? "—",
        };
      }).sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "cs")),
    );
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  if (loading) return <p className="text-muted-foreground p-4">Načítání týmu…</p>;

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Zatím žádní interní pracovníci. Pracovní roli zapnete v detailu uživatele v pohledu „Uživatelé organizací“.
        </p>
      ) : (
        <div className="rounded-md border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jméno</TableHead>
                <TableHead>Pozice</TableHead>
                <TableHead>Pracovní e-mail</TableHead>
                <TableHead>Stav</TableHead>
                <TableHead className="text-right">Akce</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                  </TableCell>
                  <TableCell>{r.position ?? "—"}</TableCell>
                  <TableCell>{r.work_email ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={r.active ? "default" : "secondary"}>
                      {r.active ? "Aktivní" : "Neaktivní"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setEditing(r)}>
                      <UserCog className="w-4 h-4 mr-1" /> Upravit roli a oprávnění
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) { setEditing(null); void load(); } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing?.name} — pracovní role</DialogTitle>
          </DialogHeader>
          {editing && <UserStaffRoleSection userId={editing.profile_id} />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ZeduTeamView;
