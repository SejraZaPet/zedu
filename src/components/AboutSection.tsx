import { User } from "lucide-react";

const AboutSection = () => {
  return (
    <section id="o-projektu" className="section-padding">
      <div className="container mx-auto max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10 md:gap-16 items-center">
          {/* Photo placeholder */}
          <div className="md:col-span-2 flex justify-center">
            <div className="w-48 h-48 md:w-56 md:h-56 rounded-full bg-card border-2 border-primary/20 flex items-center justify-center overflow-hidden">
              <User className="w-20 h-20 text-muted-foreground" />
            </div>
          </div>

          {/* Bio */}
          <div className="md:col-span-3">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm font-medium uppercase tracking-widest text-primary">O projektu</span>
            </div>
            <h2 className="font-heading text-3xl md:text-4xl font-semibold mb-6">
              Paní Sejrová
            </h2>
            <div className="space-y-4 text-muted-foreground leading-relaxed">
              <p>
                Učitelka s vášní pro gastronomii a moderní vzdělávání. Projekt „Sejra za pět"
                vznikl z touhy sdílet kvalitní materiály a inspiraci s kolegy i studenty.
              </p>
              <p>
                Věřím, že výuka gastronomie může být kreativní, moderní a zábavná.
                Mým cílem je vytvořit prostor, kde se pedagogové i studenti mohou
                vzájemně inspirovat a rozvíjet.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;