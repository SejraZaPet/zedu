import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Loader2, BookOpen } from "lucide-react";
import { slugify } from "@/lib/slugify";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

const TopicPage = () => {
  const { subjectId, grade, topicSlug } = useParams<{
    subjectId: string;
    grade: string;
    topicSlug: string;
  }>();

  const gradeNum = Number(grade);

  // Load topic by matching slug or ID
  const { data: topic, isLoading: topicLoading } = useQuery({
    queryKey: ["topic-by-slug", subjectId, grade, topicSlug],
    queryFn: async () => {
      // Try by ID first
      const { data: byId } = await supabase
        .from("textbook_topics")
        .select("*")
        .eq("id", topicSlug ?? "")
        .maybeSingle();
      if (byId) return byId;

      // Fallback: load all topics for subject+grade and match slug
      const { data: all } = await supabase
        .from("textbook_topics")
        .select("*")
        .eq("subject", subjectId ?? "")
        .eq("grade", gradeNum);
      return all?.find((t) => slugify(t.title) === topicSlug) ?? null;
    },
    enabled: !!subjectId && !!topicSlug,
  });

  // Load lessons for topic
  const { data: lessons, isLoading: lessonsLoading } = useQuery({
    queryKey: ["topic-lessons", topic?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("textbook_lessons")
        .select("*")
        .eq("topic_id", topic!.id)
        .eq("status", "published")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!topic?.id,
  });

  const isLoading = topicLoading || lessonsLoading;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="pt-24 md:pt-28 pb-16 md:pb-24">
        <div className="container mx-auto max-w-3xl px-4">
          <Link
            to={`/ucebnice/${subjectId}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Zpět na předmět
          </Link>

          {topicLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Načítám…</span>
            </div>
          ) : !topic ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground mb-4">Téma nebylo nalezeno.</p>
              <Link to={`/ucebnice/${subjectId}`} className="text-primary hover:underline">
                ← Zpět na předmět
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-2">
                <BookOpen className="w-6 h-6 text-primary" />
                <span className="text-sm font-medium uppercase tracking-widest text-primary">
                  {grade}. ročník
                </span>
              </div>
              <h1 className="font-heading text-4xl md:text-5xl font-bold mb-10 text-foreground">
                {topic.title}
              </h1>

              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="ml-3 text-muted-foreground">Načítám lekce…</span>
                </div>
              ) : lessons && lessons.length > 0 ? (
                <div className="flex flex-col items-center gap-3">
                  {lessons.map((lesson) => (
                    <Link
                      key={lesson.id}
                      to={`/ucebnice/${subjectId}/${grade}/${topicSlug}/${slugify(lesson.title) || lesson.id}`}
                      className="w-full max-w-2xl px-6 py-4 rounded-full bg-primary/10 border border-primary/40 text-foreground font-body text-base uppercase tracking-wider font-medium transition-all duration-200 hover:border-primary hover:bg-primary/15 hover:text-primary text-center"
                    >
                      {lesson.title}
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <p className="text-muted-foreground">Lekce zatím nejsou dostupné.</p>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default TopicPage;
