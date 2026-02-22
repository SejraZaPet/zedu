import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getSubject, getGradesForSubject } from "@/lib/textbook-config";
import { slugify } from "@/lib/slugify";
import { ArrowLeft, Loader2, BookOpen } from "lucide-react";
import { useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

const SubjectPage = () => {
  const { subjectId } = useParams<{ subjectId: string }>();
  const subject = getSubject(subjectId ?? "");
  const grades = getGradesForSubject(subjectId ?? "");
  const hasMultipleGrades = grades.length > 1;

  const [selectedGrade, setSelectedGrade] = useState<number | null>(
    hasMultipleGrades ? null : grades[0] ?? null
  );

  // Load topics
  const { data: topics, isLoading: topicsLoading } = useQuery({
    queryKey: ["textbook-topics", subjectId, selectedGrade],
    queryFn: async () => {
      if (!subjectId || selectedGrade === null) return [];
      const { data, error } = await supabase
        .from("textbook_topics")
        .select("*")
        .eq("subject", subjectId)
        .eq("grade", selectedGrade)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!subjectId && selectedGrade !== null,
  });

  // Load published lesson counts per topic
  const topicIds = topics?.map((t) => t.id) ?? [];
  const { data: publishedMap } = useQuery({
    queryKey: ["topic-published-map", topicIds],
    queryFn: async () => {
      if (topicIds.length === 0) return {};
      const { data } = await supabase
        .from("textbook_lessons")
        .select("topic_id, status")
        .in("topic_id", topicIds)
        .eq("status", "published");
      const map: Record<string, boolean> = {};
      for (const row of data ?? []) {
        map[row.topic_id] = true;
      }
      return map;
    },
    enabled: topicIds.length > 0,
  });

  if (!subject) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="pt-24 pb-16 px-4 text-center">
          <p className="text-muted-foreground">Předmět nenalezen.</p>
          <Link to="/#ucebnice" className="text-primary hover:underline mt-4 inline-block">
            ← Zpět na učebnice
          </Link>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="pt-24 md:pt-28 pb-16 md:pb-24">
        <div className="container mx-auto max-w-3xl px-4">
          <Link
            to="/#ucebnice"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Zpět na učebnice
          </Link>

          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="w-6 h-6 text-primary" />
            <span className="text-sm font-medium uppercase tracking-widest text-primary">
              Učebnice
            </span>
          </div>
          <h1 className="font-heading text-4xl md:text-5xl font-bold mb-8 text-foreground">
            {subject.label}
          </h1>

          {/* Grade selector */}
          {hasMultipleGrades && (
            <div className="mb-10">
              <p className="text-sm text-muted-foreground mb-4 uppercase tracking-wider">
                Vyberte ročník
              </p>
              <div className="flex flex-wrap gap-3">
                {grades.map((g) => (
                  <button
                    key={g}
                    onClick={() => setSelectedGrade(g)}
                    className={`px-6 py-3 rounded-full text-sm font-semibold uppercase tracking-wider transition-all duration-200 border ${
                      selectedGrade === g
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    {g}. ročník
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Topics */}
          {selectedGrade === null ? (
            <p className="text-muted-foreground text-center py-12">
              Vyberte ročník pro zobrazení témat.
            </p>
          ) : topicsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Načítám témata…</span>
            </div>
          ) : topics && topics.length > 0 ? (
            <div className="flex flex-col items-center gap-3">
              {topics.map((topic) => {
                const isPublished = publishedMap?.[topic.id] ?? false;
                const topicSlug = slugify(topic.title) || topic.id;

                return (
                  <Link
                    key={topic.id}
                    to={`/ucebnice/${subjectId}/${selectedGrade}/${topicSlug}`}
                    className={`w-full max-w-2xl px-6 py-4 rounded-full font-body text-base uppercase tracking-wider font-medium transition-all duration-200 text-center border ${
                      isPublished
                        ? "bg-primary/10 border-primary/40 text-primary hover:bg-primary/20 hover:border-primary"
                        : "bg-card border-border text-muted-foreground hover:border-border hover:bg-surface-hover hover:text-foreground"
                    }`}
                  >
                    <span className="flex items-center justify-center gap-3">
                      {topic.title}
                      {!isPublished && (
                        <span className="text-[10px] normal-case tracking-normal font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          v procesu
                        </span>
                      )}
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-muted-foreground mb-4">Zatím bez témat</p>
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-primary/40 text-primary text-sm font-medium hover:bg-primary/10 transition-colors"
              >
                Přidat v adminu
              </Link>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default SubjectPage;
