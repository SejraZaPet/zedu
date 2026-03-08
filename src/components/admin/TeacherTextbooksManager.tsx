import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BlockEditor from "./BlockEditor";
import LessonPreviewDialog from "./LessonPreviewDialog";
import type { Block } from "@/lib/textbook-config";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus, Pencil, Trash2, Copy, ArrowLeft, Save, X, Eye, EyeOff, GripVertical, BookOpen,
} from "lucide-react";

interface Textbook {
  id: string;
  title: string;
  description: string;
  subject: string;
  access_code: string;
  visibility: string;
  created_at: string;
}

interface Lesson {
  id: string;
  textbook_id: string;
  title: string;
  sort_order: number;
  status: string;
  blocks: Block[];
  created_at: string;
}

function generateCode(length = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const TeacherTextbooksManager = () => {
  const { toast } = useToast();
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");

  // Views
  const [selectedTextbook, setSelectedTextbook] = useState<Textbook | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(false);

  // Lesson editor
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [isNewLesson, setIsNewLesson] = useState(false);

  // Create lesson dialog
  const [createLessonOpen, setCreateLessonOpen] = useState(false);
  const [newLessonTitle, setNewLessonTitle] = useState("");

  const fetchTextbooks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("teacher_textbooks")
      .select("*")
      .order("created_at", { ascending: false });
    
    console.log("[TeacherTextbooksManager] Loaded textbooks:", data?.length ?? 0, error ? `Error: ${error.message}` : "");
    if (data) setTextbooks(data as Textbook[]);
    setLoading(false);
  };

  useEffect(() => { fetchTextbooks(); }, []);

  const fetchLessons = useCallback(async () => {
    if (!selectedTextbook) return;
    setLessonsLoading(true);
    const { data, error } = await supabase
      .from("teacher_textbook_lessons")
      .select("*")
      .eq("textbook_id", selectedTextbook.id)
      .order("sort_order", { ascending: true });
    
    console.log("[TeacherTextbooksManager] Loaded lessons for", selectedTextbook.title, ":", data?.length ?? 0);
    if (data) setLessons(data.map((d: any) => ({ ...d, blocks: (d.blocks as Block[]) || [] })));
    setLessonsLoading(false);
  }, [selectedTextbook]);

  useEffect(() => { if (selectedTextbook) fetchLessons(); }, [fetchLessons, selectedTextbook]);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setSaving(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({ title: "Chyba", description: "Nejste přihlášeni.", variant: "destructive" });
      setSaving(false);
      return;
    }

    console.log("[TeacherTextbooksManager] Creating textbook. teacher_id:", session.user.id);

    const { error } = await supabase.from("teacher_textbooks").insert({
      title: title.trim(),
      description: description.trim(),
      subject: subject.trim(),
      teacher_id: session.user.id,
      access_code: generateCode(),
    } as any);

    if (error) {
      console.error("[TeacherTextbooksManager] Create error:", error);
      toast({ title: "Chyba při vytváření učebnice", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Vytvořeno", description: "Učebnice byla vytvořena." });
      setTitle("");
      setDescription("");
      setSubject("");
      setCreateOpen(false);
      fetchTextbooks();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Opravdu smazat tuto učebnici a všechny její lekce?")) return;
    // Delete lessons first
    await supabase.from("teacher_textbook_lessons").delete().eq("textbook_id", id);
    const { error } = await supabase.from("teacher_textbooks").delete().eq("id", id);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Smazáno" });
      if (selectedTextbook?.id === id) setSelectedTextbook(null);
      fetchTextbooks();
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Zkopírováno", description: `Kód ${code} zkopírován do schránky.` });
  };

  // === Lesson CRUD ===
  const handleCreateLesson = async () => {
    if (!newLessonTitle.trim() || !selectedTextbook) return;
    setSaving(true);
    const maxOrder = lessons.length > 0 ? Math.max(...lessons.map(l => l.sort_order)) + 1 : 0;

    const { error } = await supabase.from("teacher_textbook_lessons").insert({
      title: newLessonTitle.trim(),
      textbook_id: selectedTextbook.id,
      sort_order: maxOrder,
      blocks: [],
    } as any);

    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Lekce vytvořena" });
      setNewLessonTitle("");
      setCreateLessonOpen(false);
      fetchLessons();
    }
    setSaving(false);
  };

  const handleDeleteLesson = async (id: string) => {
    if (!confirm("Smazat lekci?")) return;
    await supabase.from("teacher_textbook_lessons").delete().eq("id", id);
    fetchLessons();
  };

  const toggleLessonStatus = async (lesson: Lesson) => {
    const newStatus = lesson.status === "published" ? "draft" : "published";
    await supabase.from("teacher_textbook_lessons").update({ status: newStatus }).eq("id", lesson.id);
    fetchLessons();
  };

  const saveLesson = async () => {
    if (!editingLesson) return;
    const payload = {
      title: editingLesson.title,
      status: editingLesson.status,
      blocks: editingLesson.blocks as any,
    };

    if (isNewLesson) {
      const { error } = await supabase.from("teacher_textbook_lessons").insert({
        ...payload,
        textbook_id: selectedTextbook!.id,
        sort_order: lessons.length,
      } as any);
      if (error) {
        toast({ title: "Chyba", description: error.message, variant: "destructive" });
        return;
      }
    } else {
      const { error } = await supabase.from("teacher_textbook_lessons")
        .update(payload as any)
        .eq("id", editingLesson.id);
      if (error) {
        toast({ title: "Chyba", description: error.message, variant: "destructive" });
        return;
      }
    }
    toast({ title: "Uloženo" });
    setEditingLesson(null);
    setIsNewLesson(false);
    fetchLessons();
  };

  // === Lesson Editor View ===
  if (editingLesson) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => { setEditingLesson(null); setIsNewLesson(false); }}>
            <ArrowLeft className="w-4 h-4 mr-1" />Zpět
          </Button>
          <span className="text-sm text-muted-foreground">
            {selectedTextbook?.title} / {editingLesson.title || "Nová lekce"}
          </span>
        </div>

        <div className="border border-border rounded-lg p-4 bg-card space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Název lekce</Label>
              <Input
                value={editingLesson.title}
                onChange={(e) => setEditingLesson({ ...editingLesson, title: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Stav</Label>
              <Select value={editingLesson.status} onValueChange={(v) => setEditingLesson({ ...editingLesson, status: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Koncept</SelectItem>
                  <SelectItem value="published">Publikováno</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Obsah lekce</Label>
            <BlockEditor
              blocks={editingLesson.blocks}
              onChange={(blocks) => setEditingLesson({ ...editingLesson, blocks })}
            />
          </div>

          <div className="flex gap-2 pt-2 border-t border-border">
            <Button size="sm" onClick={saveLesson}><Save className="w-4 h-4 mr-1" />Uložit lekci</Button>
            <LessonPreviewDialog
              title={editingLesson.title}
              heroImageUrl={null}
              blocks={editingLesson.blocks}
            />
            <Button size="sm" variant="ghost" onClick={() => { setEditingLesson(null); setIsNewLesson(false); }}>
              <X className="w-4 h-4 mr-1" />Zrušit
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // === Textbook Detail View ===
  if (selectedTextbook) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => { setSelectedTextbook(null); setLessons([]); }}>
            <ArrowLeft className="w-4 h-4 mr-1" />Zpět na učebnice
          </Button>
        </div>

        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-heading text-xl font-bold">{selectedTextbook.title}</h2>
            <p className="text-muted-foreground text-sm">{selectedTextbook.subject || "Bez předmětu"}</p>
            {selectedTextbook.description && <p className="text-sm mt-1">{selectedTextbook.description}</p>}
          </div>
          <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
            <span className="text-xs text-muted-foreground">Kód:</span>
            <span className="font-mono font-bold text-primary">{selectedTextbook.access_code}</span>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => copyCode(selectedTextbook.access_code)}>
              <Copy className="w-3 h-3" />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <h3 className="font-heading text-sm text-muted-foreground">Lekce ({lessons.length})</h3>
          <Button size="sm" onClick={() => setCreateLessonOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />Přidat lekci
          </Button>
        </div>

        <Dialog open={createLessonOpen} onOpenChange={setCreateLessonOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Nová lekce</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label>Název lekce</Label>
                <Input value={newLessonTitle} onChange={(e) => setNewLessonTitle(e.target.value)} className="mt-1" placeholder="např. Úvod do gastronomie" />
              </div>
              <Button onClick={handleCreateLesson} disabled={saving || !newLessonTitle.trim()} className="w-full">
                {saving ? "Vytvářím..." : "Vytvořit lekci"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {lessonsLoading ? (
          <p className="text-muted-foreground text-sm">Načítání lekcí...</p>
        ) : lessons.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-border rounded-lg">
            <BookOpen className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-2">Zatím žádné lekce</p>
            <Button size="sm" onClick={() => setCreateLessonOpen(true)} className="gap-1">
              <Plus className="w-4 h-4" />Přidat první lekci
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {lessons.map((lesson) => (
              <div key={lesson.id} className="flex items-center gap-2 border border-border rounded-lg p-3 bg-card">
                <GripVertical className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{lesson.title || "Bez názvu"}</p>
                  <span className="text-xs text-muted-foreground">{(lesson.blocks || []).length} bloků</span>
                </div>
                <Badge variant={lesson.status === "published" ? "default" : "secondary"} className="text-xs shrink-0">
                  {lesson.status === "published" ? "Publikováno" : "Koncept"}
                </Badge>
                <Button size="icon" variant="ghost" onClick={() => toggleLessonStatus(lesson)} title={lesson.status === "published" ? "Skrýt" : "Publikovat"}>
                  {lesson.status === "published" ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => { setEditingLesson(lesson); setIsNewLesson(false); }}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => handleDeleteLesson(lesson.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // === Textbooks List ===
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold">Moje učebnice</h2>
          <p className="text-sm text-muted-foreground">Vytvářejte a spravujte digitální učebnice pro vaše studenty.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />Vytvořit učebnici
        </Button>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nová učebnice</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Název učebnice</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" placeholder="např. Gastronomie pro 1. ročník" />
            </div>
            <div>
              <Label>Předmět</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1" placeholder="např. Gastronomie" />
            </div>
            <div>
              <Label>Popis</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" placeholder="Krátký popis učebnice..." rows={3} />
            </div>
            <Button onClick={handleCreate} disabled={saving || !title.trim()} className="w-full">
              {saving ? "Vytvářím..." : "Vytvořit učebnici"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {loading ? (
        <p className="text-muted-foreground">Načítání...</p>
      ) : textbooks.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-heading text-lg font-semibold mb-2">Zatím nemáte žádné učebnice</h3>
          <p className="text-muted-foreground mb-4">Vytvořte svou první digitální učebnici a sdílejte ji se studenty.</p>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />Vytvořit první učebnici
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {textbooks.map((tb) => (
            <div key={tb.id} className="flex items-center gap-4 border border-border rounded-lg p-4 bg-card hover:shadow-sm transition-shadow">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-heading font-semibold truncate">{tb.title}</h3>
                  <Badge variant="secondary" className="text-xs shrink-0">{tb.subject || "Bez předmětu"}</Badge>
                </div>
                {tb.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{tb.description}</p>}
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span>Vytvořeno: {new Date(tb.created_at).toLocaleDateString("cs")}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1 bg-primary/10 rounded-md px-2 py-1">
                  <span className="text-xs text-muted-foreground">Kód:</span>
                  <span className="font-mono text-sm font-bold text-primary">{tb.access_code}</span>
                  <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => copyCode(tb.access_code)}>
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
                <Button size="sm" variant="outline" onClick={() => setSelectedTextbook(tb)} className="gap-1">
                  <Pencil className="w-4 h-4" />Otevřít
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(tb.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TeacherTextbooksManager;
