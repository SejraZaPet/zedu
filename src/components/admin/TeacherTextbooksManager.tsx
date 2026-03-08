import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BlockEditor from "./BlockEditor";
import LessonPreviewDialog from "./LessonPreviewDialog";
import LessonPlacementEditor, { savePlacements, type Placement } from "./LessonPlacementEditor";
import { useSubjects, type SubjectRecord } from "@/hooks/useSubjects";
import type { Block } from "@/lib/textbook-config";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus, Pencil, Trash2, Copy, ArrowLeft, Save, X, Eye, EyeOff, GripVertical, BookOpen,
  ChevronRight, FolderOpen,
} from "lucide-react";

interface Textbook {
  id: string;
  title: string;
  description: string;
  subject: string; // stores slug
  access_code: string;
  visibility: string;
  created_at: string;
}

interface TeacherLesson {
  id: string;
  textbook_id: string;
  title: string;
  sort_order: number;
  status: string;
  blocks: Block[];
  created_at: string;
}

interface TopicWithLessons {
  id: string;
  title: string;
  grade: number;
  sort_order: number;
  lessons: GlobalLesson[];
}

interface GlobalLesson {
  id: string;
  title: string;
  sort_order: number;
  status: string;
  blocks: Block[];
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
  const [teacherLessons, setTeacherLessons] = useState<TeacherLesson[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Lesson editor
  const [editingLesson, setEditingLesson] = useState<TeacherLesson | null>(null);
  const [isNewLesson, setIsNewLesson] = useState(false);

  // Create lesson dialog
  const [createLessonOpen, setCreateLessonOpen] = useState(false);
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [saving, setSaving] = useState(false);

  // Topic management
  const [createTopicOpen, setCreateTopicOpen] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [newTopicGrade, setNewTopicGrade] = useState<number>(1);
  const [editingTopic, setEditingTopic] = useState<{ id: string; title: string } | null>(null);
  const [lessonPlacements, setLessonPlacements] = useState<Placement[]>([]);

  const fetchTextbooks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("teacher_textbooks")
      .select("*")
      .order("created_at", { ascending: false });
    
    console.log("[TeacherTextbooks] Loaded:", data?.length ?? 0, error?.message ?? "");
    if (data) setTextbooks(data as Textbook[]);
    setLoading(false);
  };

  useEffect(() => { fetchTextbooks(); }, []);

