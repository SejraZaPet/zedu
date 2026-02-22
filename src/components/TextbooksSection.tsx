import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";

const subjects = [
  { name: "Technologie", description: "Technologické postupy v gastronomii", lessons: 12 },
  { name: "Potraviny", description: "Suroviny, kvalita a skladování", lessons: 10 },
  { name: "Nauka o výživě", description: "Principy zdravé výživy a dietologie", lessons: 8 },
  { name: "Světová gastronomie", description: "Kuchyně světa a jejich tradice", lessons: 15 },
];

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
          {subjects.map((subject) => (
            <div
              key={subject.name}
              className="group rounded-lg border border-border bg-card p-6 md:p-8 flex flex-col justify-between transition-all duration-300 hover:border-primary/30 hover:bg-surface-hover"
            >
              <div>
                <h3 className="font-heading text-xl md:text-2xl font-semibold mb-2 text-card-foreground">
                  {subject.name}
                </h3>
                <p className="text-muted-foreground text-sm mb-4">{subject.description}</p>
                <span className="text-xs text-primary font-medium">{subject.lessons} lekcí</span>
              </div>
              <div className="mt-6">
                <Button variant="outline-gold" size="sm">
                  Otevřít
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TextbooksSection;