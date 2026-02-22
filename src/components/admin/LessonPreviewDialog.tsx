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

interface Props {
  title: string;
  heroImageUrl: string | null;
  blocks: Block[];
}

const LessonPreviewDialog = ({ title, heroImageUrl, blocks }: Props) => {
  const [open, setOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const visibleBlocks = blocks.filter((b) => b.visible !== false);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Eye className="w-4 h-4 mr-1" />Náhled
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="sticky top-0 z-10 bg-background border-b border-border px-6 py-3 flex flex-row items-center justify-between">
            <DialogTitle className="text-sm font-medium">Náhled lekce</DialogTitle>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setRefreshKey((k) => k + 1)}
              className="ml-auto mr-8"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" />Obnovit
            </Button>
          </DialogHeader>

          {/* Render preview in frontend styles */}
          <div key={refreshKey} className="bg-background px-4 py-8">
            <div className="mx-auto max-w-3xl">
              {heroImageUrl && (
                <img
                  src={heroImageUrl}
                  alt={title}
                  className="w-full rounded-lg mb-8 object-cover max-h-80"
                />
              )}
              <h1 className="font-heading text-4xl md:text-5xl font-bold mb-10 text-foreground">
                {title || "Bez názvu"}
              </h1>

              <div className="space-y-6">
                {visibleBlocks.map((block) => (
                  <LessonBlock key={block.id} block={block} />
                ))}
              </div>

              {visibleBlocks.length === 0 && (
                <p className="text-muted-foreground">Obsah lekce se připravuje.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LessonPreviewDialog;
