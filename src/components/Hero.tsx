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
    <div>
      {/* Hero with background image */}
      <section
        className="relative min-h-[60vh] flex flex-col items-center justify-center overflow-hidden"
        style={{
          backgroundImage: `url(${heroBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Dark gradient overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.25) 35%, rgba(0,0,0,0.12) 60%, rgba(0,0,0,0) 100%)",
          }}
        />

        {/* Content */}
        <div className="relative z-10 text-center px-4 max-w-3xl mx-auto py-16 md:py-24">
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
            className="font-heading text-[32px] sm:text-[44px] md:text-[56px] lg:text-[64px] leading-[1.1] font-extrabold tracking-tight mb-8 animate-fade-in-up text-white"
            style={{ animationDelay: "0.1s" }}
          >
            <span className="text-gradient-brand">Zedu</span>
            <span className="text-white/60 mx-2 md:mx-3">•</span>
            <span className="text-white">Tvoř</span>
            <span className="text-white/60 mx-2 md:mx-3">•</span>
            <span className="text-white">Uč</span>
            <span className="text-white/60 mx-2 md:mx-3">•</span>
            <span className="text-white">Objevuj</span>
          </h1>

          <p
            className="text-base md:text-lg text-white/80 max-w-xl mx-auto animate-fade-in-up leading-relaxed"
            style={{ animationDelay: "0.3s" }}
          >
            Interaktivní učebnice, aktivity a procvičování v jedné platformě
            pro moderní výuku.
          </p>
        </div>
      </section>

      {/* Cards panel – separate from the hero image */}
      <div className="relative z-10 px-4 -mt-24 md:-mt-28">
        <div
          className="container mx-auto max-w-4xl bg-card p-6 md:p-10"
          style={{ boxShadow: "0 30px 80px rgba(0,0,0,0.15)", borderRadius: "28px" }}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {features.map((feature, i) => (
              <div
                key={feature.title}
                className="group rounded-2xl p-6 transition-all duration-300 animate-fade-in-up hover:bg-muted/50"
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
    </div>
  );
};

export default Hero;
