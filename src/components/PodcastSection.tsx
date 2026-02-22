import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Mic, Play } from "lucide-react";

interface Episode {
  id: string;
  title: string;
  published_date: string;
  duration: string;
  excerpt: string;
}

const PodcastSection = () => {
  const [episodes, setEpisodes] = useState<Episode[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("podcast_episodes")
        .select("id, title, published_date, duration, excerpt")
        .eq("status", "published")
        .order("published_date", { ascending: false })
        .limit(5);
      if (data) setEpisodes(data);
    };
    fetch();
  }, []);

  if (episodes.length === 0) return null;

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
          {episodes.map((ep) => (
            <Link
              key={ep.id}
              to={`/podcast/${ep.id}`}
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
                  <span className="text-xs text-muted-foreground">
                    {new Date(ep.published_date).toLocaleDateString("cs-CZ")}
                  </span>
                  {ep.duration && (
                    <>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">{ep.duration}</span>
                    </>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PodcastSection;
