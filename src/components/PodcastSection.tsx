import { Mic, Play } from "lucide-react";

const episodes = [
  { title: "Jak začít s virtuálními učebnicemi", duration: "32 min", date: "10. 2. 2026" },
  { title: "Gastronomie jako životní styl", duration: "28 min", date: "27. 1. 2026" },
  { title: "Moderní výuka potravinářských předmětů", duration: "35 min", date: "15. 1. 2026" },
];

const PodcastSection = () => {
  return (
    <section id="podcast" className="section-padding bg-gradient-surface">
      <div className="container mx-auto max-w-4xl">
        <div className="flex items-center gap-3 mb-4">
          <Mic className="w-6 h-6 text-primary" />
          <span className="text-sm font-medium uppercase tracking-widest text-primary">Podcast</span>
        </div>
        <h2 className="font-heading text-3xl md:text-4xl font-semibold mb-12">
          Rozhovory & epizody
        </h2>

        <div className="space-y-4">
          {episodes.map((ep, i) => (
            <div
              key={i}
              className="group flex items-center gap-4 rounded-lg border border-border bg-card p-4 md:p-5 transition-all duration-300 hover:border-primary/30 hover:bg-surface-hover cursor-pointer"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Play className="w-4 h-4 text-primary ml-0.5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-card-foreground text-sm md:text-base truncate group-hover:text-primary transition-colors">
                  {ep.title}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">{ep.date}</span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">{ep.duration}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PodcastSection;