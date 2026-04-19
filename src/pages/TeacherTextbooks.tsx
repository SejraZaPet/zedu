import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useSubjects } from "@/hooks/useSubjects";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import BlockEditor from "@/components/admin/BlockEditor";
import LessonPreviewDialog from "@/components/admin/LessonPreviewDialog";
import LessonPlacementEditor, { savePlacements, type Placement } from "@/components/admin/LessonPlacementEditor";
import type { Block } from "@/lib/textbook-config";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  BookOpen, Users, ArrowLeft, Copy, Eye, FolderOpen, ChevronRight,
  Pencil, Trash2, Plus, Save, Loader2, X, FileText, Play, Monitor,
} from "lucide-react";
import { blocksToSlides } from "@/lib/blocks-to-slides";
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

interface Enrollment {
  id: string;
  student_id: string;
  enrolled_at: string;
  profiles: { first_name: string; last_name: string; email: string } | null;
}

interface LessonItem {
  id: string;
  title: string;
  sort_order: number;
  status: string;
  blocks: Block[];
  source: "textbook_lessons" | "teacher_textbook_lessons";
  topic_id?: string;
}

interface TopicItem {
  id: string;
  title: string;
  lessons: LessonItem[];
}

interface GradeGroup {
  grade: number;
  label: string;
  topics: TopicItem[];
}

