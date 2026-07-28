import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, GraduationCap, ArrowUp, ArrowDown, X } from "lucide-react";
import { toast } from "sonner";

interface Pathway {
  id: string;
  title: string;
  description: string | null;
  is_published: boolean;
}

interface CourseLite {
  id: string;
  title: string;
}

interface PathwayCourse {
  id: string;
  pathway_id: string;
  course_id: string;
  sort_order: number;
}

export default function AcademyPathwaysManager() {
  const [pathways, setPathways] = useState<Pathway[]>([]);
  const [allCourses, setAllCourses] = useState<CourseLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Pathway | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<Partial<Pathway>>({ title: "", description: "", is_published: false });
  const [detailPathway, setDetailPathway] = useState<Pathway | null>(null);
  const [detailCourses, setDetailCourses] = useState<PathwayCourse[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: p }, { data: c }] = await Promise.all([
      (supabase as any).from("academy_pathways").select("*").order("created_at", { ascending: true }),
      supabase.from("academy_courses").select("id, title").order("title"),
    ]);
    setPathways((p as Pathway[]) || []);
    setAllCourses((c as CourseLite[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ title: "", description: "", is_published: false });
    setDialogOpen(true);
  };
  const openEdit = (p: Pathway) => {
    setEditing(p);
    setForm({ title: p.title, description: p.description, is_published: p.is_published });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.title?.trim()) return toast.error("Zadejte název");
    if (editing) {
      const { error } = await (supabase as any).from("academy_pathways")
        .update({ title: form.title, description: form.description || null, is_published: !!form.is_published })
        .eq("id", editing.id);
      if (error) return toast.error("Chyba", { description: error.message });
    } else {
      const { error } = await (supabase as any).from("academy_pathways")
        .insert({ title: form.title, description: form.description || null, is_published: !!form.is_published });
      if (error) return toast.error("Chyba", { description: error.message });
    }
    toast.success("Uloženo");
    setDialogOpen(false);
    await load();
  };

  const remove = async (p: Pathway) => {
    if (!confirm(`Smazat kvalifikaci "${p.title}"?`)) return;
    const { error } = await (supabase as any).from("academy_pathways").delete().eq("id", p.id);
    if (error) return toast.error("Chyba", { description: error.message });
    toast.success("Smazáno");
    if (detailPathway?.id === p.id) setDetailPathway(null);
    load();
  };

  const openDetail = async (p: Pathway) => {
    setDetailPathway(p);
    const { data } = await (supabase as any).from("academy_pathway_courses")
      .select("*").eq("pathway_id", p.id).order("sort_order");
    setDetailCourses((data as PathwayCourse[]) || []);
  };

  const addCourseToPathway = async (courseId: string) => {
    if (!detailPathway) return;
    if (detailCourses.some((c) => c.course_id === courseId)) return;
    const nextOrder = detailCourses.length > 0 ? Math.max(...detailCourses.map((c) => c.sort_order)) + 1 : 0;
    const { error } = await (supabase as any).from("academy_pathway_courses")
      .insert({ pathway_id: detailPathway.id, course_id: courseId, sort_order: nextOrder });
    if (error) return toast.error("Chyba", { description: error.message });
    openDetail(detailPathway);
  };

  const removeCourseFromPathway = async (id: string) => {
    const { error } = await (supabase as any).from("academy_pathway_courses").delete().eq("id", id);
    if (error) return toast.error("Chyba", { description: error.message });
    if (detailPathway) openDetail(detailPathway);
  };

  const move = async (id: string, dir: -1 | 1) => {
    const idx = detailCourses.findIndex((c) => c.id === id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= detailCourses.length) return;
    const a = detailCourses[idx];
    const b = detailCourses[swapIdx];
    await (supabase as any).from("academy_pathway_courses").update({ sort_order: b.sort_order }).eq("id", a.id);
    await (supabase as any).from("academy_pathway_courses").update({ sort_order: a.sort_order }).eq("id", b.id);
    if (detailPathway) openDetail(detailPathway);
  };

  const courseTitleById = (id: string) => allCourses.find((c) => c.id === id)?.title ?? id;
  const availableCourses = allCourses.filter((c) => !detailCourses.some((pc) => pc.course_id === c.id));

  if (loading) return <p className="text-muted-foreground p-4">Načítání…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-primary" />
          <h2 className="font-heading text-xl font-semibold">Kvalifikace (skládatelné certifikace)</h2>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-1" /> Nová kvalifikace</Button>
      </div>

      {pathways.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Zatím žádné kvalifikace.</Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {pathways.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{p.title}</h3>
                    {p.is_published ? (
                      <Badge variant="secondary">Publikováno</Badge>
                    ) : (
                      <Badge variant="outline">Skryto</Badge>
                    )}
                  </div>
                  {p.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.description}</p>}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(p)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(p)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => openDetail(p)}>Spravovat kurzy →</Button>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Upravit kvalifikaci" : "Nová kvalifikace"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Název</Label>
              <Input value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>Popis</Label>
              <Textarea rows={4} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={!!form.is_published} onCheckedChange={(v) => setForm({ ...form, is_published: v })} />
              <Label>Publikováno</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Zrušit</Button>
              <Button onClick={save}>Uložit</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailPathway} onOpenChange={(v) => !v && setDetailPathway(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Kurzy v kvalifikaci: {detailPathway?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold mb-2">Zařazené kurzy ({detailCourses.length})</h4>
              {detailCourses.length === 0 ? (
                <p className="text-sm text-muted-foreground">Zatím žádné kurzy.</p>
              ) : (
                <ul className="space-y-1">
                  {detailCourses.map((pc, i) => (
                    <li key={pc.id} className="flex items-center gap-2 p-2 rounded-lg border border-border">
                      <span className="text-xs text-muted-foreground w-6">{i + 1}.</span>
                      <span className="flex-1 text-sm">{courseTitleById(pc.course_id)}</span>
                      <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => move(pc.id, -1)}><ArrowUp className="w-3 h-3" /></Button>
                      <Button size="sm" variant="ghost" disabled={i === detailCourses.length - 1} onClick={() => move(pc.id, 1)}><ArrowDown className="w-3 h-3" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => removeCourseFromPathway(pc.id)}><X className="w-4 h-4" /></Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-2">Přidat kurz</h4>
              {availableCourses.length === 0 ? (
                <p className="text-sm text-muted-foreground">Žádné další dostupné kurzy.</p>
              ) : (
                <div className="max-h-64 overflow-auto space-y-1">
                  {availableCourses.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => addCourseToPathway(c.id)}
                      className="w-full text-left text-sm p-2 rounded-lg border border-border hover:bg-muted"
                    >
                      + {c.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
