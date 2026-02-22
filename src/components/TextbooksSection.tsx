import { BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SUBJECTS } from "@/lib/textbook-config";
import { Skeleton } from "@/components/ui/skeleton";

const descriptions: Record<string, string> = {
  technologie: "Technologické postupy v gastronomii",
  potraviny: "Suroviny, kvalita a skladování",
  nauka_o_vyzive: "Principy zdravé výživy a dietologie",
  svetova_gastronomie: "Kuchyně světa a jejich tradice",
};

const TextbooksSection = () => {
  const { data: publishedMap, isLoading } = useQuery({
    queryKey: ["subject-published-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("textbook_lessons")
        .select("topic_id, status, textbook_topics!inner(subject)")
        .eq("status", "published");
      if (error) throw error;

      const map: Record<string, boolean> = {};
      for (const row of data ?? []) {
        const subject = (row as any).textbook_topics?.subject;
        if (subject) map[subject] = true;
      }
      return map;
    },
  });

  return (
    <section id="ucebnice" className="section-padding">
      <div className="container mx-auto max-w-6xl">
        <div className="flex items-center gap-3 mb-4">
          <BookOpen className="w-6 h-6 text-primary" />
          <span className="text-sm font-medium uppercase tracking-widest text-primary">Učebnice</span>
        </div>
        <h2 className="font-heading text-3xl md:text-4xl font-semibold mb-4">
          Virtuální učebnice
        </h2>
        <p className="text-muted-foreground max-w-2xl mb-12">
          Moderní vzdělávací materiály připravené pro výuku odborných gastronomických předmětů.
          Vyberte si předmět a začněte studovat.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {SUBJECTS.map((subject) => {
            const isPublished = publishedMap?.[subject.id] ?? false;

            return (
              <Link
                key={subject.id}
                to={`/ucebnice/${subject.id}`}
                className={`group rounded-lg p-6 md:p-8 flex flex-col justify-between transition-all duration-300 border ${
                  isPublished
                    ? "border-primary/40 bg-primary/10 hover:border-primary hover:bg-primary/15 hover:shadow-lg hover:shadow-primary/10"
                    : "border-border bg-card hover:border-border hover:bg-surface-hover"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className={`font-heading text-xl md:text-2xl font-semibold ${
                      isPublished ? "text-primary" : "text-card-foreground"
                    }`}>
                      {subject.label}
                    </h3>
                    {isLoading ? (
                      <Skeleton className="h-5 w-16 rounded-full" />
                    ) : isPublished ? (
                      <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                        Dostupné
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        Připravujeme
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground text-sm mb-4">
                    {descriptions[subject.id] ?? ""}
                  </p>
                  <span className="text-xs text-muted-foreground font-medium">
                    {subject.grades.length > 1
                      ? `Ročníky ${subject.grades.join(", ")}`
                      : `${subject.grades[0]}. ročník`}
                  </span>
                </div>
                <div className="mt-6">
                  <span className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm border font-medium transition-colors ${
                    isPublished
                      ? "border-primary text-primary group-hover:bg-primary group-hover:text-primary-foreground"
                      : "border-border text-muted-foreground group-hover:border-primary/40 group-hover:text-foreground"
                  }`}>
                    Otevřít
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default TextbooksSection;
