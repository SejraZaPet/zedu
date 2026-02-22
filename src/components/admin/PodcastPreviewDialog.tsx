import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye, RefreshCw } from "lucide-react";
import type { Block } from "@/lib/textbook-config";
import { LessonBlock } from "@/components/LessonBlockRenderer";

interface Episode {
  title: string;
  published_date: string;
  duration: string;
  audio_url: string;
  thumbnail_url: string;
  excerpt: string;
  blocks: Block[];
}

const PodcastPreviewDialog = ({ episode }: { episode: Episode }) => {
  const [open, setOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const visibleBlocks = episode.blocks.filter((b) => b.visible !== false);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Eye className="w-4 h-4 mr-1" />Náhled
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="sticky top-0 z-10 bg-background border-b border-border px-6 py-3 flex flex-row items-center justify-between">
            <DialogTitle className="text-sm font-medium">Náhled epizody</DialogTitle>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setRefreshKey((k) => k + 1)}
              className="ml-auto mr-8"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" />Obnovit
            </Button>
          </DialogHeader>

          <div key={refreshKey} className="bg-background px-4 py-8">
            <div className="mx-auto max-w-3xl">
              {episode.thumbnail_url && (
                <img
                  src={episode.thumbnail_url}
                  alt={episode.title}
                  className="w-full rounded-lg mb-8 object-cover max-h-80"
                />
              )}
              <h1 className="font-heading text-4xl md:text-5xl font-bold mb-4 text-foreground">
                {episode.title || "Bez názvu"}
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
                  <a href={episode.audio_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm">
                    🎧 Poslechnout epizodu →
                  </a>
                </div>
              )}

              <div className="space-y-6">
                {visibleBlocks.map((block) => (
                  <LessonBlock key={block.id} block={block} />
                ))}
              </div>

              {visibleBlocks.length === 0 && !episode.excerpt && (
                <p className="text-muted-foreground">Obsah epizody se připravuje.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PodcastPreviewDialog;
