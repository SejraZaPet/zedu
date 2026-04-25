import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import BlockEditor from "@/components/admin/BlockEditor";
import type { Block } from "@/lib/textbook-config";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import {
  Plus, ArrowLeft, Pencil, Trash2, GripVertical, Eye, EyeOff, FileText
} from "lucide-react";
import { emptyWorksheetSpec } from "@/lib/worksheet-defaults";

interface Lesson {
  id: string;
  title: string;
  sort_order: number;
  status: string;
  blocks: any[];
  created_at: string;
}

const TeacherLessons = () => {
  const { textbookId } = useParams<{ textbookId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [editBlocks, setEditBlocks] = useState<Block[]>([]);
  const [textbookTitle, setTextbookTitle] = useState("");

  const fetchLessons = async () => {
    if (!textbookId) return;
    const { data } = await supabase
      .from("teacher_textbook_lessons")
      .select("*")
      .eq("textbook_id", textbookId)
      .order("sort_order", { ascending: true });
    if (data) setLessons(data as Lesson[]);
    setLoading(false);
  };

  useEffect(() => {
    const fetchTextbook = async () => {
      if (!textbookId) return;
      const { data } = await supabase
        .from("teacher_textbooks")
        .select("title")
        .eq("id", textbookId)
        .single();
      if (data) setTextbookTitle((data as any).title);
    };
    fetchTextbook();
    fetchLessons();
  }, [textbookId]);

  const handleCreate = async () => {
    if (!newTitle.trim() || !textbookId) return;
    setSaving(true);

    const maxOrder = lessons.length > 0 ? Math.max(...lessons.map(l => l.sort_order)) + 1 : 0;

    const { error } = await supabase.from("teacher_textbook_lessons").insert({
      title: newTitle.trim(),
      textbook_id: textbookId,
      sort_order: maxOrder,
      blocks: [],
    } as any);

    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Vytvořeno" });
      setNewTitle("");
      setCreateOpen(false);
      fetchLessons();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Opravdu smazat lekci?")) return;
    await supabase.from("teacher_textbook_lessons").delete().eq("id", id);
    fetchLessons();
  };

  const toggleStatus = async (lesson: Lesson) => {
    const newStatus = lesson.status === "published" ? "draft" : "published";
    await supabase.from("teacher_textbook_lessons").update({ status: newStatus }).eq("id", lesson.id);
    fetchLessons();
  };

  const handleSaveBlocks = async () => {
    if (!editingLesson) return;
    const { error } = await supabase
      .from("teacher_textbook_lessons")
      .update({ blocks: editBlocks as any } as any)
      .eq("id", editingLesson.id);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Uloženo" });
      setEditingLesson(null);
      fetchLessons();
    }
  };

  const openEditor = (lesson: Lesson) => {
    setEditingLesson(lesson);
    setEditBlocks((lesson.blocks || []) as Block[]);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl" style={{ paddingTop: "calc(70px + 3rem)" }}>
        <Button variant="ghost" size="sm" onClick={() => navigate("/ucitel/ucebnice")} className="mb-4 gap-2">
          <ArrowLeft className="w-4 h-4" /> Zpět na učebnice
        </Button>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading text-2xl font-bold">Lekce: {textbookTitle}</h1>
            <p className="text-muted-foreground mt-1">Přidávejte a upravujte lekce v učebnici.</p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> Přidat lekci
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nová lekce</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label>Název lekce</Label>
                  <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="mt-1" placeholder="např. Úvod do gastronomie" />
                </div>
                <Button onClick={handleCreate} disabled={saving || !newTitle.trim()} className="w-full">
                  {saving ? "Vytvářím..." : "Vytvořit lekci"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Načítání...</p>
        ) : lessons.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground mb-4">Zatím nemáte žádné lekce.</p>
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Přidat první lekci
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {lessons.map((lesson) => (
              <div key={lesson.id} className="bg-card border border-border rounded-lg p-4 flex items-center gap-4">
                <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{lesson.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      lesson.status === "published"
                        ? "bg-green-500/20 text-green-600"
                        : "bg-yellow-500/20 text-yellow-600"
                    }`}>
                      {lesson.status === "published" ? "Publikováno" : "Koncept"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {(lesson.blocks || []).length} bloků
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      const { data: { user } } = await supabase.auth.getUser();
                      if (!user) return;
                      const title = `Pracovní list – ${lesson.title}`;
                      const spec = emptyWorksheetSpec({ title });
                      const { data, error } = await supabase
                        .from("worksheets" as any)
                        .insert({
                          teacher_id: user.id,
                          title,
                          spec: spec as any,
                          source_lesson_id: lesson.id,
                          source_lesson_type: "teacher",
                        } as any)
                        .select("id")
                        .single();
                      if (error || !data) {
                        toast({ title: "Chyba", description: error?.message, variant: "destructive" });
                        return;
                      }
                      await supabase.from("worksheet_lessons" as any).insert({
                        worksheet_id: (data as any).id,
                        lesson_id: lesson.id,
                        lesson_type: "teacher",
                        added_by: user.id,
                      } as any);
                      navigate(`/ucitel/pracovni-listy/${(data as any).id}`);
                    }}
                    title="Vytvořit pracovní list z této lekce"
                  >
                    <FileText className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleStatus(lesson)} title={lesson.status === "published" ? "Skrýt" : "Publikovat"}>
                    {lesson.status === "published" ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openEditor(lesson)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(lesson.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />

      {editingLesson && (
        <Sheet open={!!editingLesson} onOpenChange={(open) => { if (!open) setEditingLesson(null); }}>
          <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Úprava: {editingLesson.title}</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              <BlockEditor blocks={editBlocks} onChange={setEditBlocks} />
              <Button onClick={handleSaveBlocks} className="w-full">Uložit bloky</Button>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
};

export default TeacherLessons;
