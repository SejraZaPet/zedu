import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Loader2, Pencil, List } from "lucide-react";
import { slugify } from "@/lib/slugify";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import type { Block } from "@/lib/textbook-config";
import { LessonBlock } from "@/components/LessonBlockRenderer";
import { Button } from "@/components/ui/button";
import LessonEditorSheet from "@/components/LessonEditorSheet";

const LessonPage = () => {
  const { subjectId, grade, topicSlug, lessonSlug } = useParams<{
    subjectId: string;
    grade: string;
    topicSlug: string;
    lessonSlug: string;
  }>();

  const queryClient = useQueryClient();
  const [isAdmin, setIsAdmin] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);

  // Check admin status
  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .limit(1);
      if (roles && roles.length > 0 && roles[0].role === "admin") {
        setIsAdmin(true);
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
                  className="w-full rounded-lg mb-8 object-cover max-h-80"
                />
              )}
              <h1 className="font-heading text-4xl md:text-5xl font-bold mb-10 text-foreground">
                {lesson.title}
              </h1>

              <div className="space-y-6">
                {blocks.filter((b) => b.visible !== false).map((block) => (
                  <LessonBlock key={block.id} block={block} />
                ))}
              </div>

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
    </div>
  );
};

export default LessonPage;
