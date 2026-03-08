import { BookOpen, Sparkles, GraduationCap } from "lucide-react";
import heroLogo from "@/assets/zedu-hero-logo.png";
import heroBg from "@/assets/hero-students.png";

const features = [
  {
    icon: BookOpen,
    title: "Digitální učebnice",
    description: "Vytvářejte kapitoly, výukový obsah a strukturované materiály.",
  },
  {
    icon: Sparkles,
    title: "Interaktivní aktivity",
    description: "Přidávejte kvízy, procvičování a interaktivní prvky.",
  },
  {
    icon: GraduationCap,
    title: "Pro žáky",
    description: "Procvičujte učivo, řešte interaktivní úkoly a sledujte svůj pokrok.",
  },
];

const Hero = () => {
  return (
    <section
      className="relative min-h-[85vh] flex flex-col items-center justify-center overflow-hidden"
      style={{
        backgroundImage: `url(${heroBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Dark gradient overlay for readability */}
      <div 
        className="absolute inset-0 pointer-events-none" 
        style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.35) 30%, rgba(0,0,0,0.20) 55%, rgba(0,0,0,0.05) 100%)'
        }}
      />

      {/* Content */}
      <div className="relative z-10 text-center px-4 max-w-3xl mx-auto">
        {/* Hero Logo */}
        <div className="mb-10 animate-fade-in-up">
          <img
            src={heroLogo}
            alt="Zedu"
            className="h-24 md:h-32 w-auto mx-auto"
          />
        </div>

        {/* Brand headline */}
        <h1
          className="font-heading text-[32px] sm:text-[44px] md:text-[56px] lg:text-[64px] leading-[1.1] font-extrabold tracking-tight mb-8 animate-fade-in-up"
          style={{ animationDelay: "0.1s" }}
        >
          <span className="text-gradient-brand">Zedu</span>
          <span className="text-muted-foreground mx-2 md:mx-3">•</span>
          <span className="text-foreground">Tvoř</span>
          <span className="text-muted-foreground mx-2 md:mx-3">•</span>
          <span className="text-foreground">Uč</span>
          <span className="text-muted-foreground mx-2 md:mx-3">•</span>
          <span className="text-foreground">Objevuj</span>
        </h1>

        <p
          className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto animate-fade-in-up leading-relaxed mb-10"
          style={{ animationDelay: "0.3s" }}
        >
          Interaktivní učebnice, aktivity a procvičování v jedné platformě pro moderní výuku.
        </p>
      </div>

      {/* Feature cards – inside the hero */}
      <div className="relative z-10 px-4 pb-12 w-full">
        <div className="container mx-auto max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {features.map((feature, i) => (
              <div
                key={feature.title}
                className="group bg-card/90 backdrop-blur-sm border border-border rounded-2xl p-6 card-shadow hover:card-shadow-hover transition-all duration-300 animate-fade-in-up"
                style={{ animationDelay: `${0.5 + i * 0.1}s` }}
              >
                <div className="w-10 h-10 rounded-xl bg-primary/[0.08] flex items-center justify-center mb-4 group-hover:bg-primary/[0.12] transition-colors">
                  <feature.icon size={20} className="text-primary" />
                </div>
                <h3 className="font-heading text-base font-semibold text-foreground mb-1.5">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
