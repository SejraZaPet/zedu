import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubjects } from "@/hooks/useSubjects";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Search, X, Pencil, Plus, Eye } from "lucide-react";
import LessonEditorSheet from "@/components/LessonEditorSheet";
import LessonPreviewDialog from "./LessonPreviewDialog";
import { getGradeNumbers } from "@/hooks/useSubjects";
import { useToast } from "@/hooks/use-toast";
import type { Block } from "@/lib/textbook-config";

interface AssignmentInfo {
  topic_id: string;
  subject: string;
  grade: number;
  topic_title: string;
}

interface LessonRow {
  id: string;
  title: string;
  status: string;
  sort_order: number;
  topic_id: string;
  hero_image_url: string | null;
  blocks: Block[];
  assignments: AssignmentInfo[];
}

const LessonsManager = () => {
  const { data: subjects = [] } = useSubjects(false);
  const { toast } = useToast();
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [creatingLesson, setCreatingLesson] = useState(false);

  const [filterSubject, setFilterSubject] = useState<string>("all");
  const [filterGrade, setFilterGrade] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const currentSubject = subjects.find((s) => s.slug === filterSubject);
  const availableGrades = currentSubject ? getGradeNumbers(currentSubject) : [];

  useEffect(() => {
    setFilterGrade("all");
  }, [filterSubject]);

  const fetchLessons = useCallback(async () => {
    setLoading(true);

    let lessonQuery = supabase
      .from("textbook_lessons")
      .select("id, title, status, sort_order, topic_id, hero_image_url, blocks")
      .order("sort_order");

    if (filterStatus !== "all") {
      lessonQuery = lessonQuery.eq("status", filterStatus);
    }

    const { data: lessonData } = await lessonQuery;
    if (!lessonData || lessonData.length === 0) {
      setLessons([]);
      setLoading(false);
      return;
    }

    const lessonIds = lessonData.map((l: any) => l.id);
    const { data: assignmentData } = await supabase
      .from("lesson_topic_assignments")
      .select("lesson_id, topic_id, textbook_topics(id, title, subject, grade)")
      .in("lesson_id", lessonIds);

    const assignMap: Record<string, AssignmentInfo[]> = {};
    for (const row of (assignmentData ?? []) as any[]) {
      if (!assignMap[row.lesson_id]) assignMap[row.lesson_id] = [];
      assignMap[row.lesson_id].push({
        topic_id: row.topic_id,
        subject: row.textbook_topics?.subject ?? "",
        grade: row.textbook_topics?.grade ?? 0,
        topic_title: row.textbook_topics?.title ?? "",
      });
    }

    let results: LessonRow[] = lessonData.map((l: any) => ({
      ...l,
      blocks: (l.blocks as Block[]) ?? [],
      assignments: assignMap[l.id] ?? [],
    }));

    if (filterSubject !== "all") {
      results = results.filter((l) =>
        l.assignments.some((a) => a.subject === filterSubject)
      );
    }
    if (filterGrade !== "all") {
      results = results.filter((l) =>
        l.assignments.some((a) => a.grade === Number(filterGrade) && (filterSubject === "all" || a.subject === filterSubject))
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      results = results.filter((l) => l.title.toLowerCase().includes(q));
    }

    setLessons(results);
    setLoading(false);
  }, [filterSubject, filterGrade, filterStatus, searchQuery]);

  useEffect(() => { fetchLessons(); }, [fetchLessons]);

  const deleteLesson = async (id: string) => {
    if (!confirm("Opravdu smazat tuto lekci?")) return;
    await supabase.from("textbook_lessons").delete().eq("id", id);
    fetchLessons();
  };

  const getSubjectLabel = (slug: string) => subjects.find((s) => s.slug === slug)?.label ?? slug;

  const clearFilters = () => {
    setFilterSubject("all");
    setFilterGrade("all");
    setFilterStatus("all");
    setSearchQuery("");
  };

  const hasFilters = filterSubject !== "all" || filterGrade !== "all" || filterStatus !== "all" || searchQuery.trim() !== "";

  const handleCreateLesson = async () => {
    setCreatingLesson(true);
    // We need a topic_id (required FK). Get first available topic.
    const { data: firstTopic } = await supabase
      .from("textbook_topics")
      .select("id")
      .limit(1)
      .single();

    if (!firstTopic) {
      toast({ title: "Chyba", description: "Nejdříve vytvořte alespoň jedno téma v sekci Předměty.", variant: "destructive" });
      setCreatingLesson(false);
      return;
    }

    const { data, error } = await supabase.from("textbook_lessons").insert({
      title: "Nová lekce",
      topic_id: (firstTopic as any).id,
      sort_order: 0,
      blocks: [],
      status: "draft",
    }).select("id").single();

    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    } else if (data) {
      setEditingLessonId((data as any).id);
      fetchLessons();
    }
    setCreatingLesson(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-xl">Všechny lekce</h2>
        <div className="flex gap-2">
          {hasFilters && (
            <Button size="sm" variant="ghost" onClick={clearFilters}>
              <X className="w-4 h-4 mr-1" /> Zrušit filtry
            </Button>
          )}
          <Button size="sm" onClick={handleCreateLesson} disabled={creatingLesson}>
            <Plus className="w-4 h-4 mr-1" /> {creatingLesson ? "Vytvářím…" : "Přidat lekci"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div>
          <Label className="text-xs">Předmět</Label>
          <Select value={filterSubject} onValueChange={setFilterSubject}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny</SelectItem>
              {subjects.map((s) => (
                <SelectItem key={s.slug} value={s.slug}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Ročník</Label>
          <Select value={filterGrade} onValueChange={setFilterGrade} disabled={filterSubject === "all"}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny</SelectItem>
              {availableGrades.map((g) => (
                <SelectItem key={g} value={String(g)}>{g}. ročník</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Stav</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny</SelectItem>
              <SelectItem value="draft">Koncept</SelectItem>
              <SelectItem value="published">Publikováno</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Hledat</Label>
          <div className="relative mt-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Název lekce…"
              className="pl-8"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Načítání…</p>
      ) : lessons.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          {hasFilters ? "Žádné lekce pro zvolený filtr." : "Zatím žádné lekce."}
        </p>
      ) : (
        <div className="space-y-2">
          {lessons.map((lesson) => (
            <div key={lesson.id} className="flex items-center gap-3 border border-border rounded-lg p-3 bg-card">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{lesson.title || "Bez názvu"}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {lesson.assignments.map((a, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">
                      {getSubjectLabel(a.subject)}/{a.grade}/{a.topic_title}
                    </Badge>
                  ))}
                  {lesson.assignments.length === 0 && (
                    <span className="text-[10px] text-muted-foreground">Bez umístění</span>
                  )}
                </div>
              </div>
              <Badge variant={lesson.status === "published" ? "default" : "secondary"} className="text-xs shrink-0">
                {lesson.status === "published" ? "Publikováno" : "Koncept"}
              </Badge>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" onClick={() => setEditingLessonId(lesson.id)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => deleteLesson(lesson.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingLessonId && (
        <LessonEditorSheet
          lessonId={editingLessonId}
          open={!!editingLessonId}
          onOpenChange={(open) => { if (!open) setEditingLessonId(null); }}
          onSaved={() => {
            setEditingLessonId(null);
            fetchLessons();
          }}
        />
      )}
    </div>
  );
};

export default LessonsManager;
