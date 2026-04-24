import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Ban, UserCheck, Shield, Search, UserPlus, CheckCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import UserDetailDialog from "./UserDetailDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  school: string;
  field_of_study: string;
  year: number | null;
  status: string;
  created_at: string;
  role?: string;
}

const statusLabels: Record<string, string> = {
  pending: "Čeká na schválení",
  approved: "Schválený",
  blocked: "Zablokovaný",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  approved: "bg-green-500/20 text-green-400 border-green-500/30",
  blocked: "bg-red-500/20 text-red-400 border-red-500/30",
};

const UsersManager = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSchool, setFilterSchool] = useState<string>("all");
  const [filterField, setFilterField] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    first_name: "",
    last_name: "",
    email: "",
    school: "",
    year: "",
    role: "user",
  });
  const [creating, setCreating] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) ?? []);

    const enriched = (profiles ?? []).map(p => ({
      ...p,
      status: p.status as string,
      role: roleMap.get(p.id) || "user",
    }));

    setUsers(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  // Derive unique filter options from data
  const schools = useMemo(() => [...new Set(users.map(u => u.school).filter(Boolean))].sort(), [users]);
  const fields = useMemo(() => [...new Set(users.map(u => u.field_of_study).filter(Boolean))].sort(), [users]);
  const years = useMemo(() => [...new Set(users.map(u => u.year).filter((y): y is number => y !== null))].sort(), [users]);

  const updateStatus = async (userId: string, newStatus: string) => {
    const { error } = await supabase
      .from("profiles")
      .update({ status: newStatus as any })
      .eq("id", userId);

    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Uloženo", description: `Stav uživatele změněn na: ${statusLabels[newStatus]}` });
    fetchUsers();
  };

  const filtered = users.filter(u => {
    const matchesSearch = !search ||
      `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === "all" || u.status === filterStatus;
    const matchesSchool = filterSchool === "all" || u.school === filterSchool;
    const matchesField = filterField === "all" || u.field_of_study === filterField;
    const matchesYear = filterYear === "all" || String(u.year) === filterYear;
    return matchesSearch && matchesStatus && matchesSchool && matchesField && matchesYear;
  });

  if (loading) return <div className="text-muted-foreground p-4">Načítání uživatelů...</div>;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Hledat jméno nebo e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Stav" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Všechny stavy</SelectItem>
            <SelectItem value="pending">Čeká na schválení</SelectItem>
            <SelectItem value="approved">Schválený</SelectItem>
            <SelectItem value="blocked">Zablokovaný</SelectItem>
          </SelectContent>
        </Select>
        {schools.length > 0 && (
          <Select value={filterSchool} onValueChange={setFilterSchool}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Škola" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny školy</SelectItem>
              {schools.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {fields.length > 0 && (
          <Select value={filterField} onValueChange={setFilterField}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Obor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny obory</SelectItem>
              {fields.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {years.length > 0 && (
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Ročník" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny ročníky</SelectItem>
              {years.map(y => <SelectItem key={y} value={String(y)}>{y}. ročník</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Button onClick={() => setAddUserOpen(true)} className="gap-2">
          <UserPlus className="w-4 h-4" />
          Přidat žáka
        </Button>
      </div>

      <div className="text-sm text-muted-foreground">
        Celkem: {filtered.length} uživatel{filtered.length === 1 ? "" : filtered.length < 5 ? "é" : "ů"}
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Jméno a příjmení</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Škola</TableHead>
              <TableHead>Obor</TableHead>
              <TableHead className="text-center">Ročník</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Stav</TableHead>
              <TableHead>Registrace</TableHead>
              <TableHead className="text-right">Akce</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((user) => (
              <TableRow key={user.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedUser(user); setDetailOpen(true); }}>
                <TableCell className="font-medium whitespace-nowrap">
                  {user.first_name} {user.last_name}
                </TableCell>
                <TableCell className="text-muted-foreground">{user.email}</TableCell>
                <TableCell className="text-muted-foreground">{user.school || "–"}</TableCell>
                <TableCell className="text-muted-foreground">{user.field_of_study || "–"}</TableCell>
                <TableCell className="text-center text-muted-foreground">{user.year ?? "–"}</TableCell>
                <TableCell>
                  {user.role === "admin" ? (
                    <Badge variant="outline" className="text-xs border-primary/50 text-primary">
                      <Shield className="w-3 h-3 mr-1" /> Admin
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">Student</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-xs ${statusColors[user.status] || ""}`}>
                    {statusLabels[user.status] || user.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(user.created_at).toLocaleDateString("cs-CZ")}
                </TableCell>
                <TableCell className="text-right">
                  {user.role !== "admin" && (
                    <div className="flex gap-1 justify-end">
                      {user.status !== "approved" && (
                        <Button size="sm" variant="ghost" onClick={() => updateStatus(user.id, "approved")}
                          className="text-green-400 hover:bg-green-500/10 h-8 px-2">
                          <UserCheck className="w-4 h-4" />
                        </Button>
                      )}
                      {user.status !== "blocked" && (
                        <Button size="sm" variant="ghost" onClick={() => updateStatus(user.id, "blocked")}
                          className="text-red-400 hover:bg-red-500/10 h-8 px-2">
                          <Ban className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  Žádní uživatelé nenalezeni.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <UserDetailDialog
        user={selectedUser}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdated={fetchUsers}
      />

      <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Přidat nového žáka</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Jméno *</Label>
                <Input
                  value={newUser.first_name}
                  onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })}
                  placeholder="Jan"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Příjmení *</Label>
                <Input
                  value={newUser.last_name}
                  onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })}
                  placeholder="Novák"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>E-mail (volitelný)</Label>
              <Input
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                placeholder="jan.novak@skola.cz"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Pokud žák nemá email, nechte prázdné – systém vygeneruje přihlašovací kód.
              </p>
            </div>
            <div>
              <Label>Škola</Label>
              <Input
                value={newUser.school}
                onChange={(e) => setNewUser({ ...newUser, school: e.target.value })}
                placeholder="ZŠ Brno"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Ročník</Label>
              <Select value={newUser.year} onValueChange={(v) => setNewUser({ ...newUser, year: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Vyberte ročník" />
                </SelectTrigger>
                <SelectContent>
                  {[1,2,3,4,5,6,7,8,9].map(y => (
                    <SelectItem key={y} value={String(y)}>{y}. ročník</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Role</Label>
              <Select value={newUser.role} onValueChange={(v) => setNewUser({ ...newUser, role: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Žák</SelectItem>
                  <SelectItem value="teacher">Učitel</SelectItem>
                  <SelectItem value="lektor">Lektor</SelectItem>
                  <SelectItem value="parent">Rodič</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddUserOpen(false)}>Zrušit</Button>
            <Button
              disabled={creating || !newUser.first_name || !newUser.last_name}
              onClick={async () => {
                setCreating(true);
                try {
                  const email = newUser.email ||
                    `${newUser.first_name.toLowerCase()}.${newUser.last_name.toLowerCase()}.${Date.now()}@zedu-student.cz`;
                  const password = Math.random().toString(36).slice(-8) + "Aa1!";

                  const { data: authData, error: authError } = await supabase.functions.invoke("create-user", {
                    body: { email, password, role: newUser.role }
                  });

                  if (authError) throw authError;

                  const userId = authData?.user?.id || authData?.id;
                  if (!userId) throw new Error("Nepodařilo se vytvořit účet");

                  await supabase.from("profiles").upsert({
                    id: userId,
                    first_name: newUser.first_name,
                    last_name: newUser.last_name,
                    email: email,
                    school: newUser.school,
                    year: newUser.year ? parseInt(newUser.year) : null,
                    status: "approved" as any,
                  });

                  await supabase.from("user_roles").insert({
                    user_id: userId,
                    role: newUser.role as any,
                  });

                  toast({
                    title: "Žák přidán",
                    description: `Účet pro ${newUser.first_name} ${newUser.last_name} byl vytvořen. ${!newUser.email ? `Přihlašovací email: ${email}` : ""}`
                  });

                  setAddUserOpen(false);
                  setNewUser({ first_name: "", last_name: "", email: "", school: "", year: "", role: "user" });
                  fetchUsers();
                } catch (e: any) {
                  toast({ title: "Chyba", description: e.message, variant: "destructive" });
                } finally {
                  setCreating(false);
                }
              }}
            >
              {creating ? "Vytváření..." : "Vytvořit účet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersManager;
