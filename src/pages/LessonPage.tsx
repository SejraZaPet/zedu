import { useMemo, useState, useEffect, useCallback } from "react";
import { HERO_IMAGE_CLASS } from "@/lib/image-block-layout";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Loader2, Pencil, List, NotebookPen, Download } from "lucide-react";

import { slugify } from "@/lib/slugify";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import type { Block } from "@/lib/textbook-config";
import { LessonBlock } from "@/components/LessonBlockRenderer";
import ReadAloudButton from "@/components/a11y/ReadAloudButton";
import { Button } from "@/components/ui/button";
import LessonEditorSheet from "@/components/LessonEditorSheet";
import BezlaiTutorChat from "@/components/BezlaiTutorChat";
import { useActivityTracking } from "@/hooks/useActivityTracking";
import LessonHighlightLayer from "@/components/lesson/LessonHighlightLayer";
import { downloadLessonOfflineHtml } from "@/lib/lesson-offline-export";
import { toast } from "sonner";
import { HIGHLIGHTABLE_BLOCK_TYPES } from "@/lib/highlightable-blocks";
import { useActivityDeepLink, ACTIVITY_HIGHLIGHT_CLASS } from "@/hooks/useActivityDeepLink";
import { filterReadingBlocks } from "@/lib/reading-blocks";
import { bestResultsByActivity, betterResult, computeLessonActivityProgress, lessonActivityTitles, toBestResult, type BestActivityResult } from "@/lib/lesson-activity-progress";
import { buildReadAloudText } from "@/lib/lesson-content-splitter";
import { LessonCompletionControl, LessonSuccessSummary } from "@/components/lesson/LessonSuccessSummary";


