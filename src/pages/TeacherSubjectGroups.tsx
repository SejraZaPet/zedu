import { BetaBadge } from "@/components/common/BetaBadge";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useTeacherClasses, claimSchoolClass } from "@/hooks/useTeacherClasses";
import SubjectPicker from "@/components/subjects/SubjectPicker";

import { ArrowLeft, Plus, Trash2, Users, Archive, Loader2, Search, Link2 } from "lucide-react";

interface SubjectRow { id: string; name: string; color: string | null; abbreviation: string | null }
interface GroupRow { id: string; subject_id: string; name: string; school_year: string; archived: boolean }
interface MemberRow { id: string; group_id: string; student_id: string }
interface StudentRow { id: string; name: string; className: string }
interface ClassSubjectRow { id: string; class_id: string; subject_id: string; school_year: string; archived: boolean }

/** Vrátí školní rok ve formátu "2026/2027" podle aktuálního data (přelom v srpnu). */
export const currentSchoolYear = (d: Date = new Date()) => {
  const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}/${y + 1}`;
};

/** Vrátí následující školní rok po zadaném (např. "2026/2027" → "2027/2028"). */
export const nextSchoolYear = (year: string) => {
  const start = parseInt(year.slice(0, 4), 10);
  if (Number.isNaN(start)) return currentSchoolYear();
  return `${start + 1}/${start + 2}`;
};

const TeacherSubjectGroups = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { classes } = useTeacherClasses();

  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [subjectId, setSubjectId] = useState<string>("");
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubjectRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);

  // nová skupina
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newYear, setNewYear] = useState(currentSchoolYear());
  // Spojená skupina: třídy, ze kterých se do nové skupiny nabere celý seznam žáků
  const [seedClassIds, setSeedClassIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // přidávání žáků
  const [rosterGroup, setRosterGroup] = useState<GroupRow | null>(null);
  const [search, setSearch] = useState("");

  // archivace + nový rok
  const [rollGroup, setRollGroup] = useState<GroupRow | null>(null);
  const [rollCopyStudents, setRollCopyStudents] = useState(true);

  // přiřazení předmětu ke třídě
  const [assignClassId, setAssignClassId] = useState<string>("");

  const loadSubjects = async () => {
    const { data, error } = await supabase
      .from("subjects")
      .select("id, name, color, abbreviation")
      .order("name");
    if (error) {
      toast({ title: "Nepodařilo se načíst předměty", description: error.message, variant: "destructive" });
      return;
    }
    const rows = (data as SubjectRow[]) ?? [];
    setSubjects(rows);
    const initialFromQuery = searchParams.get("subjectId");
    if (initialFromQuery && rows.some((r) => r.id === initialFromQuery)) {
      setSubjectId(initialFromQuery);
    } else {
      setSubjectId((prev) => prev || rows[0]?.id || "");
    }
  };

  const loadGroups = async () => {
    if (!subjectId) { setGroups([]); setMembers([]); return; }
    const { data: g, error } = await supabase
      .from("subject_groups")
      .select("id, subject_id, name, school_year, archived")
      .eq("subject_id", subjectId)
      .order("school_year", { ascending: false })
      .order("name");
    if (error) {
      toast({ title: "Nepodařilo se načíst skupiny", description: error.message, variant: "destructive" });
      return;
    }
    const rows = (g as GroupRow[]) ?? [];
    setGroups(rows);
    if (rows.length) {
      const { data: m } = await supabase
        .from("subject_group_members")
        .select("id, group_id, student_id")
        .in("group_id", rows.map((r) => r.id));
      setMembers((m as MemberRow[]) ?? []);
    } else {
      setMembers([]);
    }
  };

  const loadClassSubjects = async () => {
    const { data } = await supabase
      .from("class_subjects")
      .select("id, class_id, subject_id, school_year, archived");
    setClassSubjects((data as ClassSubjectRow[]) ?? []);
  };

  /** Žáci napříč všemi třídami učitele. */
  const loadStudents = async () => {
    if (!classes.length) { setStudents([]); return; }
    const classNameById = new Map(classes.map((c) => [c.id, c.name]));
    const { data: cm } = await supabase
      .from("class_members")
      .select("class_id, user_id")
      .in("class_id", classes.map((c) => c.id));
    const rows = (cm as any[]) ?? [];
    const ids = Array.from(new Set(rows.map((r) => r.user_id)));
    if (!ids.length) { setStudents([]); return; }
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .in("id", ids);
    const nameById = new Map(
      ((profs as any[]) ?? []).map((p) => [
        p.id,
        [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || p.email || "Žák",
      ])
    );
    const byStudent = new Map<string, StudentRow>();
    rows.forEach((r) => {
      const existing = byStudent.get(r.user_id);
      const cls = classNameById.get(r.class_id) ?? "";
      if (existing) {
        existing.className = Array.from(new Set([...existing.className.split(", ").filter(Boolean), cls])).join(", ");
      } else {
        byStudent.set(r.user_id, { id: r.user_id, name: nameById.get(r.user_id) ?? "Žák", className: cls });
      }
    });
    setStudents(Array.from(byStudent.values()).sort((a, b) => a.name.localeCompare(b.name, "cs")));
  };

  useEffect(() => {
    if (!user) return;
    void (async () => {
      setLoading(true);
      await Promise.all([loadSubjects(), loadClassSubjects()]);
      setLoading(false);
    })();
  }, [user]);

  useEffect(() => { void loadGroups(); }, [subjectId]);
  useEffect(() => { void loadStudents(); }, [classes.length]);

  const visibleGroups = useMemo(
    () => groups.filter((g) => (showArchived ? true : !g.archived)),
    [groups, showArchived]
  );

  const memberCount = (groupId: string) => members.filter((m) => m.group_id === groupId).length;

  const createGroup = async () => {
    if (!user || !subjectId || !newName.trim()) {
      toast({ title: "Vyplňte název skupiny", variant: "destructive" });
      return;
    }
    setSaving(true);
    // Spojená skupina: učitel vybere existující třídy a všichni jejich žáci se vloží do skupiny
    for (const classId of seedClassIds) {
      if (classes.find((c) => c.id === classId)?.source === "school") {
        await claimSchoolClass(classId);
      }
    }
    const { data: createdGroup, error } = await supabase
      .from("subject_groups")
      .insert({
        subject_id: subjectId,
        name: newName.trim(),
        school_year: newYear.trim() || currentSchoolYear(),
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error || !createdGroup?.id) {
      setSaving(false);
      toast({ title: "Nepodařilo se vytvořit skupinu", description: error?.message, variant: "destructive" });
      return;
    }

    let seeded = 0;
    if (seedClassIds.length) {
      const { data: cm } = await supabase
        .from("class_members")
        .select("user_id")
        .in("class_id", seedClassIds);
      const studentIds = Array.from(new Set(((cm as any[]) ?? []).map((r) => r.user_id).filter(Boolean)));
      if (studentIds.length) {
        const { error: memberError } = await supabase
          .from("subject_group_members")
          .insert(studentIds.map((sid) => ({ group_id: createdGroup.id, student_id: sid })));
        if (memberError) {
          toast({ title: "Žáky se nepodařilo přidat", description: memberError.message, variant: "destructive" });
        } else {
          seeded = studentIds.length;
        }
      }
    }
    setSaving(false);
    toast({
      title: "Skupina vytvořena",
      description: seeded ? `Přidáno ${seeded} žáků z ${seedClassIds.length} tříd.` : undefined,
    });
    setCreateOpen(false);
    setNewName("");
    setSeedClassIds([]);
    void loadGroups();
    void loadStudents();
  };

  const deleteGroup = async (g: GroupRow) => {
    if (!confirm(`Smazat skupinu „${g.name}"? Členství žáků se smaže také.`)) return;
    const { error } = await supabase.from("subject_groups").delete().eq("id", g.id);
    if (error) {
      toast({ title: "Nepodařilo se smazat", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Skupina smazána" });
    void loadGroups();
  };

  const toggleStudent = async (g: GroupRow, studentId: string, on: boolean) => {
    if (on) {
      const { error } = await supabase.from("subject_group_members").insert({ group_id: g.id, student_id: studentId });
      if (error) {
        toast({ title: "Nepodařilo se přidat žáka", description: error.message, variant: "destructive" });
        return;
      }
    } else {
      const { error } = await supabase
        .from("subject_group_members")
        .delete()
        .eq("group_id", g.id)
        .eq("student_id", studentId);
      if (error) {
        toast({ title: "Nepodařilo se odebrat žáka", description: error.message, variant: "destructive" });
        return;
      }
    }
    await loadGroups();
  };

  /** Archivuje skupinu a vytvoří její kopii pro následující školní rok. */
  const rollOverGroup = async () => {
    if (!user || !rollGroup) return;
    setSaving(true);
    const targetYear = nextSchoolYear(rollGroup.school_year);
    const { data: created, error } = await supabase
      .from("subject_groups")
      .insert({
        subject_id: rollGroup.subject_id,
        name: rollGroup.name,
        school_year: targetYear,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error || !created) {
      setSaving(false);
      toast({ title: "Nepodařilo se založit nový rok", description: error?.message, variant: "destructive" });
      return;
    }
    if (rollCopyStudents) {
      const ids = members.filter((m) => m.group_id === rollGroup.id).map((m) => m.student_id);
      if (ids.length) {
        const { error: mErr } = await supabase
          .from("subject_group_members")
          .insert(ids.map((student_id) => ({ group_id: (created as any).id, student_id })));
        if (mErr) toast({ title: "Žáky se nepodařilo zkopírovat", description: mErr.message, variant: "destructive" });
      }
    }
    const { error: aErr } = await supabase.from("subject_groups").update({ archived: true }).eq("id", rollGroup.id);
    setSaving(false);
    if (aErr) {
      toast({ title: "Nepodařilo se archivovat starou skupinu", description: aErr.message, variant: "destructive" });
    } else {
      toast({ title: "Hotovo", description: `Nová skupina pro rok ${targetYear} je připravená.` });
    }
    setRollGroup(null);
    void loadGroups();
  };

  const assignSubjectToClass = async () => {
    if (!assignClassId || !subjectId) {
      toast({ title: "Vyberte třídu i předmět", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("class_subjects").insert({
      class_id: assignClassId,
      subject_id: subjectId,
      school_year: currentSchoolYear(),
    });
    if (error) {
      toast({ title: "Nepodařilo se přiřadit předmět", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Předmět přiřazen ke třídě" });
    void loadClassSubjects();
  };

  /** Archivuje přiřazení předmětu ke třídě a vytvoří kopii pro další rok. */
  const rollOverClassSubject = async (cs: ClassSubjectRow) => {
    const targetYear = nextSchoolYear(cs.school_year);
    const { error } = await supabase.from("class_subjects").insert({
      class_id: cs.class_id,
      subject_id: cs.subject_id,
      school_year: targetYear,
    });
    if (error && !error.message.includes("duplicate")) {
      toast({ title: "Nepodařilo se založit nový rok", description: error.message, variant: "destructive" });
      return;
    }
    const { error: aErr } = await supabase.from("class_subjects").update({ archived: true }).eq("id", cs.id);
    if (aErr) {
      toast({ title: "Nepodařilo se archivovat", description: aErr.message, variant: "destructive" });
      return;
    }
    toast({ title: "Hotovo", description: `Přiřazení pro rok ${targetYear} je připravené.` });
    void loadClassSubjects();
  };

  const removeClassSubject = async (cs: ClassSubjectRow) => {
    if (!confirm("Odebrat předmět z třídy?")) return;
    const { error } = await supabase.from("class_subjects").delete().eq("id", cs.id);
    if (error) {
      toast({ title: "Nepodařilo se odebrat", description: error.message, variant: "destructive" });
      return;
    }
    void loadClassSubjects();
  };

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.name.toLowerCase().includes(q) || s.className.toLowerCase().includes(q));
  }, [students, search]);

  const subjectName = subjects.find((s) => s.id === subjectId)?.name ?? "";
  const visibleClassSubjects = classSubjects.filter(
    (cs) => cs.subject_id === subjectId && (showArchived ? true : !cs.archived)
  );
  const className = (id: string) => classes.find((c) => c.id === id)?.name ?? "Třída";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 pt-24 pb-16">
        <Button variant="ghost" size="sm" className="mb-4 gap-2" onClick={() => navigate("/ucitel")}>
          <ArrowLeft size={16} /> Zpět na přehled
        </Button>

        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">Skupiny předmětu <BetaBadge context="Skupiny předmětu" /></h1>
            <p className="text-muted-foreground mt-1">
              Skupiny jsou nezávislé na třídách — do jedné skupiny můžete zařadit žáky z různých tříd i ročníků.
            </p>
          </div>
          <div className="flex items-end gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Předmět</Label>
              <SubjectPicker
                value={subjectId || null}
                className="w-[240px]"
                onChange={async ({ subjectId: id }) => {
                  await loadSubjects();
                  if (id) setSubjectId(id);
                }}
              />
            </div>
            <label className="flex items-center gap-2 text-sm pb-2 cursor-pointer">
              <Checkbox checked={showArchived} onCheckedChange={(v) => setShowArchived(!!v)} />
              Zobrazit archivované
            </label>
          </div>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Načítání…</p>
        ) : !subjects.length ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">
            Zatím nemáte žádné předměty. Založte si ho výše v poli „Předmět“ — napište název a potvrďte „Založit předmět“.
          </CardContent></Card>
        ) : (

          <Tabs defaultValue="groups">
            <TabsList className="mb-4">
              <TabsTrigger value="groups" className="gap-2"><Users size={15} /> Skupiny ({visibleGroups.length})</TabsTrigger>
              <TabsTrigger value="classes" className="gap-2"><Link2 size={15} /> Třídy s předmětem ({visibleClassSubjects.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="groups" className="space-y-4">
              <Button onClick={() => { setNewYear(currentSchoolYear()); setCreateOpen(true); }} className="gap-2">
                <Plus size={16} /> Nová skupina
              </Button>
              {visibleGroups.length === 0 ? (
                <Card><CardContent className="py-10 text-center text-muted-foreground">
                  Pro předmět {subjectName} zatím nejsou žádné skupiny.
                </CardContent></Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {visibleGroups.map((g) => (
                    <Card key={g.id} className={g.archived ? "opacity-70" : ""}>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center justify-between gap-2 text-lg">
                          <span>{g.name}</span>
                          <span className="flex items-center gap-2">
                            <Badge variant="secondary">{g.school_year}</Badge>
                            {g.archived && <Badge variant="outline">Archivováno</Badge>}
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground">{memberCount(g.id)} žáků</p>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" className="gap-2" onClick={() => { setRosterGroup(g); setSearch(""); }}>
                            <Users size={15} /> Žáci
                          </Button>
                          {!g.archived && (
                            <Button size="sm" variant="outline" className="gap-2" onClick={() => { setRollGroup(g); setRollCopyStudents(true); }}>
                              <Archive size={15} /> Archivovat a založit nový rok
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="gap-2 text-destructive" onClick={() => void deleteGroup(g)}>
                            <Trash2 size={15} /> Smazat
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="classes" className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Třída</Label>
                  <Select value={assignClassId} onValueChange={setAssignClassId}>
                    <SelectTrigger className="w-[240px]"><SelectValue placeholder="Vyberte třídu" /></SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="gap-2" onClick={() => void assignSubjectToClass()}>
                  <Plus size={16} /> Přiřadit {subjectName || "předmět"}
                </Button>
              </div>
              {visibleClassSubjects.length === 0 ? (
                <Card><CardContent className="py-10 text-center text-muted-foreground">
                  Předmět {subjectName} zatím není přiřazený k žádné třídě.
                </CardContent></Card>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {visibleClassSubjects.map((cs) => (
                    <Card key={cs.id} className={cs.archived ? "opacity-70" : ""}>
                      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{className(cs.class_id)}</span>
                          <Badge variant="secondary">{cs.school_year}</Badge>
                          {cs.archived && <Badge variant="outline">Archivováno</Badge>}
                        </div>
                        <div className="flex gap-2">
                          {!cs.archived && (
                            <Button size="sm" variant="outline" className="gap-2" onClick={() => void rollOverClassSubject(cs)}>
                              <Archive size={15} /> Nový rok
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void removeClassSubject(cs)}>
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </main>
      <SiteFooter />

      {/* Nová skupina */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nová skupina předmětu {subjectName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Název skupiny</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Skupina 1" />
            </div>
            <div>
              <Label>Školní rok</Label>
              <Input value={newYear} onChange={(e) => setNewYear(e.target.value)} placeholder="2026/2027" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Zrušit</Button>
            <Button onClick={() => void createGroup()} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Vytvořit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Žáci ve skupině */}
      <Dialog open={!!rosterGroup} onOpenChange={(o) => !o && setRosterGroup(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Žáci ve skupině {rosterGroup?.name}</DialogTitle>
            <DialogDescription>
              Vyhledávejte napříč všemi svými třídami — skupina není omezená na jednu třídu.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Hledat žáka nebo třídu…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="max-h-[50vh] overflow-y-auto divide-y">
            {filteredStudents.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Žádní žáci nenalezeni.</p>
            ) : filteredStudents.map((s) => {
              const checked = !!rosterGroup && members.some((m) => m.group_id === rosterGroup.id && m.student_id === s.id);
              return (
                <label key={s.id} className="flex items-center gap-3 py-2 cursor-pointer">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => rosterGroup && void toggleStudent(rosterGroup, s.id, !!v)}
                  />
                  <span className="flex-1">{s.name}</span>
                  <span className="text-xs text-muted-foreground">{s.className}</span>
                </label>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRosterGroup(null)}>Zavřít</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archivace a nový rok */}
      <Dialog open={!!rollGroup} onOpenChange={(o) => !o && setRollGroup(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Archivovat a založit nový rok</DialogTitle>
            <DialogDescription>
              Skupina „{rollGroup?.name}" ({rollGroup?.school_year}) se archivuje a zůstane dohledatelná ve filtru
              „Zobrazit archivované". Vytvoří se nová skupina pro rok {rollGroup ? nextSchoolYear(rollGroup.school_year) : ""}.
            </DialogDescription>
          </DialogHeader>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={rollCopyStudents} onCheckedChange={(v) => setRollCopyStudents(!!v)} />
            Zkopírovat i seznam žáků
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRollGroup(null)}>Zrušit</Button>
            <Button onClick={() => void rollOverGroup()} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Archivovat a založit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeacherSubjectGroups;
