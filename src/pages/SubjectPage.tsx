import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SUBJECTS, getSubject, getGradesForSubject } from "@/lib/textbook-config";
import { ArrowLeft, Loader2, BookOpen } from "lucide-react";
import { useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

const SubjectPage = () => {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const subject = getSubject(subjectId ?? "");
  const grades = getGradesForSubject(subjectId ?? "");
  const hasMultipleGrades = grades.length > 1;

  const [selectedGrade, setSelectedGrade] = useState<number | null>(
    hasMultipleGrades ? null : grades[0] ?? null
  );

  const { data: topics, isLoading } = useQuery({
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
          {/* Back link */}
          <Link
            to="/#ucebnice"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Zpět na učebnice
          </Link>

          {/* Subject title */}
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="w-6 h-6 text-primary" />
            <span className="text-sm font-medium uppercase tracking-widest text-primary">
              Učebnice
            </span>
          </div>
          <h1 className="font-heading text-4xl md:text-5xl font-bold mb-8 text-foreground">
            {subject.label}
          </h1>

          {/* Grade selector (only for multi-grade subjects) */}
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

          {/* Topics list */}
          {selectedGrade === null ? (
            <p className="text-muted-foreground text-center py-12">
              Vyberte ročník pro zobrazení témat.
            </p>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Načítám témata…</span>
            </div>
          ) : topics && topics.length > 0 ? (
            <div className="flex flex-col items-center gap-3">
              {topics.map((topic) => (
                <button
                  key={topic.id}
                  onClick={() =>
                    navigate(`/ucebnice/${subjectId}/${topic.id}`)
                  }
                  className="w-full max-w-2xl px-6 py-4 rounded-full bg-card border border-border text-foreground font-body text-base uppercase tracking-wider font-medium transition-all duration-200 hover:border-primary/50 hover:bg-surface-hover hover:text-primary text-center"
                >
                  {topic.title}
                </button>
              ))}
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