const LessonPage = () => {
  const { subjectId, grade, topicSlug, lessonSlug } = useParams<{
    subjectId: string;
    grade: string;
    topicSlug: string;
    lessonSlug: string;
  }>();
  const navigate = useNavigate();


  const queryClient = useQueryClient();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTeacherOrAdmin, setIsTeacherOrAdmin] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [offlineBusy, setOfflineBusy] = useState(false);

  // Check admin/teacher status
  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setIsAuthenticated(true);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .limit(1);
      if (roles && roles.length > 0) {
        const userRoles = roles.map((row: any) => row.role);
        if (userRoles.includes("admin")) setIsAdmin(true);
        if (userRoles.some((r) => r === "admin" || r === "teacher" || r === "lektor")) setIsTeacherOrAdmin(true);
      }
    };
    check();
  }, []);

  const { data: lesson, isLoading } = useQuery({
    queryKey: ["lesson-by-slug", topicSlug, lessonSlug],
    queryFn: async () => {
      // Try by ID first
      const { data: byId } = await supabase
        .from("textbook_lessons")
        .select("*")
        .eq("id", lessonSlug ?? "")
        .eq("status", "published")
        .maybeSingle();
      if (byId) return byId;

      // Find the topic
      const { data: allTopics } = await supabase
        .from("textbook_topics")
        .select("id, title, subject, grade")
        .eq("subject", subjectId ?? "")
        .eq("grade", Number(grade));

      const topic = allTopics?.find(
        (t) => slugify(t.title) === topicSlug || t.id === topicSlug
      );
      if (!topic) return null;

      // Get lesson IDs via junction table
      const { data: assignments } = await supabase
        .from("lesson_topic_assignments")
        .select("lesson_id")
        .eq("topic_id", topic.id);

      if (!assignments || assignments.length === 0) return null;

      const lessonIds = assignments.map((a: any) => a.lesson_id);
      const { data: lessons } = await supabase
        .from("textbook_lessons")
        .select("*")
        .in("id", lessonIds)
        .eq("status", "published");

      return lessons?.find((l) => slugify(l.title) === lessonSlug) ?? null;
    },
    enabled: !!lessonSlug,
  });

  const blocks: Block[] = (lesson?.blocks as unknown as Block[]) ?? [];
  const { trackActivity, trackLessonComplete } = useActivityTracking(lesson?.id);
  const [completedActivityIndices, setCompletedActivityIndices] = useState<Set<number>>(new Set());
  const [bestResults, setBestResults] = useState<Map<number, BestActivityResult>>(new Map());

  // Načti dříve dokončené aktivity, aby žák nemusel opakovat práci z minulé návštěvy
  useEffect(() => {
    const loadPrevious = async () => {
      if (!lesson?.id) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase
        .from("student_activity_results")
        .select("activity_index, score, max_score, completed_at")
        .eq("user_id", session.user.id)
        .eq("lesson_id", lesson.id);
      if (data && data.length > 0) {
        setCompletedActivityIndices((prev) => {
          const next = new Set(prev);
          data.forEach((row: any) => next.add(row.activity_index));
          return next;
        });
        setBestResults(bestResultsByActivity(data as any));
      }
    };
    loadPrevious();
  }, [lesson?.id]);

  // Track activity completion
  const handleActivityComplete = useCallback(
    (activityIndex: number, activityType: string, score: number, maxScore: number) => {
      setCompletedActivityIndices((prev) => new Set([...prev, activityIndex]));
      setBestResults((prev) => {
                    const next = new Map(prev);
                    next.set(activityIndex, betterResult(prev.get(activityIndex), toBestResult({ activity_index: activityIndex, score, max_score: maxScore, completed_at: new Date().toISOString() })));
                    return next;
                  });
      trackActivity(activityIndex, activityType, score, maxScore);
    },
    [trackActivity]
  );

  const visibleBlocks = filterReadingBlocks(blocks);
  const activityTitles = useMemo(() => lessonActivityTitles(visibleBlocks), [visibleBlocks]);
  const requiredActivityIndices = visibleBlocks
    .map((b, idx) => ({ b, idx }))
    .filter(({ b }) => b.type === "activity" && (b.props as any)?.required === true)
    .map(({ idx }) => idx);
  const completedRequiredCount = requiredActivityIndices.filter((i) => completedActivityIndices.has(i)).length;
  const allRequiredDone = completedRequiredCount >= requiredActivityIndices.length;
  const lessonActivityProgress = useMemo(() => {
    const activities = visibleBlocks
      .map((block, index) => ({ block, index }))
      .filter(({ block }) => block.type === "activity")
      .map(({ block, index }) => ({
        index,
        title: activityTitles.get(index) ?? "Aktivita",
        activityType: String((block.props as any)?.activityType ?? "activity"),
        required: (block.props as any)?.required === true,
      }));
    return computeLessonActivityProgress(activities, bestResults);
  }, [activityTitles, bestResults, visibleBlocks]);

  // Deep-link ?aktivita=<index> — odscrolluje a zvýrazní aktivitu (QR kód z pracovního listu)
  const highlightedActivityIndex = useActivityDeepLink(visibleBlocks.length > 0, lesson?.id ?? null);

  const handleSaved = () => {
    // Refresh lesson data without full reload
    queryClient.invalidateQueries({ queryKey: ["lesson-by-slug", topicSlug, lessonSlug] });
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="pt-24 md:pt-28 pb-16 md:pb-24">
        <div className="container mx-auto max-w-3xl px-4">
          <div className="flex items-center justify-between mb-8">
            <Link
              to={`/ucebnice/${subjectId}/${grade}/${topicSlug}`}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Zpět na téma
            </Link>

            {isAdmin && lesson && (
              <div className="flex items-center gap-2">
                <Link to="/admin">
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <List className="w-4 h-4" />
                    Seznam lekcí
                  </Button>
                </Link>
                <Button size="sm" variant="default" className="gap-1.5" onClick={() => setEditorOpen(true)}>
                  <Pencil className="w-4 h-4" />
                  Upravit lekci
                </Button>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Načítám lekci…</span>
            </div>
          ) : !lesson ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground mb-4">Lekce zatím není dostupná.</p>
              <Link to={`/ucebnice/${subjectId}/${grade}/${topicSlug}`} className="text-primary hover:underline">
                ← Zpět na téma
              </Link>
            </div>
          ) : (
            <article>
              {lesson.hero_image_url && (
                <img
                  src={lesson.hero_image_url}
                  alt={lesson.title}
                  className={`mb-8 ${HERO_IMAGE_CLASS}`}
                />
              )}
              <div className="flex items-start justify-between gap-3 mb-10">
                <h1 className="font-heading text-4xl md:text-5xl font-bold text-foreground">
                  {lesson.title}
                </h1>
                <div className="mt-3 flex flex-shrink-0 items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() =>
                      navigate(
                        `${isTeacherOrAdmin ? "/ucitel" : "/student"}/sesit?lekce=${lesson.id}&nazev=${encodeURIComponent(lesson.title)}`,
                      )
                    }
                  >
                    <NotebookPen className="h-4 w-4" /> Otevřít poznámky k této lekci
                  </Button>
                  <ReadAloudButton
                    text={buildReadAloudText(lesson.title, visibleBlocks)}
                    label="Přečíst"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={offlineBusy}
                    onClick={async () => {
                      setOfflineBusy(true);
                      try {
                        await downloadLessonOfflineHtml(lesson.title, blocks, lesson.hero_image_url);
                        toast.success("Lekce stažena – otevři soubor i bez internetu.");
                      } catch {
                        toast.error("Stažení se nepovedlo. Zkus to prosím znovu.");
                      } finally {
                        setOfflineBusy(false);
                      }
                    }}
                  >
                    {offlineBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Stáhnout pro offline čtení
                  </Button>
                </div>
              </div>

              {isAuthenticated && lessonActivityProgress.total > 0 && (
                <div className="mb-8">
                  <LessonSuccessSummary progress={lessonActivityProgress} />
                </div>
              )}


              <LessonHighlightLayer
                lessonId={lesson.id}
                lessonSource="textbook_lessons"
                contentKey={`${lesson.id}:${visibleBlocks.length}`}
              >
                <div className="space-y-6">
                  {visibleBlocks.map((block, index) => (
                    <div
                      key={block.id}
                      data-activity-index={index}
                      className={highlightedActivityIndex === index ? ACTIVITY_HIGHLIGHT_CLASS : undefined}
                      {...(HIGHLIGHTABLE_BLOCK_TYPES.has(block.type) ? { "data-highlight-block": block.id } : {})}
                    >
                      <LessonBlock block={block} blockIndex={index} onActivityComplete={handleActivityComplete} isTeacher={isTeacherOrAdmin} isCompleted={completedActivityIndices.has(index)} completedResult={bestResults.get(index) ?? null} activityTitle={activityTitles.get(index)} />
                    </div>
                  ))}
                </div>
              </LessonHighlightLayer>

              {isAuthenticated && blocks.length > 0 && (
                <div className="mt-10 space-y-6 border-t border-border pt-8">
                  {lessonActivityProgress.total > 0 && <LessonSuccessSummary progress={lessonActivityProgress} />}
                  <LessonCompletionControl
                    teacher={isTeacherOrAdmin}
                    allRequiredDone={allRequiredDone}
                    completedCount={completedRequiredCount}
                    requiredCount={requiredActivityIndices.length}
                    onComplete={() => {
                      trackLessonComplete();
                      window.history.back();
                    }}
                  />
                </div>
              )}

              {blocks.length === 0 && (
                <p className="text-muted-foreground">Obsah lekce se připravuje.</p>
              )}
            </article>
          )}
        </div>
      </main>
      <SiteFooter />

      {/* Editor Sheet - only rendered for admin */}
      {isAdmin && lesson && (
        <LessonEditorSheet
          lessonId={lesson.id}
          open={editorOpen}
          onOpenChange={setEditorOpen}
          onSaved={handleSaved}
        />
      )}

      {/* Bezlai tutor – jen pro žáky (ne pro učitele/adminy) */}
      {!isTeacherOrAdmin && lesson && (
        <BezlaiTutorChat
          question={`Lekce: ${lesson.title}\n\nPředmět: ${subjectId ?? ""}`}
          subject={subjectId}
          contextKey={lesson.id}
        />
      )}
    </div>
  );
};

export default LessonPage;