  const fetchDetail = useCallback(async () => {
    if (!selectedTextbook) return;
    setDetailLoading(true);
    const subjectSlug = selectedTextbook.subject;

    // 1. Load global topics for this subject
    const { data: topics } = await supabase
      .from("textbook_topics")
      .select("*")
      .eq("subject", subjectSlug)
      .order("sort_order");

    // 2. Load textbook_lessons directly (single source of truth)
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

    // 2b. Load lessons placed via lesson_placements for this subject
    const { data: placementData } = await supabase
      .from("lesson_placements")
      .select("*, teacher_textbook_lessons(id, title, status, blocks, sort_order)")
      .eq("subject_slug", subjectSlug);

    // 3. Load subject grades
    const matchedSubject = subjects?.find(s => s.slug === subjectSlug);
    const grades = matchedSubject?.grades ?? [];

    // 4. Build grade groups
    const groups: GradeGroup[] = grades.map(g => {
      const gradeTopics = (topics ?? [])
        .filter((t: any) => t.grade === g.grade_number)
        .map((t: any) => {
          const topicLessons = tbLessons
            .filter((l: any) => l.topic_id === t.id)
            .map((l: any) => ({
              id: l.id,
              title: l.title,
              sort_order: l.sort_order ?? 0,
              status: l.status ?? "draft",
              blocks: (l.blocks as Block[]) ?? [],
            }));

          // Add lessons from placements for this topic+grade
          const placedLessons = (placementData ?? [])
            .filter((p: any) => p.topic_id === t.id && p.grade_number === g.grade_number && p.teacher_textbook_lessons)
            .map((p: any) => ({
              id: p.teacher_textbook_lessons.id,
              title: p.teacher_textbook_lessons.title,
              sort_order: p.teacher_textbook_lessons.sort_order ?? 0,
              status: p.teacher_textbook_lessons.status ?? "draft",
              blocks: (p.teacher_textbook_lessons.blocks as Block[]) ?? [],
            }));

          // Deduplicate by id
          const allLessons = [...topicLessons];
          for (const pl of placedLessons) {
            if (!allLessons.some(l => l.id === pl.id)) allLessons.push(pl);
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

    // 5. Also load teacher-specific lessons (teacher_textbook_lessons)
    const { data: tLessons } = await supabase
      .from("teacher_textbook_lessons")
      .select("*")
      .eq("textbook_id", selectedTextbook.id)
      .order("sort_order");
    
    setTeacherLessons((tLessons ?? []).map((d: any) => ({ ...d, blocks: (d.blocks as Block[]) || [] })));
    setDetailLoading(false);
  }, [selectedTextbook, subjects]);

  useEffect(() => { if (selectedTextbook) fetchDetail(); }, [fetchDetail, selectedTextbook]);

  const handleDelete = async (id: string) => {
    if (!confirm("Opravdu smazat tuto učebnici a všechny její lekce?")) return;
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
      if (!confirm(`Toto téma obsahuje ${lessonCount} lekcí. Opravdu jej chcete odstranit? Lekce budou smazány.`)) return;
    } else {
      if (!confirm("Opravdu smazat toto téma?")) return;
    }
    // CASCADE will handle lessons
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

  // === Teacher Lesson CRUD ===
  const handleCreateLesson = async () => {
    if (!newLessonTitle.trim() || !selectedTextbook) return;
    setSaving(true);
    const maxOrder = teacherLessons.length > 0 ? Math.max(...teacherLessons.map(l => l.sort_order)) + 1 : 0;

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
      fetchDetail();
    }
    setSaving(false);
  };

  const handleDeleteLesson = async (id: string) => {
    if (!confirm("Smazat lekci?")) return;
    await supabase.from("teacher_textbook_lessons").delete().eq("id", id);
    fetchDetail();
  };

  const toggleLessonStatus = async (lesson: TeacherLesson) => {
    const newStatus = lesson.status === "published" ? "draft" : "published";
    await supabase.from("teacher_textbook_lessons").update({ status: newStatus }).eq("id", lesson.id);
    fetchDetail();
  };

  const saveLesson = async () => {
    if (!editingLesson) return;
    const payload = {
      title: editingLesson.title,
      status: editingLesson.status,
      blocks: editingLesson.blocks as any,
    };

    let savedLessonId = editingLesson.id;

    if (isNewLesson) {
      const { data, error } = await supabase.from("teacher_textbook_lessons").insert({
        ...payload,
        textbook_id: selectedTextbook!.id,
        sort_order: teacherLessons.length,
      } as any).select("id").single();
      if (error) {
        toast({ title: "Chyba", description: error.message, variant: "destructive" });
        return;
      }
      savedLessonId = (data as any).id;
    } else {
      const { error } = await supabase.from("teacher_textbook_lessons")
        .update(payload as any)
        .eq("id", editingLesson.id);
      if (error) {
        toast({ title: "Chyba", description: error.message, variant: "destructive" });
        return;
      }
    }

    // Save placements
    try {
      await savePlacements(savedLessonId, lessonPlacements);
    } catch (err: any) {
      toast({ title: "Chyba při ukládání umístění", description: err.message, variant: "destructive" });
    }

    toast({ title: "Uloženo" });
    setEditingLesson(null);
    setIsNewLesson(false);
    setLessonPlacements([]);
    fetchDetail();
  };

  // === Lesson Editor View ===
  if (editingLesson) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => { setEditingLesson(null); setIsNewLesson(false); setLessonPlacements([]); }}>
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

          {/* Placement editor */}
          <LessonPlacementEditor
            lessonId={isNewLesson ? null : editingLesson.id}
            placements={lessonPlacements}
            onChange={setLessonPlacements}
          />

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
            <Button size="sm" variant="ghost" onClick={() => { setEditingLesson(null); setIsNewLesson(false); setLessonPlacements([]); }}>
              <X className="w-4 h-4 mr-1" />Zrušit
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // === Textbook Detail View ===
  if (selectedTextbook) {
    const matchedSubject = subjects?.find(s => s.slug === selectedTextbook.subject);
    const totalLessons = gradeGroups.reduce((sum, g) => sum + g.topics.reduce((s, t) => s + t.lessons.length, 0), 0) + teacherLessons.length;

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => { setSelectedTextbook(null); setGradeGroups([]); setTeacherLessons([]); }}>
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
          <>
            {/* Grade-based structure from global tables */}
            {gradeGroups.length > 0 && (
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

                {gradeGroups.map((group) => (
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
                                  <div key={lesson.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                                    <ChevronRight className="w-3 h-3 text-muted-foreground" />
                                    <span className="flex-1 truncate">{lesson.title}</span>
                                    <Badge variant={lesson.status === "published" ? "default" : "secondary"} className="text-[10px]">
                                      {lesson.status === "published" ? "Pub" : "Konc"}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Teacher's own lessons */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Vlastní lekce učitele ({teacherLessons.length})
                </h3>
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

              {teacherLessons.length === 0 && gradeGroups.every(g => g.topics.every(t => t.lessons.length === 0)) ? (
                <div className="text-center py-8 border border-dashed border-border rounded-lg">
                  <BookOpen className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">Zatím žádné lekce</p>
                  <p className="text-xs text-muted-foreground mb-3">Přidejte témata a lekce v sekci Předměty, nebo vytvořte vlastní lekci.</p>
                  <Button size="sm" onClick={() => setCreateLessonOpen(true)} className="gap-1">
                    <Plus className="w-4 h-4" />Přidat první lekci
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {teacherLessons.map((lesson) => (
                    <div key={lesson.id} className="flex items-center gap-2 border border-border rounded-lg p-3 bg-card">
                      <GripVertical className="w-4 h-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{lesson.title || "Bez názvu"}</p>
                        <span className="text-xs text-muted-foreground">{(lesson.blocks || []).length} bloků</span>
                      </div>
                      <Badge variant={lesson.status === "published" ? "default" : "secondary"} className="text-xs shrink-0">
                        {lesson.status === "published" ? "Publikováno" : "Koncept"}
                      </Badge>
                      <Button size="icon" variant="ghost" onClick={() => toggleLessonStatus(lesson)}>
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
          </>
        )}
      </div>
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
