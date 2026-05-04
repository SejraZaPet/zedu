import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Plus, School as SchoolIcon, Trash2 } from "lucide-react";

interface School {
  id: string;
  name: string;
  created_at: string;
}

interface SchoolWithStats extends School {
  member_count: number;
  admin_count: number;
}

const SchoolsManager = () => {
  const { toast } = useToast();
  const [schools, setSchools] = useState<SchoolWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [schoolName, setSchoolName] = useState("");
  const [adminFirstName, setAdminFirstName] = useState("");
  const [adminLastName, setAdminLastName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const load = async () => {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from("schools")
      .select("id, name, created_at")
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

  return (
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
                <TableHead className="text-right">Členů</TableHead>
                <TableHead className="text-right">Adminů</TableHead>
                <TableHead className="text-right">Akce</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schools.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-right">{s.member_count}</TableCell>
                  <TableCell className="text-right">{s.admin_count}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => remove(s.id, s.name)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
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

export default SchoolsManager;
