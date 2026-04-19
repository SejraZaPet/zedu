import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import LessonBlockRenderer from "@/components/LessonBlockRenderer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ArrowLeft, BookOpen, GraduationCap, FolderOpen, CheckCircle2, Circle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface LessonData {
  id: string;
  title: string;
  blocks: any[];
  sort_order: number;
  status: string;
  require_activities?: boolean;
}

interface TopicWithLessons {
  id: string;
  title: string;
  sort_order: number;
  lessons: LessonData[];
}

interface GradeGroup {
  grade_number: number;
  label: string;
  topics: TopicWithLessons[];
}

const StudentTextbookDetail = () => {
  const { textbookId } = useParams<{ textbookId: string }>();
  const navigate = useNavigate();
  const [textbookTitle, setTextbookTitle] = useState("");
  const [textbookDescription, setTextbookDescription] = useState("");
  const [grades, setGrades] = useState<GradeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLesson, setSelectedLesson] = useState<LessonData | null>(null);
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(new Set());
  const [completedActivityIndices, setCompletedActivityIndices] = useState<Set<number>>(new Set());

  useEffect(() => {
    const fetchData = async () => {
      if (!textbookId) return;

      // Fetch textbook info
      const { data: tb } = await supabase
        .from("teacher_textbooks")
        .select("title, description, subject")
        .eq("id", textbookId)
        .single();
      if (!tb) { setLoading(false); return; }
      const tbAny = tb as any;
      setTextbookTitle(tbAny.title);
      setTextbookDescription(tbAny.description || "");

      // 1) Lekce z teacher_textbook_lessons (učitelský systém)
      const { data: allLessons } = await supabase
        .from("teacher_textbook_lessons")
        .select("*")
        .eq("textbook_id", textbookId)
        .eq("status", "published")
        .order("sort_order", { ascending: true });
      const teacherLessons = ((allLessons || []) as any[]).map((l) => ({
        id: l.id,
        title: l.title,
        blocks: l.blocks || [],
        sort_order: l.sort_order || 0,
        status: l.status,
        require_activities: l.require_activities ?? false,
      })) as LessonData[];
      const lessonMap = new Map(teacherLessons.map(l => [l.id, l]));

      // Placements pro učitelské lekce
      const teacherLessonIds = teacherLessons.map(l => l.id);
      let placements: any[] = [];
      if (teacherLessonIds.length > 0) {
        const { data: pl } = await supabase
          .from("lesson_placements")
          .select("lesson_id, subject_slug, grade_number, topic_id")
          .in("lesson_id", teacherLessonIds);
        placements = pl || [];
      }

      // 2) Lekce z globálního systému (textbook_lessons → topics → subject = slug učebnice)
      // Slug odvozujeme primárně z tb.subject; jako fallback ze slugify(title)
      const slugFromTitle = (tbAny.title || "")
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      const subjectSlug = (tbAny.subject && tbAny.subject.trim()) || slugFromTitle;

      const { data: globalTopics } = await supabase
        .from("textbook_topics")
        .select("id, title, sort_order, grade, subject")
        .eq("subject", subjectSlug);
      const globalTopicIds = (globalTopics || []).map((t: any) => t.id);

      let globalLessons: any[] = [];
      if (globalTopicIds.length > 0) {
        const { data: gl } = await supabase
          .from("textbook_lessons")
          .select("id, title, blocks, sort_order, status, topic_id, require_activities")
          .in("topic_id", globalTopicIds)
          .eq("status", "published")
          .order("sort_order", { ascending: true });
        globalLessons = gl || [];
      }

      // Topics pro placements + globální topics — společná mapa
      const topicsMap = new Map<string, { id: string; title: string; sort_order: number; grade: number; subject: string }>();
      (globalTopics || []).forEach((t: any) => topicsMap.set(t.id, t));
      const placementTopicIds = [...new Set(placements.filter(p => p.topic_id && !topicsMap.has(p.topic_id)).map(p => p.topic_id))];
      if (placementTopicIds.length > 0) {
        const { data: extra } = await supabase
          .from("textbook_topics")
          .select("id, title, sort_order, grade, subject")
          .in("id", placementTopicIds);
        (extra || []).forEach((t: any) => topicsMap.set(t.id, t));
      }

      // Sjednocená struktura: grade → topic → lessons
      const gradeMap = new Map<number, Map<string, LessonData[]>>();

      // a) Učitelské lekce přes placements
      for (const p of placements) {
        const lesson = lessonMap.get(p.lesson_id);
        if (!lesson) continue;
        const grade = p.grade_number;
        if (!gradeMap.has(grade)) gradeMap.set(grade, new Map());
        const topicKey = p.topic_id || "__no_topic__";
        const gm = gradeMap.get(grade)!;
        if (!gm.has(topicKey)) gm.set(topicKey, []);
        gm.get(topicKey)!.push(lesson);
      }

      // b) Globální lekce přes topic_id
      for (const gl of globalLessons) {
        const topic = topicsMap.get(gl.topic_id);
        if (!topic) continue;
        const grade = topic.grade;
        if (!gradeMap.has(grade)) gradeMap.set(grade, new Map());
        const gm = gradeMap.get(grade)!;
        if (!gm.has(gl.topic_id)) gm.set(gl.topic_id, []);
        gm.get(gl.topic_id)!.push({
          id: gl.id,
          title: gl.title,
          blocks: gl.blocks || [],
          sort_order: gl.sort_order || 0,
          status: gl.status,
          require_activities: gl.require_activities ?? false,
        });
      }

      const gradeGroups: GradeGroup[] = [];
      const sortedGrades = [...gradeMap.keys()].sort((a, b) => a - b);

      for (const gradeNum of sortedGrades) {
        const topicMap = gradeMap.get(gradeNum)!;
        const topics: TopicWithLessons[] = [];
        const sortedTopicKeys = [...topicMap.keys()].sort((a, b) => {
          if (a === "__no_topic__") return 1;
          if (b === "__no_topic__") return -1;
          const ta = topicsMap.get(a);
          const tb2 = topicsMap.get(b);
          return (ta?.sort_order || 0) - (tb2?.sort_order || 0);
        });
        for (const topicKey of sortedTopicKeys) {
          const topicLessons = [...topicMap.get(topicKey)!].sort((a, b) => a.sort_order - b.sort_order);
          const topicInfo = topicKey !== "__no_topic__" ? topicsMap.get(topicKey) : null;
          topics.push({
            id: topicKey,
            title: topicInfo?.title || "Ostatní lekce",
            sort_order: topicInfo?.sort_order || 999,
            lessons: topicLessons,
          });
        }
        gradeGroups.push({
          grade_number: gradeNum,
          label: `${gradeNum}. ročník`,
          topics,
        });
      }

      // Učitelské lekce bez placement → fallback skupina
      const placedLessonIds = new Set(placements.map(p => p.lesson_id));
      const unplacedLessons = teacherLessons.filter(l => !placedLessonIds.has(l.id));
      if (unplacedLessons.length > 0) {
        gradeGroups.push({
          grade_number: 0,
          label: "Obsah učebnice",
          topics: [{
            id: "__unplaced__",
            title: "Lekce",
            sort_order: 0,
            lessons: unplacedLessons,
          }],
        });
      }

      setGrades(gradeGroups);

      // Completions (učitelské + studentské)
      const allLessonIds = [
        ...teacherLessonIds,
        ...globalLessons.map((l: any) => l.id),
      ];
      const { data: { user } } = await supabase.auth.getUser();
      if (user && allLessonIds.length > 0) {
        const { data: completions } = await supabase
          .from("student_lesson_completions")
          .select("lesson_id")
          .eq("user_id", user.id)
          .in("lesson_id", allLessonIds);
        const ids = new Set<string>((completions || []).map((c) => c.lesson_id));
        setCompletedLessonIds(ids);
      }

      setLoading(false);
    };
    fetchData();
  }, [textbookId]);

  const handleMarkComplete = async (lessonId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("student_lesson_completions")
      .insert({ lesson_id: lessonId, user_id: user.id });
    if (error) console.error("Mark complete error:", error);
    if (!error) {
      setCompletedLessonIds(prev => new Set([...prev, lessonId]));
      toast({ title: "Lekce dokončena! ✓", description: "Pokrok byl uložen." });
    }
  };

  // Lesson detail view
  if (selectedLesson) {
    const isLessonCompleted = completedLessonIds.has(selectedLesson.id);
    const requireActivities = !!selectedLesson.require_activities;
    const activityBlockCount = (selectedLesson.blocks || []).filter((b: any) => b?.type === "activity").length;
    const hasActivities = activityBlockCount > 0;
    const requiredActivityIndices = (selectedLesson.blocks || [])
      .map((b: any, idx: number) => ({ b, idx }))
      .filter(({ b }) => b?.type === "activity" && b?.props?.required === true)
      .map(({ idx }) => idx);
    const completedRequiredCount = requiredActivityIndices.filter((i) => completedActivityIndices.has(i)).length;
    const remainingRequired = requiredActivityIndices.length - completedRequiredCount;
    const allRequiredDone = remainingRequired <= 0;
    const canComplete = requiredActivityIndices.length === 0 || allRequiredDone;

    const openLesson = (l: LessonData) => {
      setCompletedActivityIndices(new Set());
      setSelectedLesson(l);
    };
    const closeLesson = () => {
      setCompletedActivityIndices(new Set());
      setSelectedLesson(null);
    };

    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SiteHeader />
        <main className="flex-1 container mx-auto px-4 py-12 max-w-3xl" style={{ paddingTop: "calc(70px + 3rem)" }}>
          <Button variant="ghost" size="sm" onClick={closeLesson} className="mb-4 gap-2">
            <ArrowLeft className="w-4 h-4" /> Zpět na učebnici
          </Button>
          <h1 className="font-heading text-2xl font-bold mb-6">{selectedLesson.title}</h1>
          <div className="space-y-6">
            {(selectedLesson.blocks || []).map((block: any, idx: number) => (
              <LessonBlockRenderer
                key={idx}
                block={block}
                blockIndex={idx}
                onActivityComplete={(activityIndex) => {
                  setCompletedActivityIndices(prev => new Set([...prev, activityIndex]));
                }}
              />
            ))}
          </div>
          {(!selectedLesson.blocks || selectedLesson.blocks.length === 0) && (
            <p className="text-muted-foreground text-center py-8">Tato lekce zatím nemá žádný obsah.</p>
          )}
          <div className="mt-8 pt-6 border-t flex flex-col items-center gap-2">
            {isLessonCompleted ? (
              <div className="flex items-center gap-2 text-green-600 font-medium">
                <CheckCircle2 className="w-5 h-5" />
                Lekce dokončena
              </div>
            ) : (
              <Button
                onClick={() => {
                  if (!canComplete) {
                    const remaining = requiredActivityIndices.filter(i => !completedActivityIndices.has(i)).length;
                    toast({
                      title: "Nejdříve dokonči povinné aktivity",
                      description: `Zbývá ti ${remaining} povinná ${remaining === 1 ? "aktivita" : remaining < 5 ? "aktivity" : "aktivit"}. Jsou označeny fialovým rámečkem v lekci.`,
                      variant: "destructive",
                    });
                    return;
                  }
                  handleMarkComplete(selectedLesson.id);
                }}
                className="gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Označit jako dokončené
              </Button>
            )}
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  // Calculate total progress
  const totalLessons = grades.reduce((sum, g) => sum + g.topics.reduce((s, t) => s + t.lessons.length, 0), 0);
  const completedCount = grades.reduce((sum, g) =>
    sum + g.topics.reduce((s, t) => s + t.lessons.filter(l => completedLessonIds.has(l.id)).length, 0), 0);
  const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl" style={{ paddingTop: "calc(70px + 3rem)" }}>
        <Button variant="ghost" size="sm" onClick={() => navigate("/student/ucebnice")} className="mb-4 gap-2">
          <ArrowLeft className="w-4 h-4" /> Zpět na učebnice
        </Button>

        <div className="mb-8">
          <h1 className="font-heading text-2xl font-bold mb-2">{textbookTitle}</h1>
          {textbookDescription && (
            <p className="text-muted-foreground mb-4">{textbookDescription}</p>
          )}
          {totalLessons > 0 && (
            <div className="flex items-center gap-3">
              <Progress value={progressPercent} className="flex-1 h-2" />
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {completedCount}/{totalLessons} lekcí ({progressPercent} %)
              </span>
            </div>
          )}
        </div>

        {loading ? (
          <p className="text-muted-foreground">Načítání...</p>
        ) : grades.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Tato učebnice zatím nemá žádný obsah.</p>
          </div>
        ) : (
          <Accordion type="multiple" defaultValue={grades.map(g => `grade-${g.grade_number}`)} className="space-y-4">
            {grades.map((grade) => (
              <AccordionItem key={grade.grade_number} value={`grade-${grade.grade_number}`} className="border rounded-lg bg-card px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <GraduationCap className="w-5 h-5 text-primary" />
                    </div>
                    <span className="font-semibold text-lg">{grade.label}</span>
                    <Badge variant="secondary" className="text-xs">
                      {grade.topics.reduce((s, t) => s + t.lessons.length, 0)} lekcí
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <Accordion type="multiple" defaultValue={grade.topics.map(t => `topic-${t.id}`)} className="space-y-2 mt-2">
                    {grade.topics.map((topic) => (
                      <AccordionItem key={topic.id} value={`topic-${topic.id}`} className="border rounded-md bg-muted/30 px-3">
                        <AccordionTrigger className="hover:no-underline py-3">
                          <div className="flex items-center gap-2">
                            <FolderOpen className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{topic.title}</span>
                            <span className="text-xs text-muted-foreground">({topic.lessons.length})</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          {topic.lessons.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4 text-center">
                              Zatím zde nejsou žádné lekce.
                            </p>
                          ) : (
                            <div className="space-y-1.5 pb-2">
                              {topic.lessons.map((lesson) => {
                                const isCompleted = completedLessonIds.has(lesson.id);
                                return (
                                  <button
                                    key={lesson.id}
                                    onClick={() => { setCompletedActivityIndices(new Set()); setSelectedLesson(lesson); }}
                                    className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-accent/50 transition-colors text-left group"
                                  >
                                    {isCompleted ? (
                                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                                    ) : (
                                      <Circle className="w-5 h-5 text-muted-foreground/40 flex-shrink-0" />
                                    )}
                                    <span className={`flex-1 text-sm font-medium truncate ${isCompleted ? "text-muted-foreground" : ""}`}>
                                      {lesson.title}
                                    </span>
                                    <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                                      Otevřít →
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

export default StudentTextbookDetail;
