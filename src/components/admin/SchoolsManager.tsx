import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Pencil, Plus, School as SchoolIcon, Trash2, UserMinus, Users } from "lucide-react";


interface School {
  id: string;
  name: string;
  subdomain: string | null;
  custom_logo_url: string | null;
  custom_primary_color: string | null;
  custom_welcome_text: string | null;
  created_at: string;
}

interface SchoolWithStats extends School {
  member_count: number;
  admin_count: number;
}

interface SchoolMember {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  status: string | null;
  roles: string[];
}

const memberName = (m: SchoolMember) =>
  `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || m.email || "Uživatel";

const RESERVED_SUBDOMAINS = new Set(["www", "app", "id-preview", "preview", "zedu", "lovable", "staging"]);
const SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$/;

const subdomainOk = (s: string) => SUBDOMAIN_RE.test(s) && !RESERVED_SUBDOMAINS.has(s);


const emptySchool: School = {
  id: "",
  name: "",
  subdomain: "",
  custom_logo_url: "",
  custom_primary_color: "",
  custom_welcome_text: "",
  created_at: "",
};

const SchoolsManager = () => {
  const { toast } = useToast();
  const [schools, setSchools] = useState<SchoolWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [schoolName, setSchoolName] = useState("");
  const [adminFirstName, setAdminFirstName] = useState("");
  const [adminLastName, setAdminLastName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const [editing, setEditing] = useState<School>(emptySchool);

  // members management
  const [membersOpen, setMembersOpen] = useState(false);
  const [membersSchool, setMembersSchool] = useState<SchoolWithStats | null>(null);
  const [members, setMembers] = useState<SchoolMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<SchoolMember | null>(null);
  const [removing, setRemoving] = useState(false);

  const loadMembers = async (schoolId: string) => {
    setMembersLoading(true);
    const { data: profs, error } = await supabase
      .from("profiles")
      .select("id, email, first_name, last_name, status")
      .eq("school_id", schoolId)
      .order("last_name", { ascending: true });
    if (error) {
      toast({ title: "Chyba načítání členů", description: error.message, variant: "destructive" });
      setMembers([]);
      setMembersLoading(false);
      return;
    }
    const ids = (profs ?? []).map((p: any) => p.id);
    const rolesByUser = new Map<string, string[]>();
    if (ids.length) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", ids);
      roles?.forEach((r: any) => {
        const arr = rolesByUser.get(r.user_id) ?? [];
        arr.push(r.role);
        rolesByUser.set(r.user_id, arr);
      });
    }
    setMembers(
      (profs ?? []).map((p: any) => ({ ...p, roles: rolesByUser.get(p.id) ?? [] }))
    );
    setMembersLoading(false);
  };

  const openMembers = (school: SchoolWithStats) => {
    setMembersSchool(school);
    setMembersOpen(true);
    void loadMembers(school.id);
  };

  const confirmRemoveMember = async () => {
    if (!pendingRemove || !membersSchool) return;
    setRemoving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ school_id: null })
      .eq("id", pendingRemove.id);
    setRemoving(false);
    if (error) {
      toast({ title: "Odebrání se nezdařilo", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Uživatel odebrán ze školy",
      description: `${memberName(pendingRemove)} už není napojen na ${membersSchool.name}. Účet zůstává zachován.`,
    });
    setPendingRemove(null);
    await loadMembers(membersSchool.id);
    load();
  };


  const load = async () => {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from("schools")
      .select("id, name, subdomain, custom_logo_url, custom_primary_color, custom_welcome_text, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Chyba načítání", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    const ids = (rows ?? []).map((s) => s.id);
    let memberMap = new Map<string, number>();
    let adminMap = new Map<string, number>();
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, school_id")
        .in("school_id", ids);
      profs?.forEach((p: any) => {
        memberMap.set(p.school_id, (memberMap.get(p.school_id) ?? 0) + 1);
      });
      const profIds = (profs ?? []).map((p: any) => p.id);
      if (profIds.length) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", profIds)
          .eq("role", "school_admin");
        const sidByUser = new Map<string, string>();
        profs?.forEach((p: any) => sidByUser.set(p.id, p.school_id));
        roles?.forEach((r: any) => {
          const sid = sidByUser.get(r.user_id);
          if (sid) adminMap.set(sid, (adminMap.get(sid) ?? 0) + 1);
        });
      }
    }
    setSchools(
      (rows ?? []).map((s) => ({
        ...s,
        member_count: memberMap.get(s.id) ?? 0,
        admin_count: adminMap.get(s.id) ?? 0,
      }))
    );
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const reset = () => {
    setSchoolName("");
    setAdminFirstName("");
    setAdminLastName("");
    setAdminEmail("");
    setAdminPassword("");
  };

  const submit = async () => {
    if (!schoolName.trim() || !adminEmail.trim() || adminPassword.length < 8) {
      toast({ title: "Vyplňte všechna povinná pole", description: "Heslo musí mít alespoň 8 znaků.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("create-school", {
      body: {
        school_name: schoolName.trim(),
        admin_email: adminEmail.trim(),
        admin_password: adminPassword,
        admin_first_name: adminFirstName.trim(),
        admin_last_name: adminLastName.trim(),
      },
    });
    setSubmitting(false);
    if (error || (data as any)?.error) {
      toast({
        title: "Nepodařilo se vytvořit školu",
        description: (data as any)?.error ?? error?.message ?? "Neznámá chyba",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Škola vytvořena", description: `Administrátor byl pozván jako ${adminEmail}.` });
    reset();
    setOpen(false);
    load();
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Opravdu smazat školu „${name}"? Uživatelé zůstanou, jen ztratí napojení na školu.`)) return;
    const { error } = await supabase.from("schools").delete().eq("id", id);
    if (error) {
      toast({ title: "Chyba mazání", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Škola smazána" });
    load();
  };

  const openEdit = (school: SchoolWithStats) => {
    setEditing({ ...school });
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditing(emptySchool);
    setEditOpen(false);
  };

  const saveEdit = async () => {
    const name = editing.name.trim();
    const sub = (editing.subdomain ?? "").trim().toLowerCase();
    if (!name) {
      toast({ title: "Název školy je povinný", variant: "destructive" });
      return;
    }
    if (sub && !subdomainOk(sub)) {
      toast({ title: "Neplatná subdoména", description: "Pouze malá písmena, číslice a pomlčky (1–32 znaků).", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const updatePayload: Record<string, any> = {
      name,
      subdomain: sub || null,
      custom_logo_url: (editing.custom_logo_url ?? "").trim() || null,
      custom_primary_color: (editing.custom_primary_color ?? "").trim() || null,
      custom_welcome_text: (editing.custom_welcome_text ?? "").trim() || null,
    };
    const { error } = await supabase
      .from("schools")
      .update(updatePayload)
      .eq("id", editing.id);
    setSubmitting(false);
    if (error) {
      const msg = error.code === "23505"
        ? "Tato subdoména je už obsazena."
        : error.message;
      toast({ title: "Uložení se nezdařilo", description: msg, variant: "destructive" });
      return;
    }
    toast({ title: "Škola upravena", description: `Údaje pro ${name} byly uloženy.` });
    closeEdit();
    load();
  };

  return (
    <div className="space-y-6">
    <SchoolJoinRequestsManager
      onCreateSchool={(prefillName) => { setSchoolName(prefillName); setOpen(true); }}
    />
    <Card>

      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <SchoolIcon className="w-5 h-5" /> Školy
        </CardTitle>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Nová škola</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Nová škola + administrátor</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Název školy *</Label>
                <Input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="Gymnázium Praha 1" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Jméno admina</Label>
                  <Input value={adminFirstName} onChange={(e) => setAdminFirstName(e.target.value)} />
                </div>
                <div>
                  <Label>Příjmení admina</Label>
                  <Input value={adminLastName} onChange={(e) => setAdminLastName(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>E-mail admina *</Label>
                <Input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
              </div>
              <div>
                <Label>Heslo (min. 8 znaků) *</Label>
                <Input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Zrušit</Button>
              <Button onClick={submit} disabled={submitting}>
                {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Vytvořit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-muted-foreground text-sm py-6 text-center">Načítám…</div>
        ) : schools.length === 0 ? (
          <div className="text-muted-foreground text-sm py-6 text-center">Zatím žádné školy.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Název</TableHead>
                <TableHead>Subdoména</TableHead>
                <TableHead className="text-right">Členů</TableHead>
                <TableHead className="text-right">Adminů</TableHead>
                <TableHead className="text-right">Akce</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schools.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.subdomain ? `${s.subdomain}.zedu.cz` : "—"}</TableCell>
                  <TableCell className="text-right">{s.member_count}</TableCell>
                  <TableCell className="text-right">{s.admin_count}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openMembers(s)} title="Členové školy">
                        <Users className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(s)} title="Upravit">

                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(s.id, s.name)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Dialog open={editOpen} onOpenChange={(o) => { if (!o) closeEdit(); else setEditOpen(o); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Upravit školu</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label htmlFor="edit-name">Název školy *</Label>
                <Input
                  id="edit-name"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-subdomain">Subdoména</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    id="edit-subdomain"
                    value={editing.subdomain ?? ""}
                    onChange={(e) => setEditing({ ...editing, subdomain: e.target.value.toLowerCase() })}
                    placeholder="zs-brno"
                    maxLength={32}
                  />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">.zedu.cz</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Malá písmena, číslice a pomlčky. Nechte prázdné, pokud subdoména není potřeba.
                </p>
              </div>
              <div>
                <Label htmlFor="edit-logo">URL loga</Label>
                <Input
                  id="edit-logo"
                  value={editing.custom_logo_url ?? ""}
                  onChange={(e) => setEditing({ ...editing, custom_logo_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div>
                <Label htmlFor="edit-color">Primární barva</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    id="edit-color"
                    type="color"
                    value={editing.custom_primary_color || "#6EC6D9"}
                    onChange={(e) => setEditing({ ...editing, custom_primary_color: e.target.value })}
                    className="h-10 w-14 rounded border border-border cursor-pointer bg-transparent"
                  />
                  <Input
                    value={editing.custom_primary_color ?? ""}
                    onChange={(e) => setEditing({ ...editing, custom_primary_color: e.target.value })}
                    placeholder="#6EC6D9"
                    maxLength={7}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-welcome">Uvítací text</Label>
                <Input
                  id="edit-welcome"
                  value={editing.custom_welcome_text ?? ""}
                  onChange={(e) => setEditing({ ...editing, custom_welcome_text: e.target.value })}
                  placeholder="Vítejte v portálu školy."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeEdit}>Zrušit</Button>
              <Button onClick={saveEdit} disabled={submitting}>
                {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Uložit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Members of a school */}
        <Dialog open={membersOpen} onOpenChange={(o) => { setMembersOpen(o); if (!o) { setMembersSchool(null); setMembers([]); } }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Členové školy {membersSchool ? `· ${membersSchool.name}` : ""}</DialogTitle>
            </DialogHeader>
            {membersLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Načítám…</div>
            ) : members.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Škola nemá žádné napojené uživatele.</div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Jméno</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Akce</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{memberName(m)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{m.email ?? "—"}</TableCell>
                        <TableCell className="space-x-1">
                          {m.roles.length === 0
                            ? <span className="text-xs text-muted-foreground">—</span>
                            : m.roles.map((r) => <Badge key={r} variant="outline">{r}</Badge>)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => setPendingRemove(m)}>
                            <UserMinus className="w-4 h-4 mr-1" /> Odebrat ze školy
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!pendingRemove} onOpenChange={(o) => { if (!o) setPendingRemove(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Odebrat uživatele ze školy?</AlertDialogTitle>
              <AlertDialogDescription>
                {pendingRemove ? `${memberName(pendingRemove)} ztratí napojení na školu ${membersSchool?.name ?? ""}. ` : ""}
                Účet i data zůstanou zachovány, ale uživatel přijde o přístup k obsahu školy.
                Zpět to lze vrátit jen ručním opětovným přiřazením.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Zrušit</AlertDialogCancel>
              <AlertDialogAction onClick={(e) => { e.preventDefault(); void confirmRemoveMember(); }} disabled={removing}>
                {removing && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Odebrat ze školy
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>

    </Card>
    </div>

  );
};

export default SchoolsManager;
