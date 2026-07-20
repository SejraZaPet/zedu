import { Rocket, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import heroBgDefault from "@/assets/hero-students.png";
import heroLogoDefault from "@/assets/zedu-hero-logo-text.png";
import { getLandingIcon } from "@/lib/landing-icons";
import { DEFAULT_HERO_PROPS, mergeSectionProps } from "@/lib/landing-defaults";

interface HeroProps {
  props?: Partial<typeof DEFAULT_HERO_PROPS>;
}

const Hero = ({ props }: HeroProps) => {
  const navigate = useNavigate();
  const p = mergeSectionProps(DEFAULT_HERO_PROPS, props);

  const bgUrl = p.background_image_url && p.background_image_url.trim() !== "" ? p.background_image_url : heroBgDefault;
  const logoUrl = p.logo_image_url && p.logo_image_url.trim() !== "" ? p.logo_image_url : heroLogoDefault;
  const PrimaryIcon = getLandingIcon(p.primary_cta?.icon, Rocket);
  const SecondaryIcon = getLandingIcon(p.secondary_cta?.icon, Play);
  const titleParts: string[] = Array.isArray(p.title_parts) ? p.title_parts : DEFAULT_HERO_PROPS.title_parts;
  const features = Array.isArray(p.features) ? p.features : DEFAULT_HERO_PROPS.features;

  const handlePrimary = () => {
    if (p.primary_cta?.href) navigate(p.primary_cta.href);
  };
  const handleSecondary = () => {
    if (p.secondary_cta?.scroll_to) {
      document.querySelector(`#${p.secondary_cta.scroll_to}`)?.scrollIntoView({ behavior: "smooth" });
    } else if ((p.secondary_cta as any)?.href) {
      navigate((p.secondary_cta as any).href);
    }
  };

  return (
    <div>
      <section
        className="relative min-h-[75vh] flex flex-col items-center justify-center overflow-hidden"
        style={{
          backgroundImage: `url(${bgUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.40) 0%, rgba(0,0,0,0.35) 40%, rgba(0,0,0,0.30) 70%, rgba(0,0,0,0.15) 100%)",
          }}
        />

        <div className="relative z-10 text-center px-4 max-w-3xl mx-auto py-16 md:py-24">
          <h1
            className="flex items-center justify-center whitespace-nowrap gap-2 sm:gap-3 md:gap-4 font-heading font-extrabold tracking-tight mb-8 animate-fade-in-up"
            style={{ animationDelay: "0.1s" }}
          >
            <img
              src={logoUrl}
              alt="ZEdu"
              className="h-[28px] sm:h-[40px] md:h-[52px] lg:h-[60px] w-auto object-contain block"
            />
            {titleParts.map((part, i) => (
              <span key={i} className="contents">
                <span className="text-white/60 text-[24px] sm:text-[36px] md:text-[48px] lg:text-[56px] leading-none">•</span>
                <span className="text-white text-[24px] sm:text-[36px] md:text-[48px] lg:text-[56px] leading-none">{part}</span>
              </span>
            ))}
          </h1>

          <p
            className="text-base md:text-lg text-white max-w-xl mx-auto mb-8 mt-4 animate-fade-in-up leading-relaxed drop-shadow-md whitespace-pre-line"
            style={{ animationDelay: "0.4s" }}
          >
            {p.subtitle}
          </p>

          <div
            className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up"
            style={{ animationDelay: "0.5s" }}
          >
            <button
              onClick={handlePrimary}
              className="bg-white text-primary font-semibold rounded-2xl px-8 py-4 text-lg shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all inline-flex items-center justify-center"
            >
              <PrimaryIcon className="w-5 h-5 mr-2" /> {p.primary_cta?.label ?? "Vyzkoušet zdarma"}
            </button>
            <button
              onClick={handleSecondary}
              className="bg-white/20 backdrop-blur-sm border border-white/30 text-white font-semibold rounded-2xl px-8 py-4 text-lg hover:bg-white/30 transition-all inline-flex items-center justify-center"
            >
              <SecondaryIcon className="w-5 h-5 mr-2" /> {p.secondary_cta?.label ?? "Jak to funguje ↓"}
            </button>
          </div>

          {p.disclaimer && (
            <p
              className="text-sm text-white/90 mt-4 animate-fade-in-up drop-shadow-md"
              style={{ animationDelay: "0.6s" }}
            >
              {p.disclaimer}
            </p>
          )}
        </div>
      </section>

      <div className="relative z-10 px-4 -mt-[60px]">
        <div
          className="mx-auto bg-card p-6 md:p-10"
          style={{ maxWidth: "1100px", boxShadow: "0 30px 80px rgba(0,0,0,0.15)", borderRadius: "28px" }}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {features.map((feature, i) => {
              const Icon = getLandingIcon(feature.icon);
              return (
                <div
                  key={`${feature.title}-${i}`}
                  className={`group flex items-start gap-4 rounded-2xl p-5 transition-all duration-300 animate-fade-in-up hover:bg-muted/50 ${feature.href ? "cursor-pointer" : ""}`}
                  style={{ animationDelay: `${0.5 + i * 0.1}s` }}
                  onClick={() => feature.href && navigate(feature.href)}
                  role={feature.href ? "link" : undefined}
                >
                  <div className="w-12 h-12 shrink-0 rounded-xl bg-gradient-brand-sm flex items-center justify-center transition-colors">
                    <Icon size={24} className="text-primary-foreground" />
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
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;
