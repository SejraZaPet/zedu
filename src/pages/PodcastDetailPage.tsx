import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { LessonBlock } from "@/components/LessonBlockRenderer";
import { ArrowLeft } from "lucide-react";
import type { Block } from "@/lib/textbook-config";

interface Episode {
  id: string;
  title: string;
  published_date: string;
  duration: string;
  audio_url: string;
  thumbnail_url: string;
  excerpt: string;
  blocks: Block[];
  status: string;
}

const PodcastDetailPage = () => {
  const { episodeId } = useParams<{ episodeId: string }>();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      if (!episodeId) return;
      const { data } = await supabase
        .from("podcast_episodes")
        .select("*")
        .eq("id", episodeId)
        .eq("status", "published")
        .maybeSingle();
      if (data) {
        setEpisode({ ...data, blocks: (data.blocks as unknown as Block[]) || [] });
      }
      setLoading(false);
    };
    fetch();
  }, [episodeId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="section-padding">
          <div className="container mx-auto max-w-3xl">
            <p className="text-muted-foreground">Načítání…</p>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (!episode) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="section-padding">
          <div className="container mx-auto max-w-3xl text-center">
            <h1 className="font-heading text-3xl mb-4">Epizoda nenalezena</h1>
            <Link to="/#podcast" className="text-primary hover:underline">← Zpět na podcast</Link>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const visibleBlocks = episode.blocks.filter((b) => b.visible !== false);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="section-padding">
        <div className="container mx-auto max-w-3xl">
          <Link to="/#podcast" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Zpět na podcast
          </Link>

          {episode.thumbnail_url && (
            <img
              src={episode.thumbnail_url}
              alt={episode.title}
              className="w-full rounded-lg mb-8 object-cover max-h-96"
            />
          )}

          <h1 className="font-heading text-4xl md:text-5xl font-bold mb-4 text-foreground">
            {episode.title}
          </h1>

          <div className="flex items-center gap-3 mb-6 text-sm text-muted-foreground">
            <span>{new Date(episode.published_date).toLocaleDateString("cs-CZ")}</span>
            {episode.duration && (
              <>
                <span>•</span>
                <span>{episode.duration}</span>
              </>
            )}
          </div>

          {episode.excerpt && (
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">{episode.excerpt}</p>
          )}

          {episode.audio_url && (
            <div className="mb-8 p-4 rounded-lg border border-border bg-card">
              <a
                href={episode.audio_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                🎧 Poslechnout epizodu →
              </a>
            </div>
          )}

          <div className="space-y-6">
            {visibleBlocks.map((block) => (
              <LessonBlock key={block.id} block={block} />
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default PodcastDetailPage;
