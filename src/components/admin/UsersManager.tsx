import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Ban, UserCheck, Shield, Search, UserPlus, CheckCheck, Upload, Trash2, KeyRound, Printer, CheckCircle2, Clock, RefreshCw } from "lucide-react";
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

import { printLoginCards, type LoginCardData } from "@/lib/generate-login-cards";
import bcrypt from "bcryptjs";
import { sendWelcomeEmail } from "@/lib/send-email";
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
  login_password?: string;
  username?: string;
  student_code?: string;
}

function generateUsername(firstName: string, lastName: string, existingUsernames: string[]): string {
  const normalize = (s: string) =>
    (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const initial = normalize(firstName).charAt(0);
  const last = normalize(lastName);
  const base = initial + last;
  if (!existingUsernames.includes(base)) return base;
  let n = 2;
  while (n < 100) {
    const v = base + n;
    if (!existingUsernames.includes(v)) return v;
    n++;
  }
  return base + Date.now();
}

const statusLabels: Record<string, string> = {
  pending: "Čeká na schválení",
  approved: "Schválený",
  blocked: "Zablokovaný",
};

const roleLabels: Record<string, string> = {
  admin: "Admin",
  teacher: "Učitel",
  lektor: "Lektor",
  rodic: "Rodič",
  parent: "Rodič",
  user: "Žák",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  approved: "bg-green-500/20 text-green-400 border-green-500/30",
  blocked: "bg-red-500/20 text-red-400 border-red-500/30",
};

function generateStudentEmail(
  firstName: string,
  lastName: string,
  existingEmails: string[],
  role: string
): string {
  const normalize = (s: string) =>
    (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

  const first = normalize(firstName) || "user";
  const last = normalize(lastName) || "user";
  const initial = first.charAt(0);
  const domain = (role === "teacher" || role === "lektor") ? "@zedu-lektor.cz" : "@zedu-student.cz";

  const v1 = `${first}.${last}${domain}`;
  if (!existingEmails.includes(v1)) return v1;

  const v2 = `${initial}${last}${domain}`;
  if (!existingEmails.includes(v2)) return v2;

  let n = 2;
  while (n < 100) {
    const v3 = `${first}.${last}${n}${domain}`;
    if (!existingEmails.includes(v3)) return v3;
    const v4 = `${initial}${last}${n}${domain}`;
    if (!existingEmails.includes(v4)) return v4;
    n++;
  }

  return `${first}.${last}.${Date.now()}${domain}`;
}

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
  const [printDialogUser, setPrintDialogUser] = useState<UserProfile | null>(null);
  const [printPassword, setPrintPassword] = useState("");
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    first_name: "",
    last_name: "",
    email: "",
    school: "",
    year: "",
    role: "user",
  });
  const [createParentAccount, setCreateParentAccount] = useState(false);
  const [parentEmail, setParentEmail] = useState("");
  const [isAdult, setIsAdult] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importedUsers, setImportedUsers] = useState<LoginCardData[]>([]);
  const [parentLinkMap, setParentLinkMap] = useState<Map<string, string>>(new Map());

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email, school, field_of_study, year, status, created_at, login_password, username, student_code, parent_email")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) ?? []);

    const { data: parentLinks } = await supabase
      .from("parent_student_links" as any)
      .select("parent_id, student_id");
    const profileNameMap = new Map((profiles ?? []).map(p => [p.id, `${p.first_name} ${p.last_name}`.trim()]));
    const linkMap = new Map<string, string>();
    ((parentLinks as any[]) || []).forEach((link: any) => {
      const studentName = profileNameMap.get(link.student_id) || "";
      if (!studentName) return;
      const existing = linkMap.get(link.parent_id);
      linkMap.set(link.parent_id, existing ? `${existing}, ${studentName}` : studentName);
    });
    setParentLinkMap(linkMap);

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
        <label className="inline-flex items-center gap-2 cursor-pointer px-4 py-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground text-sm font-medium transition-colors">
          <Upload className="w-4 h-4" />
          Hromadný import
          <input
            type="file"
            accept=".xlsx,.csv"
            className="sr-only"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              console.log("Soubor vybrán:", file?.name, file?.size, file?.type);
              if (!file) return;
              setImportFile(file);
              setImportErrors([]);
              setImportOpen(true);

              try {
                console.log("Začínám zpracování souboru...");
                let rows: any[] = [];

                if (file.name.endsWith(".csv")) {
                  const text = await file.text();
                  const lines = text.split("\n").filter(Boolean);
                  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/"/g, ""));
                  rows = lines.slice(1).map(line => {
                    const values = line.split(",").map(v => v.trim().replace(/"/g, ""));
                    return Object.fromEntries(headers.map((h, i) => [h, values[i] || ""]));
                  });
                } else {
                  const XLSX = await import("xlsx");
                  const buffer = await file.arrayBuffer();
                  const wb = XLSX.read(buffer, { type: "array" });
                  const ws = wb.Sheets[wb.SheetNames[0]];
                  const allRows = XLSX.utils.sheet_to_json(ws, { raw: false, defval: "", header: 1 }) as any[][];

                  let headerRowIndex = allRows.findIndex((row: any[]) =>
                    row.some((cell: any) => String(cell).toLowerCase().includes("jméno") || String(cell).toLowerCase().includes("jmeno"))
                  );
                  if (headerRowIndex === -1) headerRowIndex = 0;

                  const headers = allRows[headerRowIndex].map((h: any) =>
                    String(h)
                      .toLowerCase()
                      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                      .replace(/\s*\*/g, "")
                      .trim()
                      .replace(/\s+/g, "_")
                  );

                  const keyMap: Record<string, string> = {
                    "jmeno": "jmeno",
                    "prijmeni": "prijmeni",
                    "e-mail": "email",
                    "email": "email",
                    "e-mail_rodice": "email_rodice",
                    "email_rodice": "email_rodice",
                    "skola": "skola",
                    "trida": "trida",
                    "rocnik": "rocnik",
                    "role": "role",
                    "zletily": "zletily",
                    "zletilý": "zletily",
                    "zletila": "zletily",
                    "adult": "zletily",
                  };

                  rows = allRows
                    .slice(headerRowIndex + 1)
                    .map((row: any[]) => {
                      const obj: any = {};
                      headers.forEach((h: string, i: number) => {
                        const key = keyMap[h] || h;
                        obj[key] = row[i] != null ? String(row[i]).trim() : "";
                      });
                      return obj;
                    })
                    .filter((r: any) =>
                      r.jmeno &&
                      r.prijmeni &&
                      !r.jmeno.toLowerCase().includes("jméno") &&
                      !r.jmeno.toLowerCase().includes("křestní") &&
                      !r.jmeno.toLowerCase().includes("jmeno")
                    );
                }

                console.log("Řádky před filtrem:", rows.length, rows[0]);
                rows = rows.filter((r: any) => r.jmeno && r.prijmeni &&
                  !r.jmeno.toLowerCase().includes("křestní") &&
                  !r.jmeno.toLowerCase().includes("krestni") &&
                  !r.jmeno.toLowerCase().includes("vzorový") &&
                  !r.jmeno.toLowerCase().includes("vzorovy")
                );
                console.log("Řádky po filtru:", rows.length);
                setImportPreview(rows);
              } catch (err: any) {
                setImportErrors([`Chyba při čtení souboru: ${err.message}`]);
              }
            }}
          />
        </label>
      </div>

      {importedUsers.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
          <span className="text-sm text-green-400 font-medium">
            ✅ Import dokončen – {importedUsers.length} účtů vytvořeno
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-2" onClick={() => printLoginCards(importedUsers)}>
              🖨️ Tisknout přihlašovací lístky
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setImportedUsers([])}>
              Zavřít
            </Button>
          </div>
        </div>
      )}


      <div className="text-sm text-muted-foreground">
        Celkem: {filtered.length} uživatel{filtered.length === 1 ? "" : filtered.length < 5 ? "é" : "ů"}
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/30 rounded-lg">
          <span className="text-sm font-medium">{selectedIds.size} vybráno</span>
          <Button
            size="sm"
            onClick={async () => {
              try {
                const ids = Array.from(selectedIds);
                await Promise.all(ids.map(id =>
                  supabase.from("profiles").update({ status: "approved" as any }).eq("id", id)
                ));
                toast({ title: "Hotovo", description: `${ids.length} účtů bylo schváleno.` });
                setSelectedIds(new Set());
                fetchUsers();
              } catch (e: any) {
                toast({ title: "Chyba", description: e.message, variant: "destructive" });
              }
            }}
            className="gap-2"
          >
            <CheckCheck className="w-4 h-4" />
            Schválit vybrané
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-2 text-red-400 hover:bg-red-500/10"
            onClick={async () => {
              if (!confirm(`Opravdu smazat ${selectedIds.size} uživatelů?`)) return;
              try {
                const ids = Array.from(selectedIds);
                await Promise.all(ids.map(id => supabase.functions.invoke("delete-user", { body: { userId: id } })));
                ids.forEach(id => logAudit("user_deleted", "user", id, { bulk: true }));
                toast({ title: "Smazáno", description: `${ids.length} uživatelů bylo odstraněno.` });
                setSelectedIds(new Set());
                fetchUsers();
              } catch (e: any) {
                toast({ title: "Chyba", description: e.message, variant: "destructive" });
              }
            }}
          >
            <Trash2 className="w-4 h-4" />
            Smazat vybrané
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => {
              const selectedUsers = users.filter(u => selectedIds.has(u.id));
              const cards = selectedUsers.map(u => ({
                firstName: u.first_name || "",
                lastName: u.last_name || "",
                email: u.email || "",
                password: u.login_password || "–",
                role: u.role || "user",
                username: u.username || "",
                studentCode: u.role === "user" ? (u.student_code || "") : "",
              }));
              printLoginCards(cards);
            }}
          >
            <Printer className="w-4 h-4" />
            Tisknout štítky ({selectedIds.size})
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            Zrušit výběr
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="border border-border rounded-lg overflow-x-auto">
        <Table className="text-sm">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={filtered.length > 0 && selectedIds.size === filtered.length}
                  onCheckedChange={(v) => {
                    if (v) setSelectedIds(new Set(filtered.map(u => u.id)));
                    else setSelectedIds(new Set());
                  }}
                />
              </TableHead>
              <TableHead>Jméno</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead className="hidden lg:table-cell">Uživatelské jméno</TableHead>
              <TableHead className="hidden md:table-cell">Škola</TableHead>
              <TableHead className="hidden xl:table-cell">Obor</TableHead>
              <TableHead className="text-center">Ročník</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="w-8 text-center"><Shield className="w-4 h-4 inline" /></TableHead>
              <TableHead className="hidden lg:table-cell">Registrace</TableHead>
              <TableHead className="text-right">Akce</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((user) => (
              <TableRow key={user.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedUser(user); setDetailOpen(true); }}>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(user.id)}
                    onCheckedChange={(v) => {
                      const next = new Set(selectedIds);
                      if (v) next.add(user.id);
                      else next.delete(user.id);
                      setSelectedIds(next);
                    }}
                  />
                </TableCell>
                <TableCell className="font-medium whitespace-nowrap">
                  <div className="flex flex-col">
                    <span>{user.first_name || ""} {user.last_name || ""}</span>
                    {user.role === "rodic" && parentLinkMap.get(user.id) && (
                      <span className="text-xs text-muted-foreground">
                        👨‍👩‍👧 {parentLinkMap.get(user.id)}
                      </span>
                    )}
                  </div>
                </TableCell>
                {(() => { const emailShort = user.email?.split("@")[0] || "–"; return (
                  <TableCell className="text-muted-foreground max-w-[160px] truncate">
                    <span title={user.email}>{emailShort}</span>
                  </TableCell>
                ); })()}
                <TableCell className="hidden lg:table-cell text-xs font-mono text-muted-foreground">
                  {user.username || "–"}
                </TableCell>
                <TableCell className="text-muted-foreground hidden md:table-cell max-w-[100px] truncate">{user.school || "–"}</TableCell>
                <TableCell className="text-muted-foreground hidden xl:table-cell">{user.field_of_study || "–"}</TableCell>
                <TableCell className="text-center text-muted-foreground">{user.year ?? "–"}</TableCell>
                <TableCell>
                  {user.role === "admin" ? (
                    <Badge variant="outline" className="text-xs border-primary/50 text-primary">
                      <Shield className="w-3 h-3 mr-1" /> Admin
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">{roleLabels[user.role || "user"] || user.role}</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {user.status === "approved" && <CheckCircle2 className="w-4 h-4 text-green-500 inline" />}
                  {user.status === "pending" && <Clock className="w-4 h-4 text-yellow-500 inline" />}
                  {user.status === "blocked" && <Ban className="w-4 h-4 text-red-500 inline" />}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap hidden lg:table-cell">
                  {new Date(user.created_at).toLocaleDateString("cs-CZ", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                </TableCell>
                <TableCell className="text-right">
                  {user.role !== "admin" && (
                    <div className="flex gap-1 justify-end">
                      {user.status !== "approved" && (
                        <Button size="sm" variant="ghost" onClick={() => updateStatus(user.id, "approved")}
                          className="text-green-400 hover:bg-green-500/10 h-7 w-7 p-0">
                          <UserCheck className="w-4 h-4" />
                        </Button>
                      )}
                      {user.status !== "blocked" && (
                        <Button size="sm" variant="ghost" onClick={() => updateStatus(user.id, "blocked")}
                          className="text-red-400 hover:bg-red-500/10 h-7 w-7 p-0">
                          <Ban className="w-4 h-4" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm(`Vygenerovat nové heslo pro ${user.first_name} ${user.last_name}?`)) return;
                        const newPassword = Math.random().toString(36).slice(-8) + "Aa1!";
                        const { error } = await supabase.functions.invoke("reset-user-password", {
                          body: { userId: user.id, newPassword }
                        });
                        if (error) {
                          toast({ title: "Chyba", description: error.message, variant: "destructive" });
                        } else {
                          await supabase.from("profiles").update({
                            login_password: newPassword
                          }).eq("id", user.id);

                          toast({
                            title: "Heslo změněno",
                            description: `Nové heslo: ${newPassword}`,
                            duration: 15000,
                          });

                          logAudit("password_reset", "user", user.id, { method: "manual" });
                          fetchUsers();
                        }
                      }} className="text-yellow-400 hover:bg-yellow-500/10 h-7 w-7 p-0">
                        <KeyRound className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={(e) => {
                        e.stopPropagation();
                        setPrintDialogUser(user);
                        setPrintPassword(user.login_password || "");
                      }} className="text-blue-400 hover:bg-blue-500/10 h-7 w-7 p-0">
                        <Printer className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm(`Vygenerovat nové heslo a vytisknout štítek pro ${user.first_name} ${user.last_name}?`)) return;
                        const newPassword = Math.random().toString(36).slice(-8) + "Aa1!";
                        const { error } = await supabase.functions.invoke("reset-user-password", {
                          body: { userId: user.id, newPassword }
                        });
                        if (error) {
                          toast({ title: "Chyba", description: error.message, variant: "destructive" });
                          return;
                        }
                        await supabase.from("profiles").update({ login_password: newPassword }).eq("id", user.id);
                        logAudit("password_reset", "user", user.id, { method: "print_label" });
                        await fetchUsers();
                        printLoginCards([{
                          firstName: user.first_name || "",
                          lastName: user.last_name || "",
                          email: user.email || "",
                          password: newPassword,
                          role: user.role || "user",
                          username: user.username || "",
                          studentCode: user.student_code || "",
                        }]);
                        toast({ title: "Hotovo", description: `Nové heslo: ${newPassword}`, duration: 15000 });
                      }} className="text-purple-400 hover:bg-purple-500/10 h-7 w-7 p-0">
                        <RefreshCw className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm(`Opravdu smazat uživatele ${user.first_name} ${user.last_name}?`)) return;
                        const { error } = await supabase.functions.invoke("delete-user", {
                          body: { userId: user.id }
                        });
                        if (error) {
                          toast({ title: "Chyba", description: error.message, variant: "destructive" });
                        } else {
                          toast({ title: "Smazáno", description: `${user.first_name} ${user.last_name} byl odstraněn.` });
                          logAudit("user_deleted", "user", user.id, { name: `${user.first_name} ${user.last_name}`, role: user.role });
                          fetchUsers();
                        }
                      }} className="text-red-400 hover:bg-red-500/10 h-7 w-7 p-0">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
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
            <div className="flex items-center gap-2">
              <Checkbox
                id="is-adult"
                checked={isAdult}
                onCheckedChange={(v) => {
                  setIsAdult(!!v);
                  if (v) setCreateParentAccount(false);
                }}
              />
              <Label htmlFor="is-adult" className="cursor-pointer">
                Žák je zletilý (18+)
              </Label>
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
            {newUser.role === "user" && !isAdult && (
              <div className="space-y-2 rounded-lg border border-border p-3 bg-muted/30">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="create-parent"
                    checked={createParentAccount}
                    onCheckedChange={(v) => setCreateParentAccount(!!v)}
                  />
                  <Label htmlFor="create-parent" className="cursor-pointer">
                    Vytvořit účet pro rodiče
                  </Label>
                </div>
                {createParentAccount && (
                  <div>
                    <Label className="text-xs">Email rodiče (volitelné)</Label>
                    <Input
                      value={parentEmail}
                      onChange={(e) => setParentEmail(e.target.value)}
                      placeholder="rodic@email.cz"
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Pokud nezadáte, vytvoří se interní přihlášení s vygenerovaným heslem.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddUserOpen(false)}>Zrušit</Button>
            <Button
              disabled={creating || !newUser.first_name || !newUser.last_name}
              onClick={async () => {
                setCreating(true);
                try {
                  // Ověř, že session admina je platná (jinak edge funkce vrátí 401)
                  const { data: sessionData } = await supabase.auth.getSession();
                  if (!sessionData?.session) {
                    await supabase.auth.signOut();
                    throw new Error("Vaše přihlášení vypršelo. Přihlaste se prosím znovu.");
                  }

                  const existingEmails = users.map(u => u.email);
                  const email = newUser.email || generateStudentEmail(newUser.first_name, newUser.last_name, existingEmails, newUser.role);
                  const password = Math.random().toString(36).slice(-8) + "Aa1!";

                  const { data: authData, error: authError } = await supabase.functions.invoke("create-user", {
                    body: { email, password, role: newUser.role }
                  });

                  if (authError) {
                    console.error("create-user error:", authError);
                    const msg = (authError as any)?.message || "";
                    if (msg.includes("401") || msg.toLowerCase().includes("unauthorized")) {
                      await supabase.auth.signOut();
                      throw new Error("Vaše přihlášení vypršelo. Přihlaste se prosím znovu.");
                    }
                    throw new Error(msg || "Chyba při vytváření účtu");
                  }

                  const userId = authData?.user?.id || authData?.id;
                  if (!userId) {
                    if (authData?.code === "email_exists" || authData?.existing_id) {
                      throw new Error(`Email ${email} již existuje v systému. Použijte jiný email.`);
                    }
                    console.error("authData:", authData);
                    throw new Error("Nepodařilo se získat ID uživatele");
                  }

                  const existingUsernames = users.map(u => u.username).filter(Boolean) as string[];
                  const username = generateUsername(newUser.first_name, newUser.last_name, existingUsernames);
                  const studentCode = 'ZAK-' + Math.random().toString(36).slice(-4).toUpperCase();

                  await supabase.from("profiles").upsert({
                    id: userId,
                    first_name: newUser.first_name,
                    last_name: newUser.last_name,
                    email: email,
                    school: newUser.school,
                    field_of_study: "",
                    year: newUser.year ? parseInt(newUser.year) : null,
                    status: "approved" as any,
                    login_password: password,
                    username: username,
                    student_code: studentCode,
                  });

                  await supabase.from("user_roles").upsert({
                    user_id: userId,
                    role: newUser.role as any,
                  }, { onConflict: "user_id,role", ignoreDuplicates: true });

                  if (email && !email.includes("@zedu-student.cz") && !email.includes("@zedu-lektor.cz") && !email.includes("@zedu-rodic.cz")) {
                    try {
                      console.log("Odesílám uvítací email na:", email);
                      const emailResult = await sendWelcomeEmail({
                        to: email,
                        firstName: newUser.first_name,
                        lastName: newUser.last_name,
                        email,
                        password,
                        role: newUser.role,
                        username: username,
                      });
                      console.log("Email výsledek:", emailResult);
                    } catch (emailErr) {
                      console.warn("Email se nepodařilo odeslat:", emailErr);
                    }
                  }

                  const printCards: LoginCardData[] = [{
                    firstName: newUser.first_name,
                    lastName: newUser.last_name,
                    email,
                    password,
                    role: newUser.role,
                    username: username,
                    studentCode: newUser.role === "user" ? studentCode : undefined,
                  }];

                  if (newUser.role === "user" && createParentAccount) {
                    try {
                      const parentLogin = parentEmail.trim() || `rodic.${username}@zedu-rodic.cz`;
                      const parentPassword = Math.random().toString(36).slice(-8) + "Aa1!";
                      const parentUsername = generateUsername(
                        "rodic",
                        `${newUser.first_name}${newUser.last_name}`,
                        [...existingUsernames, username]
                      );

                      const { data: parentAuth, error: parentErr } = await supabase.functions.invoke("create-user", {
                        body: { email: parentLogin, password: parentPassword, role: "rodic" }
                      });
                      if (parentErr) throw parentErr;
                      const parentUserId = parentAuth?.user?.id || parentAuth?.id;
                      if (!parentUserId) throw new Error("Nepodařilo se vytvořit účet rodiče");

                      await supabase.from("profiles").upsert({
                        id: parentUserId,
                        first_name: "Rodič",
                        last_name: `${newUser.first_name} ${newUser.last_name}`,
                        email: parentLogin,
                        school: newUser.school,
                        field_of_study: "",
                        year: null,
                        status: "approved" as any,
                        login_password: parentPassword,
                        username: parentUsername,
                        parent_email: parentEmail.trim() || null,
                      });

                      await supabase.from("user_roles").upsert({
                        user_id: parentUserId,
                        role: "rodic" as any,
                      }, { onConflict: "user_id,role", ignoreDuplicates: true });

                      await supabase.from("parent_student_links" as any).insert({
                        parent_id: parentUserId,
                        student_id: userId,
                      });

                      printCards.push({
                        firstName: "Rodič",
                        lastName: `${newUser.first_name} ${newUser.last_name}`,
                        email: parentLogin,
                        password: parentPassword,
                        role: "rodic",
                        username: parentUsername,
                      });
                    } catch (pe: any) {
                      toast({ title: "Rodičovský účet selhal", description: pe.message, variant: "destructive" });
                    }
                  }

                  toast({
                    title: "Žák přidán",
                    description: `Účet pro ${newUser.first_name} ${newUser.last_name} byl vytvořen. ${!newUser.email ? `Přihlašovací email: ${email}` : ""}`
                  });

                  printLoginCards(printCards);

                  logAudit("user_created", "user", userId, {
                    name: `${newUser.first_name} ${newUser.last_name}`,
                    role: newUser.role,
                    parent_account: newUser.role === "user" && createParentAccount,
                  });

                  setAddUserOpen(false);
                  setNewUser({ first_name: "", last_name: "", email: "", school: "", year: "", role: "user" });
                  setCreateParentAccount(false);
                  setIsAdult(false);
                  setParentEmail("");
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

      <Dialog open={importOpen} onOpenChange={(o) => { setImportOpen(o); if (!o) { setImportPreview([]); setImportFile(null); setImportErrors([]); } }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Hromadný import uživatelů</DialogTitle>
          </DialogHeader>
          {!importPreview.length ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Nahrajte soubor Excel (.xlsx) nebo CSV (.csv) se sloupci: jmeno, prijmeni, email, email_rodice, skola, trida, rocnik, role
              </p>
              <label
                htmlFor="zedu-import-file"
                className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="font-medium">Klikněte pro výběr souboru</p>
                <p className="text-xs text-muted-foreground mt-1">.xlsx nebo .csv</p>
                <input
                  id="zedu-import-file"
                  type="file"
                  accept=".xlsx,.csv"
                  className="sr-only"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setImportFile(file);
                    setImportErrors([]);

                    try {
                      let rows: any[] = [];

                      if (file.name.endsWith(".csv")) {
                        const text = await file.text();
                        const lines = text.split("\n").filter(Boolean);
                        const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/"/g, ""));
                        rows = lines.slice(1).map(line => {
                          const values = line.split(",").map(v => v.trim().replace(/"/g, ""));
                          return Object.fromEntries(headers.map((h, i) => [h, values[i] || ""]));
                        });
                      } else {
                        const XLSX = await import("xlsx");
                        const buffer = await file.arrayBuffer();
                        const wb = XLSX.read(buffer, { type: "array" });
                        const ws = wb.Sheets[wb.SheetNames[0]];
                        const allRows = XLSX.utils.sheet_to_json(ws, { raw: false, defval: "", header: 1 }) as any[][];

                        const headerRowIndex = allRows.findIndex((row: any[]) =>
                          row.some((cell: any) =>
                            String(cell).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes("jmeno") ||
                            String(cell).toLowerCase().includes("jméno")
                          )
                        );
                        if (headerRowIndex === -1) { setImportErrors(["Soubor neobsahuje záhlaví se sloupcem Jméno."]); return; }

                        const keyMap: Record<string, string> = {
                          "jmeno": "jmeno", "prijmeni": "prijmeni",
                          "e-mail": "email", "email": "email",
                          "e-mail_rodice": "email_rodice", "email_rodice": "email_rodice",
                          "e-mail rodice": "email_rodice", "email rodice": "email_rodice",
                          "skola": "skola", "trida": "trida", "rocnik": "rocnik", "role": "role",
                          "zletily": "zletily", "zletilý": "zletily", "zletila": "zletily", "adult": "zletily",
                        };

                        const headers = allRows[headerRowIndex].map((h: any) =>
                          String(h).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s*\*/g, "").trim().toLowerCase().replace(/\s+/g, "_")
                        );

                        rows = allRows
                          .slice(headerRowIndex + 1)
                          .map((row: any[]) => {
                            const obj: any = {};
                            headers.forEach((h: string, i: number) => {
                              obj[keyMap[h] || h] = row[i] != null ? String(row[i]).trim() : "";
                            });
                            return obj;
                          })
                          .filter((r: any) =>
                            r.jmeno && r.prijmeni &&
                            !r.jmeno.toLowerCase().includes("křestní") &&
                            !r.jmeno.toLowerCase().includes("krestni") &&
                            !r.jmeno.toLowerCase().includes("vzorový") &&
                            !r.jmeno.toLowerCase().includes("vzorovy")
                          );
                      }

                      setImportPreview(rows);
                    } catch (err: any) {
                      setImportErrors([`Chyba při čtení souboru: ${err.message}`]);
                    }
                  }}
                />
              </label>
              {importErrors.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 space-y-1">
                  {importErrors.map((e, i) => <p key={i} className="text-xs text-red-400">{e}</p>)}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{importPreview.length} uživatelů k importu</p>
                <Button size="sm" variant="outline" onClick={() => { setImportPreview([]); setImportFile(null); }}>
                  Nahrát jiný soubor
                </Button>
              </div>
              <div className="border border-border rounded-lg overflow-x-auto max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {["Jméno", "Příjmení", "Email", "Škola", "Třída", "Ročník", "Role"].map(h => (
                        <TableHead key={h}>{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importPreview.slice(0, 10).map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>{row.jmeno}</TableCell>
                        <TableCell>{row.prijmeni}</TableCell>
                        <TableCell className="text-muted-foreground">{row.email || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{row.skola || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{row.trida || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{row.rocnik || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{row.role || "zak"}</TableCell>
                      </TableRow>
                    ))}
                    {importPreview.length > 10 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-xs text-muted-foreground">
                          ... a dalších {importPreview.length - 10} uživatelů
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {importErrors.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 space-y-1 max-h-40 overflow-y-auto">
                  {importErrors.map((e, i) => <p key={i} className="text-xs text-red-400">{e}</p>)}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setImportOpen(false); setImportPreview([]); setImportFile(null); }}>
              Zrušit
            </Button>
            {importPreview.length > 0 && (
              <Button
                disabled={importing}
                onClick={async () => {
                  setImporting(true);
                  const errors: string[] = [];
                  let successCount = 0;
                  const importedUsersList: LoginCardData[] = [];
                  const existingEmails = users.map(u => u.email);
                  const usedEmails: string[] = [...existingEmails];
                   const existingUsernames = users.map(u => u.username).filter(Boolean) as string[];
                   const usedUsernames: string[] = [...existingUsernames];
                   const parentEmailToId = new Map<string, string>();

                   for (const row of importPreview) {
                    try {
                      const sanitizeStr = (s: string) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

                      const role = row.role === "ucitel" ? "teacher" : row.role === "rodic" ? "rodic" : row.role === "teacher" || row.role === "lektor" ? row.role : "user";
                      const email = row.email || generateStudentEmail(row.jmeno, row.prijmeni, usedEmails, role);

                      usedEmails.push(email);

                      const password = Math.random().toString(36).slice(-8) + "Aa1!";

                      const username = generateUsername(row.jmeno, row.prijmeni, usedUsernames);

                      usedUsernames.push(username);

                      const studentCode = 'ZAK-' + Math.random().toString(36).slice(-4).toUpperCase();
                      const pin = String(Math.floor(1000 + Math.random() * 9000));
                      const pinHash = await bcrypt.hash(pin, 10);

                      const { data: authData, error: authError } = await supabase.functions.invoke("create-user", {
                        body: { email, password, role }
                      });

                      if (authError) { errors.push(`${row.jmeno} ${row.prijmeni}: ${authError.message}`); continue; }

                      const userId = authData?.user?.id || authData?.id;

                      if (!userId) { errors.push(`${row.jmeno} ${row.prijmeni}: Nepodařilo se získat ID`); continue; }

                      const { error: profileError } = await supabase.from("profiles").upsert({
                        id: userId,
                        first_name: row.jmeno || "",
                        last_name: row.prijmeni || "",
                        email: email,
                        school: row.skola || "",
                        year: row.rocnik ? parseInt(String(row.rocnik)) : null,
                        field_of_study: row.trida || row.obor || "",
                        status: "approved" as any,
                        login_password: password,
                        username: username,
                        student_code: studentCode,
                        pin_code: role === "user" ? pinHash : null,
                      });

                      if (profileError) {
                        console.error("Profile upsert error:", profileError);
                        errors.push(`${row.jmeno} ${row.prijmeni}: Chyba při ukládání profilu - ${profileError.message}`);
                        continue;
                      }

                      await supabase.from("user_roles").upsert({ user_id: userId, role: role as any }, { onConflict: "user_id,role", ignoreDuplicates: true });

                      successCount++;

                      importedUsersList.push({ 
                        firstName: row.jmeno, 
                        lastName: row.prijmeni, 
                        email, 
                        password, 
                        role,
                        username,
                        studentCode,
                        pin: role === "user" ? pin : undefined,
                      });

                      const isAdultStudent = ["ano", "yes", "true", "1"].includes(String(row.zletily || "").toLowerCase().trim());
                      console.log("Zletily hodnota:", row.zletily, "isAdult:", isAdultStudent, "role:", role);

                      if (!isAdultStudent && role === "user") {
                        try {
                          const parentEmailValue = (row.email_rodice && String(row.email_rodice).trim()) || "";
                          const parentLogin = parentEmailValue || `rodic.${studentCode.toLowerCase()}@zedu-rodic.cz`;

                          let parentId: string | undefined;

                          // Zkontroluj jestli jsme tento rodičovský účet již vytvořili v tomto importu
                          if (parentEmailToId.has(parentLogin)) {
                            parentId = parentEmailToId.get(parentLogin);
                          } else {
                            // Zkontroluj jestli rodič existuje v databázi
                            const { data: existingParent } = await supabase
                              .from("profiles")
                              .select("id")
                              .eq("email", parentLogin)
                              .maybeSingle();

                            if (existingParent?.id) {
                              parentId = existingParent.id;
                              parentEmailToId.set(parentLogin, parentId);
                            } else {
                              const parentPassword = Math.random().toString(36).slice(-8) + "Aa1!";
                              const { data: parentAuth, error: parentErr } = await supabase.functions.invoke("create-user", {
                                body: { email: parentLogin, password: parentPassword, role: "rodic" }
                              });
                              if (parentErr) throw parentErr;
                              parentId = parentAuth?.user?.id || parentAuth?.id;

                              if (parentId) {
                                const parentUsername = generateUsername("rodic", sanitizeStr(row.jmeno) + sanitizeStr(row.prijmeni), usedUsernames);
                                usedUsernames.push(parentUsername);
                                parentEmailToId.set(parentLogin, parentId);

                                await supabase.from("profiles").upsert({
                                  id: parentId,
                                  first_name: "Rodič",
                                  last_name: `${row.jmeno} ${row.prijmeni}`,
                                  email: parentLogin,
                                  status: "approved" as any,
                                  login_password: parentPassword,
                                  username: parentUsername,
                                  parent_email: parentEmailValue || null,
                                });
                                await supabase.from("user_roles").upsert({ user_id: parentId, role: "rodic" as any }, { onConflict: "user_id,role", ignoreDuplicates: true });
                                importedUsersList.push({
                                  firstName: "Rodič",
                                  lastName: `${row.jmeno} ${row.prijmeni}`,
                                  email: parentLogin,
                                  password: parentPassword,
                                  role: "rodic",
                                  username: parentUsername,
                                  childCodes: [studentCode],
                                });
                              }
                            }
                          }

                          // Vždy přidej propojení rodič-žák (pokud ještě neexistuje)
                          if (parentId) {
                            const { data: existingLink } = await supabase
                              .from("parent_student_links" as any)
                              .select("id")
                              .eq("parent_id", parentId)
                              .eq("student_id", userId)
                              .maybeSingle();

                            if (!existingLink) {
                              await supabase.from("parent_student_links" as any).insert({
                                parent_id: parentId,
                                student_id: userId,
                              });
                            }

                            // Přidej kód žáka k existujícímu rodiči v seznamu tisku
                            const existingParentCard = importedUsersList.find(u => u.email === parentLogin && u.role === "rodic");
                            if (existingParentCard) {
                              if (!existingParentCard.childCodes?.includes(studentCode)) {
                                existingParentCard.childCodes = [...(existingParentCard.childCodes || []), studentCode];
                              }
                            }
                          }
                        } catch (pe: any) {
                          console.error("Parent creation error:", pe);
                          errors.push(`${row.jmeno} ${row.prijmeni} (rodič): ${pe.message}`);
                        }
                      }
                    } catch (e: any) {
                      errors.push(`${row.jmeno} ${row.prijmeni}: ${e.message}`);
                    }
                  }

                  setImportErrors(errors);
                  if (successCount > 0) {
                    toast({ title: "Import dokončen", description: `${successCount} účtů bylo vytvořeno.${errors.length ? ` ${errors.length} chyb.` : ""}` });
                    fetchUsers();
                  }
                  if (errors.length === 0) {
                    setImportOpen(false);
                    setImportPreview([]);
                    setImportFile(null);
                  }
                  setImporting(false);
                  setImportedUsers(importedUsersList);
                }}
              >
                {importing ? "Importuji..." : `Importovat ${importPreview.length} uživatelů`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!printDialogUser} onOpenChange={(o) => { if (!o) { setPrintDialogUser(null); setPrintPassword(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tisk přihlašovacího štítku</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {printDialogUser?.first_name} {printDialogUser?.last_name} · {printDialogUser?.email}
            </p>
            <div>
              <Label>Heslo pro štítek</Label>
              <Input
                value={printPassword}
                onChange={(e) => setPrintPassword(e.target.value)}
                placeholder="Zadejte heslo nebo použijte reset hesla"
                className="mt-1 font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {printDialogUser?.login_password ? "✅ Heslo je uloženo v systému" : "⚠️ Heslo není uloženo – zadejte ručně nebo použijte reset hesla"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPrintDialogUser(null); setPrintPassword(""); }}>Zrušit</Button>
            <Button
              disabled={!printPassword}
              onClick={() => {
                if (printDialogUser) {
                  printLoginCards([{
                    firstName: printDialogUser.first_name || "",
                    lastName: printDialogUser.last_name || "",
                    email: printDialogUser.email || "",
                    password: printPassword,
                    role: printDialogUser.role || "user",
                    username: printDialogUser.username || "",
                    studentCode: printDialogUser.role === "user" ? (printDialogUser.student_code || "") : "",
                  }]);
                  setPrintDialogUser(null);
                  setPrintPassword("");
                }
              }}
            >
              🖨️ Tisknout štítek
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersManager;
