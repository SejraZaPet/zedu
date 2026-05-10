import { BookOpen, Sparkles, GraduationCap, Rocket, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import heroBg from "@/assets/hero-students.png";
import heroLogo from "@/assets/zedu-hero-logo-text.png";

const features = [
  {
    icon: BookOpen,
    title: "Digitální učebnice",
    description: "Vytvářejte kapitoly, výukový obsah a strukturované materiály.",
    href: null as string | null,
  },
  {
    icon: Sparkles,
    title: "Interaktivní aktivity",
    description: "Přidávejte kvízy, procvičování a interaktivní prvky.",
    href: "/aktivity",
  },
  {
    icon: GraduationCap,
    title: "Pro žáky",
    description: "Procvičujte učivo, řešte interaktivní úkoly a sledujte svůj pokrok.",
    href: null as string | null,
  },
];

const Hero = () => {
  const navigate = useNavigate();
  return (
    <div>
      {/* Hero with background image */}
      <section
        className="relative min-h-[75vh] flex flex-col items-center justify-center overflow-hidden"
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
              "linear-gradient(180deg, rgba(0,0,0,0.40) 0%, rgba(0,0,0,0.35) 40%, rgba(0,0,0,0.30) 70%, rgba(0,0,0,0.15) 100%)",
          }}
        />

        {/* Content */}
        <div className="relative z-10 text-center px-4 max-w-3xl mx-auto py-16 md:py-24">

          {/* Brand headline */}
          <h1
            className="flex items-center justify-center whitespace-nowrap gap-2 sm:gap-3 md:gap-4 font-heading font-extrabold tracking-tight mb-8 animate-fade-in-up"
            style={{ animationDelay: "0.1s" }}
          >
            <img
              src={heroLogo}
              alt="ZEdu"
              className="h-[28px] sm:h-[40px] md:h-[52px] lg:h-[60px] w-auto object-contain block"
            />
            <span className="text-white/60 text-[24px] sm:text-[36px] md:text-[48px] lg:text-[56px] leading-none">•</span>
            <span className="text-white text-[24px] sm:text-[36px] md:text-[48px] lg:text-[56px] leading-none">Tvoř</span>
            <span className="text-white/60 text-[24px] sm:text-[36px] md:text-[48px] lg:text-[56px] leading-none">•</span>
            <span className="text-white text-[24px] sm:text-[36px] md:text-[48px] lg:text-[56px] leading-none">Uč</span>
            <span className="text-white/60 text-[24px] sm:text-[36px] md:text-[48px] lg:text-[56px] leading-none">•</span>
            <span className="text-white text-[24px] sm:text-[36px] md:text-[48px] lg:text-[56px] leading-none">Objevuj</span>
          </h1>

          <p
            className="text-base md:text-lg text-white/75 max-w-xl mx-auto mb-8 mt-4 animate-fade-in-up leading-relaxed"
            style={{ animationDelay: "0.4s" }}
          >
            Kompletní platforma pro moderní výuku. Učebnice, živé hry, rozvrh a AI — vše na jednom místě.
          </p>

          <div
            className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up"
            style={{ animationDelay: "0.5s" }}
          >
            <button
              onClick={() => navigate("/auth")}
              className="bg-white text-primary font-semibold rounded-2xl px-8 py-4 text-lg shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all inline-flex items-center justify-center"
            >
              <Rocket className="w-5 h-5 mr-2" /> Vyzkoušet zdarma
            </button>
            <button
              onClick={() => document.querySelector('#jak-to-funguje')?.scrollIntoView({ behavior: 'smooth' })}
              className="bg-white/20 backdrop-blur-sm border border-white/30 text-white font-semibold rounded-2xl px-8 py-4 text-lg hover:bg-white/30 transition-all inline-flex items-center justify-center"
            >
              <Play className="w-5 h-5 mr-2" /> Jak to funguje ↓
            </button>
          </div>

          <p
            className="text-xs text-white/40 mt-4 animate-fade-in-up"
            style={{ animationDelay: "0.6s" }}
          >
            Zdarma pro všechny učitele. Bez platební karty.
          </p>
        </div>
      </section>

      {/* Cards panel – separate from the hero image */}
      <div className="relative z-10 px-4 -mt-[60px]">
        <div
          className="mx-auto bg-card p-6 md:p-10"
          style={{ maxWidth: "1100px", boxShadow: "0 30px 80px rgba(0,0,0,0.15)", borderRadius: "28px" }}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {features.map((feature, i) => (
              <div
                key={feature.title}
                className={`group flex items-start gap-4 rounded-2xl p-5 transition-all duration-300 animate-fade-in-up hover:bg-muted/50 ${feature.href ? "cursor-pointer" : ""}`}
                style={{ animationDelay: `${0.5 + i * 0.1}s` }}
                onClick={() => feature.href && navigate(feature.href)}
                role={feature.href ? "link" : undefined}
              >
                <div className="w-12 h-12 shrink-0 rounded-xl bg-gradient-brand flex items-center justify-center group-hover:bg-gradient-brand transition-colors">
                  <feature.icon size={24} className="text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-heading text-base font-semibold text-foreground mb-1">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;
