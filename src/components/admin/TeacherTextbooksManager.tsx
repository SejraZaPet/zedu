import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LessonPreviewDialog from "./LessonPreviewDialog";
import { useSubjects } from "@/hooks/useSubjects";
import type { Block } from "@/lib/textbook-config";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus, Pencil, Trash2, Copy, ArrowLeft, BookOpen,
  ChevronRight, FolderOpen, Unlink,
} from "lucide-react";
import LessonEditorSheet from "@/components/LessonEditorSheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Textbook {
  id: string;
  title: string;
  description: string;
  subject: string;
  access_code: string;
  visibility: string;
  created_at: string;
}

interface GlobalLesson {
  id: string;
  title: string;
  sort_order: number;
  status: string;
  blocks: Block[];
  topic_id: string;
}

interface TopicWithLessons {
  id: string;
  title: string;
  grade: number;
  sort_order: number;
  lessons: GlobalLesson[];
}

interface GradeGroup {
  grade: number;
  label: string;
  topics: TopicWithLessons[];
}

const TeacherTextbooksManager = () => {
  const { toast } = useToast();
  const { data: subjects } = useSubjects(true);
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [loading, setLoading] = useState(true);

  // Views
  const [selectedTextbook, setSelectedTextbook] = useState<Textbook | null>(null);
  const [gradeGroups, setGradeGroups] = useState<GradeGroup[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Topic management
  const [createTopicOpen, setCreateTopicOpen] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [newTopicGrade, setNewTopicGrade] = useState<number>(1);
  const [editingTopic, setEditingTopic] = useState<{ id: string; title: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Global lesson editor (LessonEditorSheet for textbook_lessons)
  const [globalEditLessonId, setGlobalEditLessonId] = useState<string | null>(null);

  // Remove lesson from topic confirmation
  const [removingLesson, setRemovingLesson] = useState<GlobalLesson | null>(null);

  // Add lesson dialog
  const [addLessonOpen, setAddLessonOpen] = useState(false);
  const [addLessonTopicId, setAddLessonTopicId] = useState<string>("");
  const [addLessonMode, setAddLessonMode] = useState<"select" | "create">("select");
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [existingLessons, setExistingLessons] = useState<{ id: string; title: string; status: string }[]>([]);
  const [selectedExistingLessonId, setSelectedExistingLessonId] = useState<string>("");

  const fetchTextbooks = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("teacher_textbooks")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setTextbooks(data as Textbook[]);
    setLoading(false);
  };

  useEffect(() => { fetchTextbooks(); }, []);

  const fetchDetail = useCallback(async () => {
    if (!selectedTextbook) return;
    setDetailLoading(true);
    const subjectSlug = selectedTextbook.subject;

    const { data: topics } = await supabase
      .from("textbook_topics")
      .select("*")
      .eq("subject", subjectSlug)
      .order("sort_order");

    const topicIds = (topics ?? []).map((t: any) => t.id);
    let tbLessons: any[] = [];
    if (topicIds.length > 0) {
      const { data } = await supabase
        .from("textbook_lessons")
        .select("*")
        .in("topic_id", topicIds)
        .order("sort_order");
      tbLessons = data ?? [];
    }

    // Also include lessons via lesson_topic_assignments
    let assignmentLessons: any[] = [];
    if (topicIds.length > 0) {
      const { data } = await supabase
        .from("lesson_topic_assignments")
        .select("topic_id, sort_order, textbook_lessons(id, title, status, blocks, sort_order, topic_id)")
        .in("topic_id", topicIds);
      assignmentLessons = data ?? [];
    }

    const matchedSubject = subjects?.find(s => s.slug === subjectSlug);
    const grades = matchedSubject?.grades ?? [];

    const groups: GradeGroup[] = grades.map(g => {
      const gradeTopics = (topics ?? [])
        .filter((t: any) => t.grade === g.grade_number)
        .map((t: any) => {
          const topicLessons: GlobalLesson[] = tbLessons
            .filter((l: any) => l.topic_id === t.id)
            .map((l: any) => ({
              id: l.id,
              title: l.title,
              sort_order: l.sort_order ?? 0,
              status: l.status ?? "draft",
              blocks: (l.blocks as Block[]) ?? [],
              topic_id: t.id,
            }));

          // Add lessons from assignments (multi-placement)
          const assignedHere = assignmentLessons
            .filter((a: any) => a.topic_id === t.id && a.textbook_lessons)
            .map((a: any) => ({
              id: a.textbook_lessons.id,
              title: a.textbook_lessons.title,
              sort_order: a.sort_order ?? a.textbook_lessons.sort_order ?? 0,
              status: a.textbook_lessons.status ?? "draft",
              blocks: (a.textbook_lessons.blocks as Block[]) ?? [],
              topic_id: t.id,
            }));

          const allLessons = [...topicLessons];
          for (const al of assignedHere) {
            if (!allLessons.some(l => l.id === al.id)) allLessons.push(al);
          }

          return {
            id: t.id,
            title: t.title,
            grade: t.grade,
            sort_order: t.sort_order ?? 0,
            lessons: allLessons,
          } as TopicWithLessons;
        });

      return { grade: g.grade_number, label: g.label, topics: gradeTopics };
    });

    setGradeGroups(groups);
    setDetailLoading(false);
  }, [selectedTextbook, subjects]);

  useEffect(() => { if (selectedTextbook) fetchDetail(); }, [fetchDetail, selectedTextbook]);

  const handleDelete = async (id: string) => {
    if (!confirm("Opravdu smazat tuto učebnici?")) return;
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

  // === Topic CRUD ===
  const handleCreateTopic = async () => {
    if (!newTopicTitle.trim() || !selectedTextbook) return;
    setSaving(true);
    const subjectSlug = selectedTextbook.subject;

    const { data: existingTopics } = await supabase
      .from("textbook_topics")
      .select("sort_order")
      .eq("subject", subjectSlug)
      .eq("grade", newTopicGrade)
      .order("sort_order", { ascending: false })
      .limit(1);

    const nextOrder = existingTopics && existingTopics.length > 0 ? (existingTopics[0] as any).sort_order + 1 : 0;

    const { error } = await supabase.from("textbook_topics").insert({
      title: newTopicTitle.trim(),
      subject: subjectSlug,
      grade: newTopicGrade,
      sort_order: nextOrder,
    });

    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Téma vytvořeno" });
      setNewTopicTitle("");
      setCreateTopicOpen(false);
      fetchDetail();
    }
    setSaving(false);
  };

  const handleDeleteTopic = async (topicId: string, lessonCount: number) => {
    if (lessonCount > 0) {
      if (!confirm(`Toto téma obsahuje ${lessonCount} lekcí. Lekce nebudou smazány, pouze odpojeny. Pokračovat?`)) return;
    } else {
      if (!confirm("Opravdu smazat toto téma?")) return;
    }
    const { error } = await supabase.from("textbook_topics").delete().eq("id", topicId);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Téma smazáno" });
      fetchDetail();
    }
  };

  const handleRenameTopic = async () => {
    if (!editingTopic || !editingTopic.title.trim()) return;
    const { error } = await supabase.from("textbook_topics")
      .update({ title: editingTopic.title.trim() })
      .eq("id", editingTopic.id);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Téma přejmenováno" });
      setEditingTopic(null);
      fetchDetail();
    }
  };

  // === Remove lesson from topic (not delete) ===
  const confirmRemoveLesson = async () => {
    if (!removingLesson) return;
    // If the lesson's primary topic_id matches, we need to unlink it
    // Check if lesson's topic_id == removingLesson.topic_id
    const { data: lessonData } = await supabase
      .from("textbook_lessons")
      .select("topic_id")
      .eq("id", removingLesson.id)
      .single();

    if (lessonData && (lessonData as any).topic_id === removingLesson.topic_id) {
      // This is the primary assignment - remove by deleting assignment or updating topic_id
      // For now just remove the lesson_topic_assignments entry if exists, 
      // but since the lesson's topic_id IS this topic, we can't just unlink without orphaning
      // Best approach: delete the lesson_topic_assignments for this topic, 
      // but also check if there are other assignments to move primary to
      await supabase
        .from("lesson_topic_assignments")
        .delete()
        .eq("lesson_id", removingLesson.id)
        .eq("topic_id", removingLesson.topic_id);
      
      // Check remaining assignments
      const { data: remaining } = await supabase
        .from("lesson_topic_assignments")
        .select("topic_id")
        .eq("lesson_id", removingLesson.id)
        .limit(1);
      
      if (remaining && remaining.length > 0) {
        // Move primary to another assignment
        await supabase
          .from("textbook_lessons")
          .update({ topic_id: (remaining[0] as any).topic_id })
          .eq("id", removingLesson.id);
      }
      // If no remaining assignments, the lesson becomes orphaned but still exists in Lekce section
      // We'll leave the topic_id as is - lesson is still accessible from Lekce manager
    } else {
      // This is a secondary assignment via lesson_topic_assignments
      await supabase
        .from("lesson_topic_assignments")
        .delete()
        .eq("lesson_id", removingLesson.id)
        .eq("topic_id", removingLesson.topic_id);
    }

    toast({ title: "Lekce odebrána z tématu" });
    setRemovingLesson(null);
    fetchDetail();
  };

  // === Add lesson to topic ===
  const openAddLesson = async (topicId: string) => {
    setAddLessonTopicId(topicId);
    setAddLessonMode("select");
    setNewLessonTitle("");
    setSelectedExistingLessonId("");

    // Fetch all existing lessons for the picker
    const { data } = await supabase
      .from("textbook_lessons")
      .select("id, title, status")
      .order("title");
    setExistingLessons((data ?? []) as any[]);
    setAddLessonOpen(true);
  };

  const handleAddExistingLesson = async () => {
    if (!selectedExistingLessonId || !addLessonTopicId) return;
    setSaving(true);

    // Check if already assigned
    const { data: existing } = await supabase
      .from("lesson_topic_assignments")
      .select("id")
      .eq("lesson_id", selectedExistingLessonId)
      .eq("topic_id", addLessonTopicId)
      .limit(1);

    // Also check if it's the primary topic
    const { data: lessonData } = await supabase
      .from("textbook_lessons")
      .select("topic_id")
      .eq("id", selectedExistingLessonId)
      .single();

    if ((lessonData as any)?.topic_id === addLessonTopicId || (existing && existing.length > 0)) {
      toast({ title: "Lekce již přiřazena", description: "Tato lekce je v tomto tématu již přiřazena.", variant: "destructive" });
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("lesson_topic_assignments").insert({
      lesson_id: selectedExistingLessonId,
      topic_id: addLessonTopicId,
      sort_order: 0,
    });

    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Lekce přiřazena" });
      setAddLessonOpen(false);
      fetchDetail();
    }
    setSaving(false);
  };

  const handleCreateNewLesson = async () => {
    if (!newLessonTitle.trim() || !addLessonTopicId) return;
    setSaving(true);

    const { data, error } = await supabase.from("textbook_lessons").insert({
      title: newLessonTitle.trim(),
      topic_id: addLessonTopicId,
      sort_order: 0,
      blocks: [],
      status: "draft",
    }).select("id").single();

    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Lekce vytvořena" });
      setAddLessonOpen(false);
      fetchDetail();
      // Open editor for the new lesson
      if (data) setGlobalEditLessonId((data as any).id);
    }
    setSaving(false);
  };

  // === Textbook Detail View ===
  if (selectedTextbook) {
    const matchedSubject = subjects?.find(s => s.slug === selectedTextbook.subject);
    const totalLessons = gradeGroups.reduce((sum, g) => sum + g.topics.reduce((s, t) => s + t.lessons.length, 0), 0);

    return (
      <>
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setSelectedTextbook(null); setGradeGroups([]); }}>
              <ArrowLeft className="w-4 h-4 mr-1" />Zpět na učebnice
            </Button>
          </div>

          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-heading text-xl font-bold">{selectedTextbook.title}</h2>
              {matchedSubject && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: matchedSubject.color }} />
                  <span className="text-sm text-muted-foreground">{matchedSubject.label}</span>
                  {matchedSubject.abbreviation && (
                    <Badge variant="outline" className="text-[10px]">{matchedSubject.abbreviation}</Badge>
                  )}
                </div>
              )}
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

          {detailLoading ? (
            <p className="text-muted-foreground text-sm">Načítání obsahu...</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Struktura předmětu ({totalLessons} lekcí celkem)
                </h3>
                <Button size="sm" variant="outline" onClick={() => {
                  const firstGrade = matchedSubject?.grades[0]?.grade_number ?? 1;
                  setNewTopicGrade(firstGrade);
                  setNewTopicTitle("");
                  setCreateTopicOpen(true);
                }}>
                  <Plus className="w-4 h-4 mr-1" />Přidat téma
                </Button>
              </div>

              {gradeGroups.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-border rounded-lg">
                  <BookOpen className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">Zatím žádná struktura</p>
                  <p className="text-xs text-muted-foreground">Přidejte témata a přiřaďte lekce.</p>
                </div>
              ) : (
                gradeGroups.map((group) => (
                  <div key={group.grade} className="border border-border rounded-lg overflow-hidden">
                    <div className="bg-muted/30 px-4 py-2 border-b border-border">
                      <h4 className="font-heading text-sm font-semibold">{group.label}</h4>
                    </div>
                    <div className="p-3 space-y-2">
                      {group.topics.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2 text-center">Žádná témata pro tento ročník</p>
                      ) : (
                        group.topics.map((topic) => (
                          <div key={topic.id} className="border border-border rounded-md">
                            <div className="flex items-center gap-2 px-3 py-2 bg-card">
                              <FolderOpen className="w-4 h-4 text-primary" />
                              <span className="text-sm font-medium flex-1">{topic.title}</span>
                              <Badge variant="secondary" className="text-[10px]">
                                {topic.lessons.length} {topic.lessons.length === 1 ? "lekce" : "lekcí"}
                              </Badge>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingTopic({ id: topic.id, title: topic.title })}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDeleteTopic(topic.id, topic.lessons.length)}>
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </Button>
                            </div>
                            {topic.lessons.length > 0 && (
                              <div className="border-t border-border divide-y divide-border">
                                {topic.lessons.map((lesson) => (
                                  <div key={lesson.id} className="flex items-center gap-2 px-3 py-2 text-sm group hover:bg-muted/10 transition-colors">
                                    <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                                    <button
                                      className="flex-1 text-left truncate hover:text-primary transition-colors cursor-pointer"
                                      onClick={() => setGlobalEditLessonId(lesson.id)}
                                    >
                                      {lesson.title}
                                    </button>
                                    <Badge variant={lesson.status === "published" ? "default" : "secondary"} className="text-[10px] shrink-0">
                                      {lesson.status === "published" ? "Pub" : "Konc"}
                                    </Badge>
                                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setGlobalEditLessonId(lesson.id)} title="Upravit">
                                        <Pencil className="w-3.5 h-3.5" />
                                      </Button>
                                      <LessonPreviewDialog title={lesson.title} heroImageUrl={null} blocks={lesson.blocks} />
                                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setRemovingLesson(lesson)} title="Odebrat z tématu">
                                        <Unlink className="w-3.5 h-3.5 text-destructive" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* Add lesson to topic */}
                            <div className="border-t border-border px-3 py-1.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground"
                                onClick={() => openAddLesson(topic.id)}
                              >
                                <Plus className="w-3 h-3" /> Přidat lekci
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Create topic dialog */}
        <Dialog open={createTopicOpen} onOpenChange={setCreateTopicOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Nové téma</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label>Název tématu</Label>
                <Input value={newTopicTitle} onChange={(e) => setNewTopicTitle(e.target.value)} className="mt-1" placeholder="např. Hygiena v kuchyni" />
              </div>
              <div>
                <Label>Ročník</Label>
                <Select value={String(newTopicGrade)} onValueChange={(v) => setNewTopicGrade(Number(v))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {matchedSubject?.grades.map(g => (
                      <SelectItem key={g.grade_number} value={String(g.grade_number)}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreateTopic} disabled={saving || !newTopicTitle.trim()} className="w-full">
                {saving ? "Vytvářím..." : "Vytvořit téma"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Rename topic dialog */}
        <Dialog open={!!editingTopic} onOpenChange={(open) => { if (!open) setEditingTopic(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Přejmenovat téma</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label>Název tématu</Label>
                <Input value={editingTopic?.title ?? ""} onChange={(e) => setEditingTopic(editingTopic ? { ...editingTopic, title: e.target.value } : null)} className="mt-1" />
              </div>
              <Button onClick={handleRenameTopic} disabled={!editingTopic?.title.trim()} className="w-full">Uložit</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add lesson dialog */}
        <Dialog open={addLessonOpen} onOpenChange={setAddLessonOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Přidat lekci do tématu</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={addLessonMode === "select" ? "default" : "outline"}
                  onClick={() => setAddLessonMode("select")}
                  className="flex-1"
                >
                  Vybrat existující
                </Button>
                <Button
                  size="sm"
                  variant={addLessonMode === "create" ? "default" : "outline"}
                  onClick={() => setAddLessonMode("create")}
                  className="flex-1"
                >
                  Vytvořit novou
                </Button>
              </div>

              {addLessonMode === "select" ? (
                <>
                  <div>
                    <Label>Lekce</Label>
                    <Select value={selectedExistingLessonId} onValueChange={setSelectedExistingLessonId}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Vyberte lekci…" /></SelectTrigger>
                      <SelectContent>
                        {existingLessons.map(l => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.title} {l.status === "draft" ? "(koncept)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleAddExistingLesson} disabled={saving || !selectedExistingLessonId} className="w-full">
                    {saving ? "Přiřazuji..." : "Přiřadit lekci"}
                  </Button>
                </>
              ) : (
                <>
                  <div>
                    <Label>Název nové lekce</Label>
                    <Input value={newLessonTitle} onChange={(e) => setNewLessonTitle(e.target.value)} className="mt-1" placeholder="např. Úvod do hygieny" />
                  </div>
                  <Button onClick={handleCreateNewLesson} disabled={saving || !newLessonTitle.trim()} className="w-full">
                    {saving ? "Vytvářím..." : "Vytvořit a přiřadit"}
                  </Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Remove lesson confirmation */}
        <AlertDialog open={!!removingLesson} onOpenChange={(open) => { if (!open) setRemovingLesson(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Odebrat lekci z tématu</AlertDialogTitle>
              <AlertDialogDescription>
                Lekce „{removingLesson?.title}" bude odebrána z tohoto tématu. Samotná lekce nebude smazána a zůstane dostupná v sekci Lekce.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Zrušit</AlertDialogCancel>
              <AlertDialogAction onClick={confirmRemoveLesson}>
                Odebrat
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Global lesson editor sheet */}
        {globalEditLessonId && (
          <LessonEditorSheet
            lessonId={globalEditLessonId}
            open={!!globalEditLessonId}
            onOpenChange={(open) => { if (!open) setGlobalEditLessonId(null); }}
            onSaved={() => { setGlobalEditLessonId(null); fetchDetail(); }}
          />
        )}
      </>
    );
  }

  // === Textbooks List ===
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold">Moje učebnice</h2>
        <p className="text-sm text-muted-foreground">
          Učebnice se automaticky vytvářejí při přidání předmětu v sekci Předměty.
        </p>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Načítání...</p>
      ) : textbooks.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-heading text-lg font-semibold mb-2">Zatím nemáte žádné učebnice</h3>
          <p className="text-muted-foreground mb-2">Učebnice se vytvoří automaticky, když přidáte nový předmět v sekci „Předměty".</p>
          <p className="text-xs text-muted-foreground">Přejděte na tab Předměty a vytvořte svůj první předmět.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {textbooks.map((tb) => {
            const matchedSubject = subjects?.find(s => s.slug === tb.subject);
            return (
              <div key={tb.id} className="flex items-center gap-4 border border-border rounded-lg p-4 bg-card hover:shadow-sm transition-shadow">
                {matchedSubject && (
                  <div className="w-3 h-10 rounded-full shrink-0" style={{ backgroundColor: matchedSubject.color }} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading font-semibold truncate">{tb.title}</h3>
                    {matchedSubject?.abbreviation && (
                      <Badge variant="outline" className="text-[10px]">{matchedSubject.abbreviation}</Badge>
                    )}
                  </div>
                  {matchedSubject && (
                    <div className="flex gap-1 mt-1">
                      {matchedSubject.grades.map(g => (
                        <Badge key={g.id} variant="secondary" className="text-[10px] px-1.5 py-0">{g.label}</Badge>
                      ))}
                    </div>
                  )}
                  {tb.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{tb.description}</p>}
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
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TeacherTextbooksManager;
