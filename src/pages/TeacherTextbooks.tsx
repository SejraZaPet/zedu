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
import PresentationEditorDialog from "@/components/admin/PresentationEditorDialog";
import TextbookGradeGroups from "@/components/admin/TextbookGradeGroups";
import TextbookList from "@/components/admin/TextbookList";
import LessonPlacementEditor, { savePlacements, type Placement } from "@/components/admin/LessonPlacementEditor";
import type { Block } from "@/lib/textbook-config";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  BookOpen, Users, ArrowLeft, Copy, Eye, FolderOpen, ChevronRight,
  Pencil, Trash2, Plus, Save, Loader2, X, FileText, Play,
} from "lucide-react";
import { blocksToSlides } from "@/lib/blocks-to-slides";
import { usePresentationLauncher } from "@/hooks/usePresentationLauncher";
import { emptyWorksheetSpec } from "@/lib/worksheet-defaults";
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

  // Presentation editor (extracted to hook)
  const {
    presentationLesson, setPresentationLesson,
    pendingSlides, setPendingSlides,
    editingSlideIndex, setEditingSlideIndex,
    existingSession, setExistingSession,
    pendingLaunchData, setPendingLaunchData,
    hasSavedPresentation,
    openEditor, launchLiveSession, launchNew,
  } = usePresentationLauncher();

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
              <TextbookGradeGroups
                gradeGroups={gradeGroups}
                subjects={subjects?.map(s => s) || []}
                selectedTextbook={selectedTextbook}
                onEditLesson={openLessonEditor}
                onDeleteLesson={(lesson) => setDeletingLesson(lesson)}
                onAddLesson={(topicId) => { setNewLessonTopicId(topicId); setCreateLessonOpen(true); }}
                onEditTopic={(topic) => setEditingTopic(topic)}
                onDeleteTopic={handleDeleteTopic}
                onOpenPresentation={openEditor}
                onOpenWorksheet={async (lesson) => {
                  const lessonType: "global" | "teacher" =
                    lesson.source === "textbook_lessons" ? "global" : "teacher";
                  const params = new URLSearchParams();
                  params.set("from_lesson", lesson.id);
                  params.set("from_lesson_type", lessonType);
                  params.set("return_to", `/ucitel/ucebnice/${selectedTextbook?.id ?? ""}`);
                  navigate(`/ucitel/pracovni-listy?${params.toString()}`);
                }}
                onPreviewLesson={() => {}}
              />
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

        <PresentationEditorDialog
          presentationLesson={presentationLesson}
          pendingSlides={pendingSlides}
          setPendingSlides={setPendingSlides}
          editingSlideIndex={editingSlideIndex}
          setEditingSlideIndex={setEditingSlideIndex}
          hasSavedPresentation={hasSavedPresentation}
          onClose={() => { setPresentationLesson(null); setPendingSlides([]); }}
          onLaunch={async (slides) => {
            const lesson = presentationLesson!;
            setPresentationLesson(null);
            setPendingSlides([]);
            await launchLiveSession(lesson, slides);
          }}
          onSave={async (slides) => {
            if (!presentationLesson) return;
            const table = presentationLesson.source === "teacher_textbook_lessons"
              ? "teacher_textbook_lessons"
              : "textbook_lessons";
            await supabase.from(table).update({ presentation_slides: slides } as any).eq("id", presentationLesson.id);
          }}
          existingSession={existingSession}
          onContinueExisting={() => {
            const id = existingSession!.id;
            setExistingSession(null);
            setPendingLaunchData(null);
            navigate(`/live/ucitel/${id}`);
          }}
          onLaunchNew={launchNew}
          onCloseExisting={() => { setExistingSession(null); setPendingLaunchData(null); }}
        />
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

        <TextbookList
          textbooks={textbooks}
          loading={loading}
          subjects={subjects?.map(s => s) || []}
          onOpen={openDetail}
          onCreate={() => {}}
        />
      </main>
      <SiteFooter />

      <PresentationEditorDialog
        presentationLesson={presentationLesson}
        pendingSlides={pendingSlides}
        setPendingSlides={setPendingSlides}
        editingSlideIndex={editingSlideIndex}
        setEditingSlideIndex={setEditingSlideIndex}
        hasSavedPresentation={hasSavedPresentation}
        onClose={() => { setPresentationLesson(null); setPendingSlides([]); }}
        onLaunch={async (slides) => {
          const lesson = presentationLesson!;
          setPresentationLesson(null);
          setPendingSlides([]);
          await launchLiveSession(lesson, slides);
        }}
        onSave={async (slides) => {
          if (!presentationLesson) return;
          const table = presentationLesson.source === "teacher_textbook_lessons"
            ? "teacher_textbook_lessons"
            : "textbook_lessons";
          await supabase.from(table).update({ presentation_slides: slides } as any).eq("id", presentationLesson.id);
        }}
        existingSession={existingSession}
        onContinueExisting={() => {
          const id = existingSession!.id;
          setExistingSession(null);
          setPendingLaunchData(null);
          navigate(`/live/ucitel/${id}`);
        }}
        onLaunchNew={launchNew}
        onCloseExisting={() => { setExistingSession(null); setPendingLaunchData(null); }}
      />
    </div>
  );
};

export default TeacherTextbooks;
