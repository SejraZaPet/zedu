import { BookOpen, Sparkles, GraduationCap } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
              "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.25) 35%, rgba(0,0,0,0.12) 60%, rgba(0,0,0,0) 100%)",
          }}
        />

        {/* Content */}
        <div className="relative z-10 text-center px-4 max-w-3xl mx-auto py-16 md:py-24">

          {/* Brand headline */}
          <h1
            className="font-heading text-[32px] sm:text-[44px] md:text-[56px] lg:text-[64px] leading-[1.1] font-extrabold tracking-tight mb-8 animate-fade-in-up text-white"
            style={{ animationDelay: "0.1s" }}
          >
            <span style={{ background: "linear-gradient(90deg, #6EC6D9, #9B6CFF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>ZEdu</span>
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
      <div className="relative z-10 px-4 -mt-[60px]">
        <div
          className="mx-auto bg-card p-6 md:p-10"
          style={{ maxWidth: "1100px", boxShadow: "0 30px 80px rgba(0,0,0,0.15)", borderRadius: "28px" }}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {features.map((feature, i) => (
              <div
                key={feature.title}
                className="group flex items-start gap-4 rounded-2xl p-5 transition-all duration-300 animate-fade-in-up hover:bg-muted/50"
                style={{ animationDelay: `${0.5 + i * 0.1}s` }}
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
