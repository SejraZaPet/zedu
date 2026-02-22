import { BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { SUBJECTS } from "@/lib/textbook-config";

const descriptions: Record<string, string> = {
  technologie: "Technologické postupy v gastronomii",
  potraviny: "Suroviny, kvalita a skladování",
  nauka_o_vyzive: "Principy zdravé výživy a dietologie",
  svetova_gastronomie: "Kuchyně světa a jejich tradice",
};

const TextbooksSection = () => {
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
          {SUBJECTS.map((subject) => (
            <Link
              key={subject.id}
              to={`/ucebnice/${subject.id}`}
              className="group rounded-lg border border-border bg-card p-6 md:p-8 flex flex-col justify-between transition-all duration-300 hover:border-primary/30 hover:bg-surface-hover"
            >
              <div>
                <h3 className="font-heading text-xl md:text-2xl font-semibold mb-2 text-card-foreground">
                  {subject.label}
                </h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {descriptions[subject.id] ?? ""}
                </p>
                <span className="text-xs text-primary font-medium">
                  {subject.grades.length > 1
                    ? `Ročníky ${subject.grades.join(", ")}`
                    : `${subject.grades[0]}. ročník`}
                </span>
              </div>
              <div className="mt-6">
                <span className="inline-flex items-center px-3 py-1.5 rounded-md text-sm border border-primary/40 text-primary font-medium group-hover:bg-primary/10 group-hover:border-primary transition-colors">
                  Otevřít
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TextbooksSection;
