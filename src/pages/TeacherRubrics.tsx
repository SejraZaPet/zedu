import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Plus, Pencil, Trash2, ClipboardList, Save, X } from "lucide-react";

interface Rubric { id: string; title: string; created_at: string }
interface Criterion { id: string; rubric_id: string; title: string; sort_order: number }
interface Level { id: string; criterion_id: string; label: string; points: number; sort_order: number }

const TeacherRubrics = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [editing, setEditing] = useState<Rubric | null>(null);

  const fetchRubrics = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("grading_rubrics")
      .select("id, title, created_at")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false });
    setRubrics((data as Rubric[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchRubrics(); }, [user]);

  const createRubric = async () => {
    if (!user || !newTitle.trim()) return;
    const { error } = await supabase.from("grading_rubrics").insert({
      teacher_id: user.id,
      title: newTitle.trim(),
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Rubrika vytvořena");
    setNewTitle("");
    setCreateOpen(false);
    fetchRubrics();
  };

  const deleteRubric = async (id: string) => {
    if (!confirm("Opravdu smazat rubriku? Smaže i všechna kritéria, úrovně a existující hodnocení.")) return;
    const { error } = await supabase.from("grading_rubrics").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Smazáno");
    fetchRubrics();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl" style={{ paddingTop: "calc(70px + 3rem)" }}>
        <Button variant="ghost" size="sm" onClick={() => navigate("/ucitel")} className="mb-4 gap-2">
          <ArrowLeft className="w-4 h-4" /> Zpět na přehled
        </Button>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-primary" /> Rubriky hodnocení
            </h1>
            <p className="text-muted-foreground mt-1">
              Vlastní kritéria a úrovně pro hodnocení komplexních prací (projekty, eseje).
            </p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" /> Nová rubrika</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nová rubrika</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label>Název rubriky</Label>
                  <Input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="např. Prezentace projektu"
                    className="mt-1"
                  />
                </div>
                <Button onClick={createRubric} disabled={!newTitle.trim()} className="w-full">
                  Vytvořit
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Načítání…</p>
        ) : rubrics.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-muted-foreground">
            Zatím nemáte žádné rubriky. Vytvořte první tlačítkem výše.
          </CardContent></Card>
        ) : (
          <div className="space-y-3">
            {rubrics.map((r) => (
              <Card key={r.id}>
                <CardContent className="py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{r.title}</h3>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(r)} title="Upravit">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteRubric(r.id)} title="Smazat">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />

      {editing && (
        <RubricEditor
          rubric={editing}
          onClose={() => { setEditing(null); fetchRubrics(); }}
        />
      )}
    </div>
  );
};

function RubricEditor({ rubric, onClose }: { rubric: Rubric; onClose: () => void }) {
  const [title, setTitle] = useState(rubric.title);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [levelsByCriterion, setLevelsByCriterion] = useState<Record<string, Level[]>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data: crits } = await supabase
      .from("rubric_criteria")
      .select("id, rubric_id, title, sort_order")
      .eq("rubric_id", rubric.id)
      .order("sort_order", { ascending: true });
    const critList = (crits as Criterion[]) || [];
    setCriteria(critList);

    if (critList.length > 0) {
      const { data: lvls } = await supabase
        .from("rubric_levels")
        .select("id, criterion_id, label, points, sort_order")
        .in("criterion_id", critList.map((c) => c.id))
        .order("sort_order", { ascending: true });
      const byCrit: Record<string, Level[]> = {};
      ((lvls as Level[]) || []).forEach((l) => {
        (byCrit[l.criterion_id] ||= []).push(l);
      });
      setLevelsByCriterion(byCrit);
    } else {
      setLevelsByCriterion({});
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [rubric.id]);

  const saveTitle = async () => {
    if (!title.trim() || title === rubric.title) return;
    const { error } = await supabase
      .from("grading_rubrics")
      .update({ title: title.trim() })
      .eq("id", rubric.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Uloženo");
  };

  const addCriterion = async () => {
    const sort = criteria.length;
    const { data, error } = await supabase
      .from("rubric_criteria")
      .insert({ rubric_id: rubric.id, title: "Nové kritérium", sort_order: sort })
      .select()
      .single();
    if (error || !data) { toast.error(error?.message || "Chyba"); return; }
    setCriteria((c) => [...c, data as Criterion]);
  };

  const updateCriterion = async (id: string, newTitle: string) => {
    setCriteria((c) => c.map((x) => x.id === id ? { ...x, title: newTitle } : x));
    await supabase.from("rubric_criteria").update({ title: newTitle }).eq("id", id);
  };

  const deleteCriterion = async (id: string) => {
    if (!confirm("Smazat kritérium a všechny jeho úrovně?")) return;
    const { error } = await supabase.from("rubric_criteria").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setCriteria((c) => c.filter((x) => x.id !== id));
    setLevelsByCriterion((m) => { const n = { ...m }; delete n[id]; return n; });
  };

  const addLevel = async (criterionId: string) => {
    const existing = levelsByCriterion[criterionId] || [];
    const { data, error } = await supabase
      .from("rubric_levels")
      .insert({
        criterion_id: criterionId,
        label: "Nová úroveň",
        points: 0,
        sort_order: existing.length,
      })
      .select()
      .single();
    if (error || !data) { toast.error(error?.message || "Chyba"); return; }
    setLevelsByCriterion((m) => ({ ...m, [criterionId]: [...(m[criterionId] || []), data as Level] }));
  };

  const updateLevel = async (l: Level, patch: Partial<Level>) => {
    setLevelsByCriterion((m) => ({
      ...m,
      [l.criterion_id]: (m[l.criterion_id] || []).map((x) => x.id === l.id ? { ...x, ...patch } : x),
    }));
    await supabase.from("rubric_levels").update(patch).eq("id", l.id);
  };

  const deleteLevel = async (l: Level) => {
    const { error } = await supabase.from("rubric_levels").delete().eq("id", l.id);
    if (error) { toast.error(error.message); return; }
    setLevelsByCriterion((m) => ({
      ...m,
      [l.criterion_id]: (m[l.criterion_id] || []).filter((x) => x.id !== l.id),
    }));
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Úprava rubriky</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 mt-2">
          <div>
            <Label>Název rubriky</Label>
            <div className="flex gap-2 mt-1">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              <Button variant="outline" onClick={saveTitle} disabled={!title.trim() || title === rubric.title}>
                <Save className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Kritéria a úrovně</Label>
              <Button size="sm" variant="outline" onClick={addCriterion} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Přidat kritérium
              </Button>
            </div>
            {loading ? (
              <p className="text-sm text-muted-foreground">Načítání…</p>
            ) : criteria.length === 0 ? (
              <p className="text-sm text-muted-foreground">Zatím žádná kritéria.</p>
            ) : (
              criteria.map((c) => (
                <Card key={c.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={c.title}
                        onChange={(e) => setCriteria((cs) => cs.map((x) => x.id === c.id ? { ...x, title: e.target.value } : x))}
                        onBlur={(e) => updateCriterion(c.id, e.target.value)}
                        className="font-medium"
                      />
                      <Button size="sm" variant="ghost" onClick={() => deleteCriterion(c.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {(levelsByCriterion[c.id] || []).map((l) => (
                      <div key={l.id} className="flex items-center gap-2">
                        <Input
                          value={l.label}
                          onChange={(e) => setLevelsByCriterion((m) => ({
                            ...m,
                            [c.id]: (m[c.id] || []).map((x) => x.id === l.id ? { ...x, label: e.target.value } : x),
                          }))}
                          onBlur={(e) => updateLevel(l, { label: e.target.value })}
                          placeholder="např. Vynikající"
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          step="0.5"
                          value={l.points}
                          onChange={(e) => setLevelsByCriterion((m) => ({
                            ...m,
                            [c.id]: (m[c.id] || []).map((x) => x.id === l.id ? { ...x, points: Number(e.target.value) } : x),
                          }))}
                          onBlur={(e) => updateLevel(l, { points: Number(e.target.value) })}
                          className="w-24"
                          placeholder="Body"
                        />
                        <Button size="sm" variant="ghost" onClick={() => deleteLevel(l)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <Button size="sm" variant="ghost" onClick={() => addLevel(c.id)} className="gap-1.5">
                      <Plus className="w-3.5 h-3.5" /> Přidat úroveň
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={onClose}>Hotovo</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TeacherRubrics;
