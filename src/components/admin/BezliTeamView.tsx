import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import UserStaffRoleSection from "./UserStaffRoleSection";
import StaffTaskDialog from "./StaffTaskDialog";
import { UserCog, UserPlus, ShieldCheck, Mail, ClipboardList } from "lucide-react";



interface TeamRow {
  id: string;
  profile_id: string;
  position: string | null;
  active: boolean;
  work_email: string | null;
  name: string;
  email: string;
}

interface AdminRow {
  profile_id: string;
  name: string;
  email: string;
}

interface SearchRow {
  id: string;
  name: string;
  email: string;
}

const fullName = (p: any) => `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim() || "—";

/** Přehled interního týmu Bezli (admini + uživatelé se záznamem ve staff_members). */
const BezliTeamView = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<TeamRow[]>([]);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ profile_id: string; name: string } | null>(null);
  const [taskFor, setTaskFor] = useState<{ profile_id: string; name: string } | null>(null);


  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [inviteFirst, setInviteFirst] = useState("");
  const [inviteLast, setInviteLast] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);


  const load = async () => {
    setLoading(true);
    const [{ data: staff }, { data: adminRoles }] = await Promise.all([
      supabase.from("staff_members").select("id, profile_id, position, active, work_email"),
      supabase.from("user_roles").select("user_id").eq("role", "admin"),
    ]);

    const adminIds = Array.from(new Set((adminRoles ?? []).map((r: any) => r.user_id)));
    const ids = Array.from(new Set([...(staff ?? []).map((s) => s.profile_id), ...adminIds]));
    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("id, first_name, last_name, email").in("id", ids)
      : { data: [] as any[] };
    const byId = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    setAdmins(
      adminIds
        .map((id) => ({ profile_id: id, name: fullName(byId.get(id)), email: byId.get(id)?.email ?? "—" }))
        .sort((a, b) => a.name.localeCompare(b.name, "cs")),
    );

    setRows(
      (staff ?? [])
        .map((s) => {
          const p = byId.get(s.profile_id);
          return {
            id: s.id,
            profile_id: s.profile_id,
            position: s.position,
            active: s.active,
            work_email: s.work_email,
            name: fullName(p),
            email: p?.email ?? "—",
          };
        })
        .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "cs")),
    );
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  // Vyhledávání uživatelů pro přidání do týmu
  useEffect(() => {
    if (!addOpen) return;
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .or(`email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
        .limit(10);
      if (cancelled) return;
      const existing = new Set(rows.map((r) => r.profile_id));
      setResults(
        (data ?? [])
          .filter((p: any) => !existing.has(p.id))
          .map((p: any) => ({ id: p.id, name: fullName(p), email: p.email ?? "—" })),
      );
      setSearching(false);
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, addOpen, rows]);

  const addToTeam = async (u: SearchRow) => {
    setAdding(true);
    const { error } = await supabase.from("staff_members").insert({ profile_id: u.id, active: true });
    setAdding(false);
    if (error) {
      toast({ title: "Přidání do týmu selhalo", description: error.message, variant: "destructive" });
      return;
    }
    setAddOpen(false);
    setQuery("");
    setResults([]);
    await load();
    setEditing({ profile_id: u.id, name: u.name });
  };

  const inviteNew = async () => {
    const first = inviteFirst.trim();
    const last = inviteLast.trim();
    const email = inviteEmail.trim();
    if (!first || !last || !email) {
      toast({ title: "Vyplňte jméno, příjmení a e-mail", variant: "destructive" });
      return;
    }
    setInviting(true);
    const { data, error } = await supabase.functions.invoke("invite-team-member", {
      body: { email, firstName: first, lastName: last },
    });
    setInviting(false);
    if (error || (data as any)?.error) {
      toast({
        title: "Pozvánku nelze odeslat",
        description: (data as any)?.error ?? error?.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Pozvánka odeslána", description: `E-mail byl odeslán na ${email}.` });
    setAddOpen(false);
    setInviteFirst("");
    setInviteLast("");
    setInviteEmail("");
    await load();
    setEditing({ profile_id: (data as any).profile_id, name: `${first} ${last}` });
  };


  if (loading) return <p className="text-muted-foreground p-4">Načítání týmu…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-muted-foreground">Tým Bezli</h3>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <UserPlus className="w-4 h-4 mr-1" /> Přidat do týmu
        </Button>
      </div>

      <section className="space-y-2">
        <h4 className="font-semibold">Administrátoři</h4>
        {admins.length === 0 ? (
          <p className="text-sm text-muted-foreground">Žádní administrátoři.</p>
        ) : (
          <div className="rounded-md border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jméno</TableHead>
                  <TableHead>Přístup</TableHead>
                  <TableHead className="text-right">Akce</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((a) => (
                  <TableRow key={a.profile_id}>
                    <TableCell>
                      <div className="font-medium">{a.name}</div>
                      <div className="text-xs text-muted-foreground">{a.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">
                        <ShieldCheck className="w-3 h-3 mr-1" /> Plný přístup
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setTaskFor({ profile_id: a.profile_id, name: a.name })}>
                        <ClipboardList className="w-4 h-4 mr-1" /> Přiřadit úkol
                      </Button>
                    </TableCell>
                  </TableRow>

                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h4 className="font-semibold">Zaměstnanci s omezenými právy</h4>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Zatím žádní interní pracovníci. Přidejte je tlačítkem „Přidat do týmu“ nebo v detailu uživatele v pohledu „Uživatelé organizací“.
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
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={() => setTaskFor({ profile_id: r.profile_id, name: r.name })}>
                        <ClipboardList className="w-4 h-4 mr-1" /> Přiřadit úkol
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditing({ profile_id: r.profile_id, name: r.name })}>
                        <UserCog className="w-4 h-4 mr-1" /> Upravit roli a oprávnění
                      </Button>
                    </TableCell>

                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) { setQuery(""); setResults([]); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Přidat uživatele do týmu Bezli</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="existing">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="existing">Hledat existujícího</TabsTrigger>
              <TabsTrigger value="invite">Pozvat nového</TabsTrigger>
            </TabsList>

            <TabsContent value="existing" className="space-y-3 pt-3">
              <Input
                autoFocus
                placeholder="Hledat podle e-mailu nebo jména…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query.trim().length < 2 ? (
                <p className="text-xs text-muted-foreground">Zadejte alespoň 2 znaky.</p>
              ) : searching ? (
                <p className="text-xs text-muted-foreground">Hledám…</p>
              ) : results.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nikdo nenalezen.</p>
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border max-h-72 overflow-y-auto">
                  {results.map((u) => (
                    <li key={u.id} className="flex items-center justify-between gap-3 p-2">
                      <div>
                        <div className="text-sm font-medium">{u.name}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </div>
                      <Button size="sm" variant="outline" disabled={adding} onClick={() => void addToTeam(u)}>
                        Přidat
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="invite" className="space-y-3 pt-3">
              <p className="text-xs text-muted-foreground">
                Vytvoříme nový účet a odešleme pozvánkový e-mail s odkazem pro nastavení hesla.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="invite-first">Jméno</Label>
                  <Input id="invite-first" value={inviteFirst} onChange={(e) => setInviteFirst(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="invite-last">Příjmení</Label>
                  <Input id="invite-last" value={inviteLast} onChange={(e) => setInviteLast(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="invite-email">E-mail</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <Button className="w-full" disabled={inviting} onClick={() => void inviteNew()}>
                <Mail className="w-4 h-4 mr-1" /> {inviting ? "Odesílám…" : "Odeslat pozvánku"}
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>


      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) { setEditing(null); void load(); } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing?.name} — pracovní role</DialogTitle>
          </DialogHeader>
          {editing && <UserStaffRoleSection userId={editing.profile_id} />}
        </DialogContent>
      </Dialog>

      {user && taskFor && (
        <StaffTaskDialog
          open={!!taskFor}
          onOpenChange={(o) => { if (!o) setTaskFor(null); }}
          assignedTo={taskFor.profile_id}
          assignedBy={user.id}
          assigneeName={taskFor.name}
        />
      )}
    </div>

  );
};

export default BezliTeamView;
