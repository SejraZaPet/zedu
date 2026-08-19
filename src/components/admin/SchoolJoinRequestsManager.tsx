import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, Inbox, Loader2, X } from "lucide-react";

interface JoinRequest {
  id: string;
  user_id: string;
  school_name_text: string;
  message: string | null;
  created_at: string;
  requester?: { first_name: string | null; last_name: string | null; email: string | null };
}

interface Props {
  /** zkratka na formulář založení školy (scroll + otevření dialogu řeší rodič) */
  onCreateSchool?: (prefillName: string) => void;
}

const SchoolJoinRequestsManager = ({ onCreateSchool }: Props) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [rows, setRows] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("school_join_requests")
      .select("id, user_id, school_name_text, message, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) {
      toast({ title: "Chyba načítání žádostí", description: error.message, variant: "destructive" });
      setRows([]);
      setLoading(false);
      return;
    }
    const ids = (data ?? []).map((r) => r.user_id);
    const byId = new Map<string, JoinRequest["requester"]>();
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", ids);
      profs?.forEach((p: any) => byId.set(p.id, { first_name: p.first_name, last_name: p.last_name, email: p.email }));
    }
    setRows((data ?? []).map((r) => ({ ...r, requester: byId.get(r.user_id) })));
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolve = async (id: string, status: "approved" | "rejected") => {
    setBusyId(id);
    const { error } = await supabase
      .from("school_join_requests")
      .update({ status, resolved_at: new Date().toISOString(), resolved_by: user?.id ?? null })
      .eq("id", id);
    setBusyId(null);
    if (error) {
      toast({ title: "Uložení se nezdařilo", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: status === "approved" ? "Žádost schválena" : "Žádost zamítnuta",
      description:
        status === "approved"
          ? "Nezapomeňte školu založit a uživatele k ní napojit."
          : "Uživatel může podat novou žádost.",
    });
    load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Inbox className="w-5 h-5" /> Žádosti o připojení ke škole
          {rows.length > 0 && <Badge variant="secondary">{rows.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Načítám…</div>
        ) : rows.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Žádné čekající žádosti.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Žadatel</TableHead>
                <TableHead>Požadovaná škola</TableHead>
                <TableHead>Zpráva</TableHead>
                <TableHead className="text-right">Akce</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">
                      {`${r.requester?.first_name ?? ""} ${r.requester?.last_name ?? ""}`.trim() || "Neznámý uživatel"}
                    </div>
                    <div className="text-xs text-muted-foreground">{r.requester?.email ?? "—"}</div>
                  </TableCell>
                  <TableCell className="font-medium">{r.school_name_text}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[22rem] whitespace-pre-wrap">
                    {r.message || "—"}
                  </TableCell>
                  <TableCell className="text-right space-x-1 whitespace-nowrap">
                    <Button
                      size="sm"
                      disabled={busyId === r.id}
                      onClick={() => {
                        onCreateSchool?.(r.school_name_text);
                        void resolve(r.id, "approved");
                      }}
                    >
                      {busyId === r.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                      Schválit a založit školu
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === r.id}
                      onClick={() => void resolve(r.id, "rejected")}
                    >
                      <X className="w-4 h-4 mr-1" /> Zamítnout
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default SchoolJoinRequestsManager;
