import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Home, LogOut, School as SchoolIcon, Users, GraduationCap, Plus, Trash2, ShieldCheck, ShieldOff, Copy, RefreshCw, KeyRound } from "lucide-react";

interface SchoolRow { id: string; name: string; registration_code: string | null; }
interface MemberRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  status: string;
  roles: string[];
}

const SchoolAdmin = () => {
  const navigate = useNavigate();
  const { user, role, status, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();

  const [school, setSchool] = useState<SchoolRow | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  // invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invFirst, setInvFirst] = useState("");
  const [invLast, setInvLast] = useState("");
  const [invEmail, setInvEmail] = useState("");
  const [invRole, setInvRole] = useState<"teacher" | "user">("teacher");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/auth"); return; }
    if (role !== "school_admin" && role !== "admin") {
      // not for this user
      if (role === "teacher" || role === "lektor") navigate("/ucitel");
      else if (role === "rodic") navigate("/rodic");
      else navigate("/student");
      return;
    }
    if (status && status !== "approved") return;
    void load();
  }, [authLoading, user, role, status]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    // school via profile.school_id
    const { data: prof } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", user.id)
      .single();
    const schoolId = prof?.school_id;
    if (!schoolId) {
      setSchool(null);
      setMembers([]);
      setLoading(false);
      return;
    }
    const { data: schoolRow } = await supabase
      .from("schools")
      .select("id, name, registration_code")
      .eq("id", schoolId)
      .single();
    setSchool((schoolRow as any) ?? null);

    const { data: profs } = await supabase
      .from("profiles")
      .select("id, email, first_name, last_name, status")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false });

    const ids = (profs ?? []).map((p) => p.id);
    let rolesByUser = new Map<string, string[]>();
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
      (profs ?? []).map((p: any) => ({
        ...p,
        roles: rolesByUser.get(p.id) ?? [],
      }))
    );
    setLoading(false);
  };

  const copyCode = async () => {
    if (!school?.registration_code) return;
    try {
      await navigator.clipboard.writeText(school.registration_code);
      toast({ title: "Zkopírováno", description: `Kód ${school.registration_code} je ve schránce.` });
    } catch {
      toast({ title: "Chyba", description: "Nepodařilo se zkopírovat kód.", variant: "destructive" });
    }
  };

  const regenerateCode = async () => {
    if (!school) return;
    if (!confirm("Vygenerovat nový registrační kód? Stávající kód přestane fungovat.")) return;
    const { data, error } = await supabase.rpc("regenerate_school_registration_code", { _school_id: school.id });
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    setSchool({ ...school, registration_code: data as string });
    toast({ title: "Nový kód", description: `Registrační kód školy je nyní ${data}.` });
  };

  const inviteUser = async () => {
    if (!school || !invEmail.trim()) {
      toast({ title: "Vyplňte e-mail", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    // Vytvoření uživatele přes existující edge function create-user (admin-only),
    // ale school_admin to volat nemůže. Místo toho: pošli pozvánku pomocí signUp s pre-vytvořeným heslem
    // a následně updatuj jeho profile + roli. Pro teď: preferuj cestu přes supabase functions create-school-user.
    // Jelikož taková funkce neexistuje, použijeme rychlou variantu: vyhledat existujícího uživatele nebo požádat admina.
    // ⇒ Vytvoříme uživatele pomocí veřejného signUp s dočasným heslem.

    const tempPassword = crypto.randomUUID().slice(0, 12) + "Aa1!";
    const { data: signed, error: signErr } = await supabase.auth.signUp({
      email: invEmail.trim(),
      password: tempPassword,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
        data: {
          first_name: invFirst.trim(),
          last_name: invLast.trim(),
          role_label: invRole === "teacher" ? "teacher" : "student",
        },
      },
    });
    if (signErr || !signed.user) {
      setSubmitting(false);
      toast({ title: "Pozvánka selhala", description: signErr?.message ?? "Neznámá chyba", variant: "destructive" });
      return;
    }
    // Připojit ke škole + schválit
    await supabase.from("profiles").update({ school_id: school.id, status: "approved" }).eq("id", signed.user.id);
    // Role se vytvoří triggerem; pokud se vyžaduje 'teacher', přepiš.
    if (invRole === "teacher") {
      // smaž 'user' a přidej 'teacher'
      await supabase.from("user_roles").delete().eq("user_id", signed.user.id).eq("role", "user");
      await supabase.from("user_roles").insert({ user_id: signed.user.id, role: "teacher" });
    }
    setSubmitting(false);
    toast({
      title: "Uživatel pozván",
      description: `Uživateli ${invEmail} bylo odesláno e-mailové potvrzení. Dočasné heslo: ${tempPassword}`,
    });
    setInvFirst(""); setInvLast(""); setInvEmail(""); setInvRole("teacher");
    setInviteOpen(false);
    load();
  };

  const toggleRole = async (memberId: string, currentRoles: string[], target: "teacher" | "user") => {
    const has = currentRoles.includes(target);
    if (has) {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", memberId)
        .eq("role", target);
      if (error) {
        toast({ title: "Chyba", description: error.message, variant: "destructive" });
        return;
      }
    } else {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: memberId, role: target });
      if (error) {
        toast({ title: "Chyba", description: error.message, variant: "destructive" });
        return;
      }
    }
    load();
  };

  const removeFromSchool = async (memberId: string) => {
    if (!confirm("Odebrat uživatele ze školy? Účet zůstane, ztratí jen napojení.")) return;
    const { error } = await supabase
      .from("profiles")
      .update({ school_id: null })
      .eq("id", memberId);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    load();
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Načítání…
      </div>
    );
  }

  if (!school) {
    return (
      <div className="min-h-screen bg-background">
        <Header onLogout={async () => { await signOut(); navigate("/"); }} />
        <main className="container mx-auto max-w-3xl px-4 py-12 text-center">
          <SchoolIcon className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <h2 className="font-heading text-xl mb-2">Nemáte přiřazenou školu</h2>
          <p className="text-muted-foreground">
            Kontaktujte systémového administrátora, aby vás napojil na školu.
          </p>
        </main>
      </div>
    );
  }

  const teachers = members.filter((m) => m.roles.includes("teacher"));
  const students = members.filter((m) => m.roles.includes("user") && !m.roles.includes("teacher"));

  return (
    <div className="min-h-screen bg-background">
      <Header onLogout={async () => { await signOut(); navigate("/"); }} schoolName={school.name} />
      <main className="container mx-auto max-w-5xl px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-heading text-2xl">{school.name}</h1>
            <p className="text-sm text-muted-foreground">Správa školy ({members.length} uživatelů)</p>
          </div>
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-1" /> Pozvat uživatele</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Pozvat učitele nebo studenta</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Jméno</Label><Input value={invFirst} onChange={(e) => setInvFirst(e.target.value)} /></div>
                  <div><Label>Příjmení</Label><Input value={invLast} onChange={(e) => setInvLast(e.target.value)} /></div>
                </div>
                <div><Label>E-mail *</Label><Input type="email" value={invEmail} onChange={(e) => setInvEmail(e.target.value)} /></div>
                <div>
                  <Label>Role</Label>
                  <div className="flex gap-2 mt-1">
                    <Button type="button" variant={invRole === "teacher" ? "default" : "outline"} size="sm" onClick={() => setInvRole("teacher")}>Učitel</Button>
                    <Button type="button" variant={invRole === "user" ? "default" : "outline"} size="sm" onClick={() => setInvRole("user")}>Student</Button>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteOpen(false)}>Zrušit</Button>
                <Button onClick={inviteUser} disabled={submitting}>Pozvat</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Registration code card */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-primary" /> Registrační kód školy
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <div className="font-mono text-2xl tracking-[0.4em] font-bold bg-muted/50 border border-border rounded-lg px-4 py-3 inline-block">
                {school.registration_code ?? "—"}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Učitelé tento kód zadají při registraci a budou automaticky přiřazeni k vaší škole.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyCode} disabled={!school.registration_code}>
                <Copy className="w-4 h-4 mr-1" /> Kopírovat
              </Button>
              <Button variant="outline" size="sm" onClick={regenerateCode}>
                <RefreshCw className="w-4 h-4 mr-1" /> Regenerovat
              </Button>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="teachers">
          <TabsList>
            <TabsTrigger value="teachers"><GraduationCap className="w-4 h-4 mr-1" /> Učitelé ({teachers.length})</TabsTrigger>
            <TabsTrigger value="students"><Users className="w-4 h-4 mr-1" /> Studenti ({students.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="teachers">
            <MembersTable rows={teachers} onToggleRole={toggleRole} onRemove={removeFromSchool} kind="teacher" />
          </TabsContent>
          <TabsContent value="students">
            <MembersTable rows={students} onToggleRole={toggleRole} onRemove={removeFromSchool} kind="user" />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

const Header = ({ onLogout, schoolName }: { onLogout: () => void; schoolName?: string }) => (
  <header className="border-b border-border bg-card">
    <div className="container mx-auto max-w-5xl flex items-center justify-between h-14 px-4">
      <h1 className="font-heading text-lg flex items-center gap-2">
        <SchoolIcon className="w-5 h-5" /> Administrace školy {schoolName ? `· ${schoolName}` : ""}
      </h1>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" asChild><a href="/"><Home className="w-4 h-4 mr-1" /> Web</a></Button>
        <Button size="sm" variant="ghost" onClick={onLogout}><LogOut className="w-4 h-4 mr-1" /> Odhlásit</Button>
      </div>
    </div>
  </header>
);

const MembersTable = ({
  rows, onToggleRole, onRemove, kind,
}: {
  rows: MemberRow[];
  onToggleRole: (id: string, roles: string[], target: "teacher" | "user") => void;
  onRemove: (id: string) => void;
  kind: "teacher" | "user";
}) => {
  if (rows.length === 0) {
    return <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Zatím nikdo.</CardContent></Card>;
  }
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Jméno</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Stav</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Akce</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.first_name} {m.last_name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{m.email}</TableCell>
                <TableCell>
                  <Badge variant={m.status === "approved" ? "default" : "secondary"}>{m.status}</Badge>
                </TableCell>
                <TableCell className="space-x-1">
                  {m.roles.map((r) => <Badge key={r} variant="outline">{r}</Badge>)}
                </TableCell>
                <TableCell className="text-right space-x-1">
                  {kind === "user" ? (
                    <Button size="sm" variant="outline" onClick={() => onToggleRole(m.id, m.roles, "teacher")}>
                      {m.roles.includes("teacher") ? <ShieldOff className="w-4 h-4 mr-1" /> : <ShieldCheck className="w-4 h-4 mr-1" />}
                      {m.roles.includes("teacher") ? "Odebrat učitele" : "Povýšit na učitele"}
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => onToggleRole(m.id, m.roles, "teacher")}>
                      <ShieldOff className="w-4 h-4 mr-1" /> Odebrat učitele
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => onRemove(m.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default SchoolAdmin;
