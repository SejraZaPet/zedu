import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Archive, ArchiveRestore, Trash2, Users, Search, Key, KeyRound, Copy, RefreshCw, XCircle } from "lucide-react";
import ClassMembersDialog from "./ClassMembersDialog";

interface ClassItem {
  id: string;
  name: string;
  description: string;
  school: string;
  field_of_study: string;
  year: number | null;
  archived: boolean;
  created_at: string;
  member_count: number;
  access_code: string | null;
  access_code_active: boolean;
}

const ClassesManager = () => {
  const { toast } = useToast();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  // Form dialog
  const [formOpen, setFormOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [school, setSchool] = useState("");
  const [fieldOfStudy, setFieldOfStudy] = useState("");
  const [year, setYear] = useState("");
  const [saving, setSaving] = useState(false);

  // Members dialog
  const [membersClass, setMembersClass] = useState<ClassItem | null>(null);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<ClassItem | null>(null);

  const fetchClasses = async () => {
    setLoading(true);

    const { data: classesData, error } = await supabase
      .from("classes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Get member counts
    const { data: membersData } = await supabase
      .from("class_members")
      .select("class_id");

    const countMap = new Map<string, number>();
    membersData?.forEach((m: any) => {
      countMap.set(m.class_id, (countMap.get(m.class_id) || 0) + 1);
    });

    const enriched: ClassItem[] = (classesData ?? []).map((c: any) => ({
      ...c,
      member_count: countMap.get(c.id) || 0,
    }));

    setClasses(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchClasses(); }, []);

  const filtered = useMemo(() => {
    return classes.filter((c) => {
      if (c.archived !== showArchived) return false;
      if (search) {
        const s = search.toLowerCase();
        return `${c.name} ${c.school} ${c.field_of_study}`.toLowerCase().includes(s);
      }
      return true;
    });
  }, [classes, search, showArchived]);

  const openCreate = () => {
    setEditingClass(null);
    setName("");
    setDescription("");
    setSchool("");
    setFieldOfStudy("");
    setYear("");
    setFormOpen(true);
  };

  const openEdit = (c: ClassItem) => {
    setEditingClass(c);
    setName(c.name);
    setDescription(c.description);
    setSchool(c.school);
    setFieldOfStudy(c.field_of_study);
    setYear(c.year ? String(c.year) : "");
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Chyba", description: "Zadejte název třídy.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const payload = {
      name: name.trim(),
      description: description.trim(),
      school: school.trim(),
      field_of_study: fieldOfStudy.trim(),
      year: year ? parseInt(year, 10) : null,
    };

    if (editingClass) {
      const { error } = await supabase.from("classes").update(payload).eq("id", editingClass.id);
      if (error) {
        toast({ title: "Chyba", description: error.message, variant: "destructive" });
        setSaving(false);
        return;
      }
      toast({ title: "Uloženo", description: "Třída byla upravena." });
    } else {
      const { error } = await supabase.from("classes").insert(payload);
      if (error) {
        toast({ title: "Chyba", description: error.message, variant: "destructive" });
        setSaving(false);
        return;
      }
      toast({ title: "Vytvořeno", description: "Nová třída byla vytvořena." });
    }

    setSaving(false);
    setFormOpen(false);
    fetchClasses();
  };

  const toggleArchive = async (c: ClassItem) => {
    const { error } = await supabase
      .from("classes")
      .update({ archived: !c.archived })
      .eq("id", c.id);

    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Uloženo", description: c.archived ? "Třída byla obnovena." : "Třída byla archivována." });
    fetchClasses();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("classes").delete().eq("id", deleteTarget.id);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Smazáno", description: "Třída byla odstraněna." });
    setDeleteTarget(null);
    fetchClasses();
  };

  const generateCode = async (classId: string) => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { error } = await supabase
      .from("classes")
      .update({ access_code: code, access_code_active: true } as any)
      .eq("id", classId);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Kód vygenerován", description: `Nový kód: ${code}` });
    fetchClasses();
  };

  const toggleCodeActive = async (classId: string, active: boolean) => {
    const { error } = await supabase
      .from("classes")
      .update({ access_code_active: active } as any)
      .eq("id", classId);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: active ? "Kód aktivován" : "Kód deaktivován" });
    fetchClasses();
  };

  if (loading) return <div className="text-muted-foreground p-4">Načítání tříd...</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Hledat třídu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={showArchived ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
          >
            <Archive className="w-4 h-4 mr-1" />
            {showArchived ? "Aktivní" : "Archiv"}
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" /> Nová třída
          </Button>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        {showArchived ? "Archivované" : "Aktivní"} třídy: {filtered.length}
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Název</TableHead>
              <TableHead>Škola</TableHead>
              <TableHead>Obor</TableHead>
              <TableHead className="text-center">Ročník</TableHead>
              <TableHead className="text-center">Studenti</TableHead>
              <TableHead className="text-center">Kód</TableHead>
              <TableHead className="text-right">Akce</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  <div>
                    {c.name}
                    {c.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{c.description}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{c.school || "–"}</TableCell>
                <TableCell className="text-muted-foreground">{c.field_of_study || "–"}</TableCell>
                <TableCell className="text-center text-muted-foreground">{c.year ?? "–"}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary" className="text-xs cursor-pointer" onClick={() => setMembersClass(c)}>
                    <Users className="w-3 h-3 mr-1" />
                    {c.member_count}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  {c.access_code && c.access_code_active ? (
                    <div className="flex items-center justify-center gap-1">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{c.access_code}</code>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Kopírovat" onClick={() => { navigator.clipboard.writeText(c.access_code!); toast({ title: "Zkopírováno" }); }}>
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : c.access_code ? (
                    <span className="text-xs text-muted-foreground">Deaktivován</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">–</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    <Button size="sm" variant="ghost" onClick={() => setMembersClass(c)} className="h-8 px-2" title="Studenti">
                      <Users className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(c)} className="h-8 px-2" title="Upravit">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleArchive(c)}
                      className="h-8 px-2"
                      title={c.archived ? "Obnovit" : "Archivovat"}
                    >
                      {c.archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                    </Button>
                    {/* Access code actions */}
                    {!c.access_code ? (
                      <Button size="sm" variant="ghost" onClick={() => generateCode(c.id)} className="h-8 px-2" title="Vytvořit kód">
                        <Key className="w-4 h-4" />
                      </Button>
                    ) : (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => generateCode(c.id)} className="h-8 px-2" title="Resetovat kód">
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleCodeActive(c.id, !c.access_code_active)}
                          className="h-8 px-2"
                          title={c.access_code_active ? "Deaktivovat kód" : "Aktivovat kód"}
                        >
                          {c.access_code_active ? <XCircle className="w-4 h-4" /> : <KeyRound className="w-4 h-4" />}
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleteTarget(c)}
                      className="text-destructive hover:bg-destructive/10 h-8 px-2"
                      title="Smazat"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {showArchived ? "Žádné archivované třídy." : "Žádné třídy. Vytvořte první."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingClass ? "Upravit třídu" : "Nová třída"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label htmlFor="className">Název třídy *</Label>
              <Input id="className" value={name} onChange={(e) => setName(e.target.value)} placeholder="např. Kuchař 1.A" />
            </div>
            <div>
              <Label htmlFor="classDesc">Popis</Label>
              <Textarea id="classDesc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Volitelný popis třídy" />
            </div>
            <div>
              <Label htmlFor="classSchool">Škola</Label>
              <Input id="classSchool" value={school} onChange={(e) => setSchool(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="classField">Obor</Label>
                <Input id="classField" value={fieldOfStudy} onChange={(e) => setFieldOfStudy(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="classYear">Ročník</Label>
                <Input id="classYear" type="number" min={1} max={9} value={year} onChange={(e) => setYear(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>Zrušit</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Ukládání..." : editingClass ? "Uložit" : "Vytvořit"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smazat třídu?</AlertDialogTitle>
            <AlertDialogDescription>
              Třída „{deleteTarget?.name}" bude trvale odstraněna včetně všech přiřazení studentů. Tuto akci nelze vrátit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Smazat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Members dialog */}
      {membersClass && (
        <ClassMembersDialog
          classItem={membersClass}
          open={!!membersClass}
          onOpenChange={(open) => !open && setMembersClass(null)}
          onUpdated={fetchClasses}
        />
      )}
    </div>
  );
};

export default ClassesManager;
