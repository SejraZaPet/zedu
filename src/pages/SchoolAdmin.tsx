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
import { Home, LogOut, School as SchoolIcon, Users, GraduationCap, Plus, ShieldCheck, ShieldOff, Copy, RefreshCw, KeyRound, Palette, Upload, UserMinus, Loader2, LayoutDashboard } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import SchoolBrandingSection from "@/components/school/SchoolBrandingSection";
import SchoolBulkImportCard from "@/components/school/SchoolBulkImportCard";
import SchoolCreatorSalesCard from "@/components/school/SchoolCreatorSalesCard";
import SchoolLeadershipCard from "@/components/school/SchoolLeadershipCard";
import SchoolLicenseCard from "@/components/school/SchoolLicenseCard";
import SchoolResourcesManager from "@/components/school/SchoolResourcesManager";
import SchoolOverviewTab from "@/components/school/SchoolOverviewTab";
import SchoolViewSwitcher from "@/components/school/SchoolViewSwitcher";

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
  const [pendingRemove, setPendingRemove] = useState<MemberRow | null>(null);
  const [removing, setRemoving] = useState(false);

  const [createdCredentials, setCreatedCredentials] = useState<{
    name: string;
    email?: string;
    password?: string;
    username?: string;
    studentCode?: string;
    pin?: string;
  } | null>(null);


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

  const copyInviteLink = async () => {
    if (!school?.registration_code) return;
    const url = `${window.location.origin}/auth?role=teacher&skola=${encodeURIComponent(school.registration_code)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Odkaz zkopírován", description: "Pozvánkový odkaz je ve schránce." });
    } catch {
      toast({ title: "Chyba", description: "Nepodařilo se zkopírovat odkaz.", variant: "destructive" });
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
    if (!school) return;
    if (!invFirst.trim() || !invLast.trim()) {
      toast({ title: "Vyplňte jméno a příjmení", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    // Účet zakládá edge funkce create-school-user pod service-role klíčem.
    // Nepoužíváme veřejný signUp — ten by přepsal session přihlášeného správce školy.
    // Server si sám ověří roli school_admin a použije jeho vlastní school_id.
    const { data, error } = await supabase.functions.invoke("create-school-user", {
      body: {
        first_name: invFirst.trim(),
        last_name: invLast.trim(),
        email: invEmail.trim() || undefined,
        role: invRole,
      },
    });
    setSubmitting(false);

    const result = (data as any)?.results?.[0];
    if (error || (data as any)?.error || !result?.ok) {
      toast({
        title: "Uživatele nelze vytvořit",
        description: result?.error ?? (data as any)?.error ?? error?.message ?? "Neznámá chyba",
        variant: "destructive",
      });
      return;
    }

    setCreatedCredentials({
      name: result.name,
      email: result.email,
      password: result.password,
      username: result.username,
      studentCode: result.student_code,
      pin: result.pin,
    });
    toast({
      title: "Účet vytvořen",
      description: invEmail.trim()
        ? `Přihlašovací údaje jsme poslali na ${result.email}.`
        : "Uživatel nemá e-mail — opište mu údaje ze zobrazené karty.",
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

  const confirmRemoveFromSchool = async () => {
    if (!pendingRemove) return;
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
      description: `${pendingRemove.first_name} ${pendingRemove.last_name} už není napojen na školu. Účet zůstává zachován.`,
    });
    setPendingRemove(null);
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
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={copyCode} disabled={!school.registration_code}>
                <Copy className="w-4 h-4 mr-1" /> Kopírovat kód
              </Button>
              <Button variant="outline" size="sm" onClick={copyInviteLink} disabled={!school.registration_code}>
                <Copy className="w-4 h-4 mr-1" /> Kopírovat pozvánkový odkaz
              </Button>
              <Button variant="outline" size="sm" onClick={regenerateCode}>
                <RefreshCw className="w-4 h-4 mr-1" /> Regenerovat
              </Button>
            </div>
          </CardContent>
        </Card>

        {createdCredentials && (
          <Card className="mb-6 border-primary/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Přihlašovací údaje: {createdCredentials.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {createdCredentials.email && <p><strong>E-mail:</strong> {createdCredentials.email}</p>}
              {createdCredentials.username && <p><strong>Uživatelské jméno:</strong> {createdCredentials.username}</p>}
              {createdCredentials.password && (
                <p><strong>Heslo:</strong> <span className="font-mono">{createdCredentials.password}</span></p>
              )}
              {createdCredentials.studentCode && <p><strong>Kód žáka:</strong> {createdCredentials.studentCode}</p>}
              {createdCredentials.pin && <p><strong>PIN:</strong> {createdCredentials.pin}</p>}
              <p className="text-xs text-muted-foreground pt-2">
                Údaje si opište — po zavření karty je znovu nezobrazíme.
              </p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => setCreatedCredentials(null)}>
                Zavřít
              </Button>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="overview">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="overview"><LayoutDashboard className="w-4 h-4 mr-1" /> Přehled</TabsTrigger>
            <TabsTrigger value="teachers"><GraduationCap className="w-4 h-4 mr-1" /> Učitelé ({teachers.length})</TabsTrigger>
            <TabsTrigger value="students"><Users className="w-4 h-4 mr-1" /> Studenti ({students.length})</TabsTrigger>
            <TabsTrigger value="import"><Upload className="w-4 h-4 mr-1" /> Hromadný import</TabsTrigger>
            <TabsTrigger value="resources">Místnosti a inventář</TabsTrigger>
            <TabsTrigger value="license">Licence</TabsTrigger>
            <TabsTrigger value="sales">Tvorba a prodej</TabsTrigger>
            <TabsTrigger value="branding"><Palette className="w-4 h-4 mr-1" /> Branding</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <SchoolOverviewTab schoolId={school.id} />
          </TabsContent>

          <TabsContent value="teachers">
            <MembersTable rows={teachers} onToggleRole={toggleRole} onRemove={setPendingRemove} kind="teacher" />
            <SchoolLeadershipCard schoolId={school.id} />
          </TabsContent>
          <TabsContent value="students">
            <MembersTable rows={students} onToggleRole={toggleRole} onRemove={setPendingRemove} kind="user" />
          </TabsContent>

          <TabsContent value="import">
            <SchoolBulkImportCard onImported={load} />
          </TabsContent>

          <TabsContent value="resources">
            <SchoolResourcesManager schoolId={school.id} />
          </TabsContent>

          <TabsContent value="license">
            <SchoolLicenseCard schoolId={school.id} />
          </TabsContent>
          <TabsContent value="sales">
            <SchoolCreatorSalesCard schoolId={school.id} />
          </TabsContent>
          <TabsContent value="branding">
            <SchoolBrandingSection schoolId={school.id} schoolName={school.name} />
          </TabsContent>
        </Tabs>

        <AlertDialog open={!!pendingRemove} onOpenChange={(o) => { if (!o) setPendingRemove(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Odebrat uživatele ze školy?</AlertDialogTitle>
              <AlertDialogDescription>
                {pendingRemove ? `${pendingRemove.first_name} ${pendingRemove.last_name} ztratí napojení na školu ${school.name}. ` : ""}
                Účet i data zůstanou zachovány, ale uživatel přijde o přístup k obsahu školy.
                Zpět to lze vrátit jen ručním opětovným přiřazením.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Zrušit</AlertDialogCancel>
              <AlertDialogAction onClick={(e) => { e.preventDefault(); void confirmRemoveFromSchool(); }} disabled={removing}>
                {removing && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Odebrat ze školy
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
        <SchoolViewSwitcher />
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
  onRemove: (member: MemberRow) => void;
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
                  <Button size="sm" variant="outline" onClick={() => onRemove(m)}>
                    <UserMinus className="w-4 h-4 mr-1 text-destructive" /> Odebrat ze školy
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
