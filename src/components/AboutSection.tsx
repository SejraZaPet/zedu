import { User } from "lucide-react";

const AboutSection = () => {
  return (
    <section id="o-projektu" className="section-padding">
      <div className="container mx-auto max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10 md:gap-16 items-center">
          {/* Photo placeholder */}
          <div className="md:col-span-2 flex justify-center">
            <div className="w-48 h-48 md:w-56 md:h-56 rounded-2xl bg-card border border-border flex items-center justify-center overflow-hidden card-shadow">
              <User className="w-20 h-20 text-muted-foreground" />
            </div>
          </div>

          {/* Bio */}
          <div className="md:col-span-3">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm font-medium uppercase tracking-widest text-primary">O projektu</span>
            </div>
            <h2 className="font-heading text-2xl md:text-[32px] font-bold mb-6 text-foreground">Paní Sejrová</h2>
            <div className="space-y-4 text-muted-foreground leading-relaxed">
              <p>
                Ne, není to tak, že bych byla velkým milovníkem sýrů. První dny mé pedagogické stáže zahrnovaly také mé
                první opravování testů, při kterém jsem dala svoji první pětku a slovo SEJRA bylo jak pěst na oko. V tu
                chvíli jsem si řekla, že takhle učit nechci. Jsem #kavarenskypovalec a #ucitelvycviku s nakažlivým
                entusiasmem pro gastronomii. Vítejte v mém světě.
              </p>
              <p className="italic text-foreground/70">"Buď gastronomii miluješ nebo ne, není nic mezi tím."</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
