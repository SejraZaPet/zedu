import { useRef, useState } from "react";
import SlideCanvas from "@/components/admin/SlideCanvas";
import SlideFloatingFormatToolbar from "@/components/admin/SlideFloatingFormatToolbar";
import type { Block } from "@/lib/textbook-config";

const AlignPreview = () => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [blocks, setBlocks] = useState<Block[]>([
    { id: "b1", type: "paragraph", props: { text: "Zkušební odstavec pro kontrolu zarovnání a řádkování textu v editoru prezentací." } } as any,
    { id: "b2", type: "bullet_list", props: { items: ["První odrážka", "Druhá odrážka"] } } as any,
  ]);
  const [selectedId, setSelectedId] = useState<string | null>("b1");
  const selected = blocks.find((b) => b.id === selectedId) || null;

  const slide = { headline: "Test zarovnání", blocks } as any;

  return (
    <div className="min-h-screen bg-background p-8">
      <div ref={wrapRef} className="relative mx-auto w-[900px]">
        <SlideCanvas
          slide={slide}
          themeId="zedu-classic"
          editable
          onChangeBlock={(id, updater) =>
            setBlocks((bs) => bs.map((b) => (b.id === id ? updater(b) : b)))
          }
          onMoveBlock={() => {}}
          onDeleteBlock={() => {}}
          selectedBlockId={selectedId}
          onSelectBlock={setSelectedId}
        />
        <SlideFloatingFormatToolbar
          containerRef={wrapRef}
          block={selected}
          positionKey="0"
          onChangeProps={(props) => {
            if (!selectedId) return;
            setBlocks((bs) => bs.map((b) => (b.id === selectedId ? ({ ...b, props } as any) : b)));
          }}
          onMove={() => {}}
          onDelete={() => {}}
        />
      </div>
    </div>
  );
};

export default AlignPreview;
