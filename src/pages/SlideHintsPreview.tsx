import { useState } from "react";
import SlideCanvas from "@/components/admin/SlideCanvas";
import type { SlideSpec } from "@/lib/slide-spec";

const sampleSlide: SlideSpec = {
  id: "preview-slide",
  title: "Náhled hintů",
  layout: "full",
  themeId: "bezli-default",
  projector: { headline: "Ukázka editoru" },
  blocks: [
    {
      id: "heading-1",
      type: "heading",
      props: { level: 2, text: "" },
    },
    {
      id: "para-1",
      type: "paragraph",
      props: { text: "" },
    },
    {
      id: "bullets-1",
      type: "bullet_list",
      props: { items: [""] },
    },
    {
      id: "image-1",
      type: "image",
      props: { alignment: "center" },
    },
  ],
};

export default function SlideHintsPreview() {
  const [slide, setSlide] = useState<SlideSpec>(sampleSlide);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>("para-1");

  const updateBlock = (id: string, patch: (b: any) => any) => {
    setSlide((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => (b.id === id ? patch(b) : b)),
    }));
  };

  const moveBlock = (id: string, dir: "up" | "down") => {
    setSlide((prev) => {
      const idx = prev.blocks.findIndex((b) => b.id === id);
      if (idx < 0) return prev;
      const next = dir === "up" ? idx - 1 : idx + 1;
      if (next < 0 || next >= prev.blocks.length) return prev;
      const blocks = [...prev.blocks];
      [blocks[idx], blocks[next]] = [blocks[next], blocks[idx]];
      return { ...prev, blocks };
    });
  };

  const deleteBlock = (id: string) => {
    setSlide((prev) => ({ ...prev, blocks: prev.blocks.filter((b) => b.id !== id) }));
  };

  return (
    <div className="h-screen w-full bg-background p-8">
      <div className="mx-auto h-[600px] w-full max-w-5xl rounded-xl border border-border shadow-lg overflow-hidden">
        <SlideCanvas
          slide={slide}
          themeId="bezli-default"
          editable
          darkMode
          onChangeBlock={updateBlock}
          onMoveBlock={moveBlock}
          onDeleteBlock={deleteBlock}
          selectedBlockId={selectedBlockId}
          onSelectBlock={setSelectedBlockId}
        />
      </div>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Klikněte na blok pro editaci • klikněte znovu nebo vyberte blok pro formátovací lištu.
      </p>
    </div>
  );
}