const TeacherTextbooks = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: subjects } = useSubjects(true);
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [loading, setLoading] = useState(true);

  // Detail view
  const [selectedTextbook, setSelectedTextbook] = useState<Textbook | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [gradeGroups, setGradeGroups] = useState<GradeGroup[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Lesson editor sheet
  const [editingLesson, setEditingLesson] = useState<LessonItem | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [lessonPlacements, setLessonPlacements] = useState<Placement[]>([]);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deletingLesson, setDeletingLesson] = useState<LessonItem | null>(null);

  // Create lesson dialog
  const [createLessonOpen, setCreateLessonOpen] = useState(false);
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [newLessonTopicId, setNewLessonTopicId] = useState<string>("");

  // Topic management
  const [createTopicOpen, setCreateTopicOpen] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [newTopicGrade, setNewTopicGrade] = useState<number>(1);
  const [editingTopic, setEditingTopic] = useState<{ id: string; title: string } | null>(null);

  // Presentation editor
  const [presentationLesson, setPresentationLesson] = useState<LessonItem | null>(null);
  const [pendingSlides, setPendingSlides] = useState<any[]>([]);
  const [editingSlideIndex, setEditingSlideIndex] = useState(0);

  const launchLiveSession = async (lesson: LessonItem, prebuiltSlides?: any[]) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: existing } = await supabase
          .from("game_sessions")
          .select("id, status")
          .eq("teacher_id", session.user.id)
          .eq("title", lesson.title)
          .in("status", ["lobby", "playing"])
          .maybeSingle();
        if (existing) {
          navigate(`/live/ucitel/${existing.id}`);
          return;
        }
      }
      const rawBlocks = lesson.blocks || [];
      const slides = prebuiltSlides || blocksToSlides(rawBlocks, lesson.title);
      if (!session?.user) throw new Error("Není přihlášen");
      const gameCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { data, error } = await supabase.from("game_sessions").insert({
        teacher_id: session.user.id,
        title: lesson.title,
        game_code: gameCode,
        activity_data: slides as any,
        settings: { timePerQuestion: 30, shuffleQuestions: false, shuffleAnswers: false, showLeaderboardAfterEach: false },
        status: "lobby",
        current_question_index: -1,
      }).select().single();
      if (error) throw error;
      if (!data?.id) throw new Error("Chybí ID session");
      toast({ title: "Prezentace spuštěna", description: `Kód: ${gameCode}` });
      navigate(`/live/ucitel/${data.id}`);
    } catch (e: any) {
      toast({ title: "Chyba", description: e?.message || "Nepodařilo se spustit prezentaci", variant: "destructive" });
    }
  };

  const fetchTextbooks = async () => {
    const { data } = await supabase
      .from("teacher_textbooks")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setTextbooks(data as Textbook[]);
    setLoading(false);
  };

  useEffect(() => { fetchTextbooks(); }, []);

  const fetchDetail = useCallback(async (tb: Textbook) => {
    setDetailLoading(true);

    // Load enrollments
    const { data: enrollData } = await supabase
      .from("teacher_textbook_enrollments")
      .select("id, student_id, enrolled_at, profiles(first_name, last_name, email)")
      .eq("textbook_id", tb.id)
      .order("enrolled_at", { ascending: false });
    if (enrollData) setEnrollments(enrollData as unknown as Enrollment[]);

    // Load grade structure
    const matchedSubject = subjects?.find(s => s.slug === tb.subject);
    if (!matchedSubject) { setGradeGroups([]); setDetailLoading(false); return; }

    const { data: topics } = await supabase
      .from("textbook_topics")
      .select("*")
      .eq("subject", tb.subject)
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

    // Load lessons placed via lesson_placements
    const { data: placementData } = await supabase
      .from("lesson_placements")
      .select("*, teacher_textbook_lessons(id, title, status, blocks, sort_order)")
      .eq("subject_slug", tb.subject);

    const groups: GradeGroup[] = matchedSubject.grades.map(g => {
      const gradeTopics = (topics ?? [])
        .filter((t: any) => t.grade === g.grade_number)
        .map((t: any) => {
          const topicLessons: LessonItem[] = tbLessons
            .filter((l: any) => l.topic_id === t.id)
            .map((l: any) => ({
              id: l.id,
              title: l.title,
              sort_order: l.sort_order ?? 0,
              status: l.status ?? "draft",
              blocks: (l.blocks as Block[]) ?? [],
              source: "textbook_lessons" as const,
              topic_id: t.id,
            }));

          const placedLessons: LessonItem[] = (placementData ?? [])
            .filter((p: any) => p.topic_id === t.id && p.grade_number === g.grade_number && p.teacher_textbook_lessons)
            .map((p: any) => ({
              id: p.teacher_textbook_lessons.id,
              title: p.teacher_textbook_lessons.title,
              sort_order: p.teacher_textbook_lessons.sort_order ?? 0,
              status: p.teacher_textbook_lessons.status ?? "draft",
              blocks: (p.teacher_textbook_lessons.blocks as Block[]) ?? [],
              source: "teacher_textbook_lessons" as const,
              topic_id: t.id,
            }));

          const allLessons = [...topicLessons];
          for (const pl of placedLessons) {
            if (!allLessons.some(l => l.id === pl.id)) allLessons.push(pl);
          }

          return { id: t.id, title: t.title, lessons: allLessons } as TopicItem;
        });

      return { grade: g.grade_number, label: g.label, topics: gradeTopics };
    });

    setGradeGroups(groups);
    setDetailLoading(false);
  }, [subjects]);

  const openDetail = useCallback(async (tb: Textbook) => {
    setSelectedTextbook(tb);
    fetchDetail(tb);
  }, [fetchDetail]);

  const refreshDetail = useCallback(() => {
    if (selectedTextbook) fetchDetail(selectedTextbook);
  }, [selectedTextbook, fetchDetail]);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Zkopírováno", description: `Kód ${code} zkopírován do schránky.` });
  };

  // === Lesson actions ===
  const openLessonEditor = (lesson: LessonItem) => {
    setEditingLesson({ ...lesson });
    setEditorOpen(true);
    setLessonPlacements([]);
  };

  const saveLessonEdit = async () => {
    if (!editingLesson) return;
    setSaving(true);

    const table = editingLesson.source;
    const payload: any = {
      title: editingLesson.title,
      status: editingLesson.status,
      blocks: editingLesson.blocks as any,
    };

    const { error } = await supabase.from(table).update(payload).eq("id", editingLesson.id);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    } else {
      // Save placements if teacher lesson
      if (table === "teacher_textbook_lessons" && lessonPlacements.length > 0) {
        try {
          await savePlacements(editingLesson.id, lessonPlacements);
        } catch (err: any) {
          toast({ title: "Chyba při ukládání umístění", description: err.message, variant: "destructive" });
        }
      }
      toast({ title: "Lekce uložena" });
      setEditorOpen(false);
      setEditingLesson(null);
      refreshDetail();
    }
    setSaving(false);
  };

  const confirmDeleteLesson = async () => {
    if (!deletingLesson) return;
    const table = deletingLesson.source;
    const { error } = await supabase.from(table).delete().eq("id", deletingLesson.id);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Lekce smazána" });
      refreshDetail();
    }
    setDeletingLesson(null);
  };

  // === Topic CRUD ===
  const handleCreateTopic = async () => {
    if (!newTopicTitle.trim() || !selectedTextbook) return;
    setSaving(true);

    const { data: existingTopics } = await supabase
      .from("textbook_topics")
      .select("sort_order")
      .eq("subject", selectedTextbook.subject)
      .eq("grade", newTopicGrade)
      .order("sort_order", { ascending: false })
      .limit(1);

    const nextOrder = existingTopics && existingTopics.length > 0 ? (existingTopics[0] as any).sort_order + 1 : 0;

    const { error } = await supabase.from("textbook_topics").insert({
      title: newTopicTitle.trim(),
      subject: selectedTextbook.subject,
      grade: newTopicGrade,
      sort_order: nextOrder,
    });

    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Téma vytvořeno" });
      setNewTopicTitle("");
      setCreateTopicOpen(false);
      refreshDetail();
    }
    setSaving(false);
  };

  const handleDeleteTopic = async (topicId: string, lessonCount: number) => {
    const msg = lessonCount > 0
      ? `Toto téma obsahuje ${lessonCount} lekcí. Opravdu jej chcete odstranit?`
      : "Opravdu smazat toto téma?";
    if (!confirm(msg)) return;
    const { error } = await supabase.from("textbook_topics").delete().eq("id", topicId);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Téma smazáno" });
      refreshDetail();
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
      refreshDetail();
    }
  };

  // === Create lesson ===
  const handleCreateLesson = async () => {
    if (!newLessonTitle.trim() || !newLessonTopicId) return;
    setSaving(true);

    const { data: existingLessons } = await supabase
      .from("textbook_lessons")
      .select("sort_order")
      .eq("topic_id", newLessonTopicId)
      .order("sort_order", { ascending: false })
      .limit(1);

    const nextOrder = existingLessons && existingLessons.length > 0 ? (existingLessons[0] as any).sort_order + 1 : 0;

    const { error } = await supabase.from("textbook_lessons").insert({
      title: newLessonTitle.trim(),
      topic_id: newLessonTopicId,
      sort_order: nextOrder,
      blocks: [],
      status: "draft",
    });

    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Lekce vytvořena" });
      setNewLessonTitle("");
      setCreateLessonOpen(false);
      refreshDetail();
    }
    setSaving(false);
  };

  // All topics flat for select
  const allTopics = gradeGroups.flatMap(g =>
    g.topics.map(t => ({ ...t, gradeLabel: g.label }))
  );

  // === DETAIL VIEW ===
  if (selectedTextbook) {
    const matchedSubject = subjects?.find(s => s.slug === selectedTextbook.subject);
    const totalLessons = gradeGroups.reduce((sum, g) =>
      sum + g.topics.reduce((s, t) => s + t.lessons.length, 0), 0
    );

    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SiteHeader />
        <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl" style={{ paddingTop: "calc(70px + 3rem)" }}>
          <Button variant="ghost" size="sm" onClick={() => setSelectedTextbook(null)} className="mb-4 gap-2">
            <ArrowLeft className="w-4 h-4" /> Zpět na učebnice
          </Button>

          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="font-heading text-2xl font-bold">{selectedTextbook.title}</h1>
              {matchedSubject && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: matchedSubject.color }} />
                  <span className="text-muted-foreground text-sm">{matchedSubject.label}</span>
                </div>
              )}
              {selectedTextbook.description && <p className="text-sm mt-2">{selectedTextbook.description}</p>}
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-card border border-border rounded-lg px-3 py-2 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Kód:</span>
                <span className="font-mono font-bold text-primary">{selectedTextbook.access_code}</span>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => copyCode(selectedTextbook.access_code)}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>

          {/* Structure */}
          <div className="bg-card border border-border rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-lg font-semibold flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" /> Struktura učebnice
                <Badge variant="secondary" className="text-xs">{totalLessons} lekcí</Badge>
              </h2>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => {
                  const firstGrade = matchedSubject?.grades[0]?.grade_number ?? 1;
                  setNewTopicGrade(firstGrade);
                  setNewTopicTitle("");
                  setCreateTopicOpen(true);
                }}>
                  <Plus className="w-4 h-4 mr-1" /> Téma
                </Button>
                {allTopics.length > 0 && (
                  <Button size="sm" onClick={() => {
                    setNewLessonTitle("");
                    setNewLessonTopicId(allTopics[0]?.id ?? "");
                    setCreateLessonOpen(true);
                  }}>
                    <Plus className="w-4 h-4 mr-1" /> Lekce
                  </Button>
                )}
              </div>
            </div>

            {detailLoading ? (
              <p className="text-sm text-muted-foreground">Načítání obsahu...</p>
            ) : gradeGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">Žádná struktura. Přidejte témata a lekce.</p>
            ) : (
              <div className="space-y-3">
                {gradeGroups.map((group) => (
                  <div key={group.grade} className="border border-border rounded-lg overflow-hidden">
                    <div className="bg-muted/30 px-4 py-2 border-b border-border">
                      <h4 className="text-sm font-semibold">{group.label}</h4>
                    </div>
                    <div className="p-2 space-y-2">
                      {group.topics.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2 text-center">Žádná témata</p>
                      ) : group.topics.map((topic) => (
                        <div key={topic.id} className="border border-border rounded-md">
                          {/* Topic header */}
                          <div className="flex items-center gap-2 px-3 py-2 bg-muted/10">
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

                          {/* Lessons */}
                          {topic.lessons.length > 0 && (
                            <div className="border-t border-border divide-y divide-border">
                              {topic.lessons.map((lesson) => (
                                <div key={lesson.id} className="flex items-center gap-2 px-3 py-2 text-sm group hover:bg-muted/10 transition-colors">
                                  <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                                  <button
                                    className="flex-1 text-left truncate hover:text-primary transition-colors cursor-pointer"
                                    onClick={() => openLessonEditor(lesson)}
                                  >
                                    {lesson.title}
                                  </button>
                                  <Badge
                                    variant={lesson.status === "published" ? "default" : "secondary"}
                                    className="text-[10px] shrink-0"
                                  >
                                    {lesson.status === "published" ? "Pub" : "Konc"}
                                  </Badge>
                                  <div className="flex gap-0.5 shrink-0">
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openLessonEditor(lesson)} title="Upravit">
                                      <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                    <LessonPreviewDialog title={lesson.title} heroImageUrl={null} blocks={lesson.blocks} />
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 gap-1.5"
                                      onClick={() => navigate(`/ucitel/ulohy?lessonId=${lesson.id}&lessonTitle=${encodeURIComponent(lesson.title)}`)}
                                      title="Vytvořit pracovní list"
                                    >
                                      <FileText className="w-3.5 h-3.5" />
                                      Pracovní list
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 gap-1.5"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        console.log("[Prezentace] clicked", lesson.title, "blocks:", lesson.blocks?.length);
                                        const slides = blocksToSlides(lesson.blocks || [], lesson.title);
                                        console.log("[Prezentace] slides generated:", slides.length);
                                        setPendingSlides(slides);
                                        setPresentationLesson(lesson);
                                        setEditingSlideIndex(0);
                                      }}
                                      title="Spustit jako prezentaci"
                                    >
                                      <Play className="w-3.5 h-3.5" />
                                      Prezentace
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDeletingLesson(lesson)} title="Smazat">
                                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Quick add lesson to this topic */}
                          <div className="border-t border-border px-3 py-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                setNewLessonTitle("");
                                setNewLessonTopicId(topic.id);
                                setCreateLessonOpen(true);
                              }}
                            >
                              <Plus className="w-3 h-3" /> Přidat lekci
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Enrolled students */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="font-heading text-lg font-semibold flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-primary" /> Zapsaní studenti ({enrollments.length})
            </h2>
            {enrollments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Zatím žádní studenti. Sdílejte kód učebnice.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {enrollments.map((e) => (
                  <div key={e.id} className="flex items-center justify-between text-sm border-b border-border pb-2">
                    <span>{e.profiles?.first_name} {e.profiles?.last_name}</span>
                    <span className="text-muted-foreground text-xs">{e.profiles?.email}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
        <SiteFooter />

        {/* === Lesson Editor Sheet === */}
        <Sheet open={editorOpen} onOpenChange={(open) => {
          if (!open) { setEditorOpen(false); setEditingLesson(null); setLessonPlacements([]); }
        }}>
          <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-4xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Upravit lekci</SheetTitle>
            </SheetHeader>
            {editingLesson && (
              <div className="space-y-4 mt-4">
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

                {editingLesson.source === "teacher_textbook_lessons" && (
                  <LessonPlacementEditor
                    lessonId={editingLesson.id}
                    placements={lessonPlacements}
                    onChange={setLessonPlacements}
                  />
                )}

                <div>
                  <Label className="mb-2 block">Obsah lekce</Label>
                  <BlockEditor
                    blocks={editingLesson.blocks}
                    onChange={(blocks) => setEditingLesson({ ...editingLesson, blocks })}
                  />
                </div>

                <div className="flex gap-2 pt-2 border-t border-border sticky bottom-0 bg-background pb-4">
                  <Button size="sm" onClick={saveLessonEdit} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                    Uložit změny
                  </Button>
                  <LessonPreviewDialog title={editingLesson.title} heroImageUrl={null} blocks={editingLesson.blocks} />
                  <Button size="sm" variant="ghost" onClick={() => { setEditorOpen(false); setEditingLesson(null); }}>
                    <X className="w-4 h-4 mr-1" /> Zavřít
                  </Button>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>

        {/* === Delete Confirmation === */}
        <AlertDialog open={!!deletingLesson} onOpenChange={(open) => { if (!open) setDeletingLesson(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Smazat lekci</AlertDialogTitle>
              <AlertDialogDescription>
                Opravdu chcete smazat lekci „{deletingLesson?.title}"? Tuto akci nelze vrátit zpět.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Zrušit</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteLesson} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Smazat
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* === Create Topic Dialog === */}
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

        {/* === Rename Topic Dialog === */}
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

        {/* === Create Lesson Dialog === */}
        <Dialog open={createLessonOpen} onOpenChange={setCreateLessonOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Nová lekce</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label>Název lekce</Label>
                <Input value={newLessonTitle} onChange={(e) => setNewLessonTitle(e.target.value)} className="mt-1" placeholder="např. Úvod do hygieny" />
              </div>
              <div>
                <Label>Téma</Label>
                <Select value={newLessonTopicId} onValueChange={setNewLessonTopicId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Vyberte téma" /></SelectTrigger>
                  <SelectContent>
                    {allTopics.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.gradeLabel} → {t.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreateLesson} disabled={saving || !newLessonTitle.trim() || !newLessonTopicId} className="w-full">
                {saving ? "Vytvářím..." : "Vytvořit lekci"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // === LIST VIEW ===
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl" style={{ paddingTop: "calc(70px + 3rem)" }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading text-3xl font-bold">Moje učebnice</h1>
            <p className="text-muted-foreground mt-1">Učebnice se automaticky vytvářejí při přidání předmětu.</p>
          </div>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Načítání...</p>
        ) : textbooks.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="font-heading text-xl font-semibold mb-2">Zatím nemáte žádné učebnice</h2>
            <p className="text-muted-foreground mb-4">Učebnice se vytvoří automaticky, když přidáte nový předmět v administraci.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {textbooks.map((tb) => {
              const matchedSubject = subjects?.find(s => s.slug === tb.subject);
              return (
                <div key={tb.id} className="bg-card border border-border rounded-xl p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {matchedSubject && (
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: matchedSubject.color }} />
                        )}
                        <h3 className="font-heading font-semibold text-lg truncate">{tb.title}</h3>
                      </div>
                      {matchedSubject && (
                        <div className="flex gap-1 mt-1">
                          {matchedSubject.grades.map(g => (
                            <Badge key={g.id} variant="secondary" className="text-[10px] px-1.5 py-0">{g.label}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {tb.description && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{tb.description}</p>}
                  <div className="flex items-center justify-between mt-auto">
                    <div className="flex items-center gap-1 bg-primary/10 rounded-md px-2 py-1">
                      <span className="text-xs text-muted-foreground">Kód:</span>
                      <span className="font-mono text-sm font-bold text-primary">{tb.access_code}</span>
                      <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => copyCode(tb.access_code)}>
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => openDetail(tb)} className="gap-1">
                      <Eye className="w-4 h-4" /> Detail
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <SiteFooter />

      <Dialog open={!!presentationLesson} onOpenChange={(open) => { if (!open) { setPresentationLesson(null); setPendingSlides([]); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upravit prezentaci{presentationLesson ? ` – ${presentationLesson.title}` : ""}</DialogTitle>
          </DialogHeader>

          <div className="flex gap-1 flex-wrap mb-4">
            {pendingSlides.map((_, i) => (
              <button
                key={i}
                onClick={() => setEditingSlideIndex(i)}
                className={`w-8 h-8 rounded text-xs font-medium ${i === editingSlideIndex ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              >
                {i + 1}
              </button>
            ))}
          </div>

          {pendingSlides[editingSlideIndex] && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Nadpis (projektor)</Label>
                <Input
                  value={pendingSlides[editingSlideIndex].projector?.headline || ""}
                  onChange={(e) => {
                    const updated = [...pendingSlides];
                    updated[editingSlideIndex] = {
                      ...updated[editingSlideIndex],
                      projector: { ...updated[editingSlideIndex].projector, headline: e.target.value },
                    };
                    setPendingSlides(updated);
                  }}
                />
              </div>
              <div>
                <Label className="text-xs">Text (projektor)</Label>
                <Textarea
                  rows={4}
                  value={pendingSlides[editingSlideIndex].projector?.body || ""}
                  onChange={(e) => {
                    const updated = [...pendingSlides];
                    updated[editingSlideIndex] = {
                      ...updated[editingSlideIndex],
                      projector: { ...updated[editingSlideIndex].projector, body: e.target.value },
                    };
                    setPendingSlides(updated);
                  }}
                />
              </div>
              <div>
                <Label className="text-xs">Instrukce pro žáka</Label>
                <Input
                  value={pendingSlides[editingSlideIndex].device?.instructions || ""}
                  onChange={(e) => {
                    const updated = [...pendingSlides];
                    updated[editingSlideIndex] = {
                      ...updated[editingSlideIndex],
                      device: { ...updated[editingSlideIndex].device, instructions: e.target.value },
                    };
                    setPendingSlides(updated);
                  }}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setPresentationLesson(null)}>Zrušit</Button>
            <Button
              onClick={async () => {
                const lesson = presentationLesson;
                const slides = pendingSlides;
                setPresentationLesson(null);
                if (lesson) await launchLiveSession(lesson, slides);
              }}
              className="gap-2"
            >
              <Monitor className="w-4 h-4" />
              Spustit prezentaci
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeacherTextbooks;
