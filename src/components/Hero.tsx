import { Button } from "@/components/ui/button";
import { ArrowDown } from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <img
          src={heroBg}
          alt="Gastronomie"
          className="w-full h-full object-cover"
          loading="eager"
        />
        <div className="absolute inset-0 bg-background/75" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-4 max-w-3xl mx-auto">
        <h1
          className="font-heading text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-4 animate-fade-in-up"
        >
          Sejra <span className="text-gradient-gold">za pět</span>
        </h1>

        <p className="font-body italic text-lg md:text-xl text-accent/80 mb-6 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          S láskou ke gastronomii do učitelské sborovny
        </p>

        <p
          className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto mb-10 animate-fade-in-up leading-relaxed"
          style={{ animationDelay: "0.4s" }}
        >
          Prostor pro sdílení materiálů, virtuálních učebnic a myšlenek
          pro učitele a studenty gastronomie a hotelnictví.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up" style={{ animationDelay: "0.6s" }}>
          <Button variant="hero" size="lg" asChild>
            <a href="#ucebnice">Prozkoumat učebnice</a>
          </Button>
          <Button variant="outline-gold" size="lg" asChild>
            <a href="#o-projektu">O projektu</a>
          </Button>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-muted-foreground">
        <ArrowDown size={20} />
      </div>
    </section>
  );
};

export default Hero;