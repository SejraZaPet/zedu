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

interface LessonData {
  id: string;
  title: string;
  blocks: any[];
  sort_order: number;
  status: string;
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
      setTextbookTitle((tb as any).title);
      setTextbookDescription((tb as any).description || "");

      // Fetch all lessons for this textbook
      const { data: allLessons } = await supabase
        .from("teacher_textbook_lessons")
        .select("*")
        .eq("textbook_id", textbookId)
        .eq("status", "published")
        .order("sort_order", { ascending: true });
      const lessons = (allLessons || []) as LessonData[];
      console.log("DEBUG textbookId:", textbookId);
      console.log("DEBUG allLessons:", allLessons);
      console.log("DEBUG lessons count:", lessons.length);
      const lessonMap = new Map(lessons.map(l => [l.id, l]));

      // Fetch placements for these lessons
      const lessonIds = lessons.map(l => l.id);
      let placements: any[] = [];
      if (lessonIds.length > 0) {
        const { data: pl } = await supabase
          .from("lesson_placements")
          .select("lesson_id, subject_slug, grade_number, topic_id")
          .in("lesson_id", lessonIds);
        placements = pl || [];
      }
      console.log("DEBUG placements:", placements);

      // Fetch topics referenced by placements
      const topicIds = [...new Set(placements.filter(p => p.topic_id).map(p => p.topic_id))];
      let topicsMap = new Map<string, { id: string; title: string; sort_order: number; grade: number; subject: string }>();
      if (topicIds.length > 0) {
        const { data: topics } = await supabase
          .from("textbook_topics")
          .select("id, title, sort_order, grade, subject")
          .in("id", topicIds);
        (topics || []).forEach((t: any) => topicsMap.set(t.id, t));
      }

      // Build grade → topic → lessons structure from placements
      const gradeMap = new Map<number, Map<string, Set<string>>>();

      for (const p of placements) {
        if (!lessonMap.has(p.lesson_id)) continue;
        const grade = p.grade_number;
        if (!gradeMap.has(grade)) gradeMap.set(grade, new Map());
        const topicKey = p.topic_id || "__no_topic__";
        const gm = gradeMap.get(grade)!;
        if (!gm.has(topicKey)) gm.set(topicKey, new Set());
        gm.get(topicKey)!.add(p.lesson_id);
      }

      // Also include lessons without placements in a fallback group
      const placedLessonIds = new Set(placements.map(p => p.lesson_id));
      const unplacedLessons = lessons.filter(l => !placedLessonIds.has(l.id));

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
          const lessonIdsInTopic = [...topicMap.get(topicKey)!];
          const topicLessons = lessonIdsInTopic
            .map(id => lessonMap.get(id)!)
            .filter(Boolean)
            .sort((a, b) => a.sort_order - b.sort_order);

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

      // Fetch completions
      const { data: { user } } = await supabase.auth.getUser();
      if (user && lessonIds.length > 0) {
        const { data: completions } = await supabase
          .from("teacher_lesson_completions" as any)
          .select("lesson_id")
          .eq("user_id", user.id)
          .in("lesson_id", lessonIds);
        setCompletedLessonIds(new Set((completions || []).map((c: any) => c.lesson_id)));
      }

      setLoading(false);
    };
    fetchData();
  }, [textbookId]);

  const handleMarkComplete = async (lessonId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("teacher_lesson_completions" as any)
      .insert({ lesson_id: lessonId, user_id: user.id });
    if (!error) {
      setCompletedLessonIds(prev => new Set([...prev, lessonId]));
    }
  };

  // Lesson detail view
  if (selectedLesson) {
    const isLessonCompleted = completedLessonIds.has(selectedLesson.id);
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SiteHeader />
        <main className="flex-1 container mx-auto px-4 py-12 max-w-3xl" style={{ paddingTop: "calc(70px + 3rem)" }}>
          <Button variant="ghost" size="sm" onClick={() => setSelectedLesson(null)} className="mb-4 gap-2">
            <ArrowLeft className="w-4 h-4" /> Zpět na učebnici
          </Button>
          <h1 className="font-heading text-2xl font-bold mb-6">{selectedLesson.title}</h1>
          <div className="space-y-6">
            {(selectedLesson.blocks || []).map((block: any, idx: number) => (
              <LessonBlockRenderer key={idx} block={block} blockIndex={idx} />
            ))}
          </div>
          {(!selectedLesson.blocks || selectedLesson.blocks.length === 0) && (
            <p className="text-muted-foreground text-center py-8">Tato lekce zatím nemá žádný obsah.</p>
          )}
          <div className="mt-8 pt-6 border-t flex justify-center">
            {isLessonCompleted ? (
              <div className="flex items-center gap-2 text-green-600 font-medium">
                <CheckCircle2 className="w-5 h-5" />
                Lekce dokončena
              </div>
            ) : (
              <Button onClick={() => handleMarkComplete(selectedLesson.id)} className="gap-2">
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
                                    onClick={() => setSelectedLesson(lesson)}
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
