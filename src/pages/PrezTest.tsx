import { useRef, useState } from "react";
import SlideCanvas from "@/components/admin/SlideCanvas";
import { SlideFloatingFormatToolbar } from "@/components/admin/SlideFloatingFormatToolbar";
import type { Block } from "@/lib/textbook-config";

/** DOČASNÁ diagnostická stránka editoru prezentací. */
export default function PrezTest() {
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [slide, setSlide] = useState<any>({
    slideId: "test-1",
    type: "content",
    layout: "full",
    projector: { headline: "Testovací slide" },
    blocks: [
      { id: "b1", type: "paragraph", props: { text: "Test textu" }, visible: true },
      {
        id: "b4",
        type: "table",
        props: { headers: ["A", "B"], rows: [["1", "2"], ["3", "4"]] },
        visible: true,
      },
    ] as unknown as Block[],
  });

  const blocks: Block[] = slide.blocks || [];
  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) || null;

  const updateBlock = (id: string, patch: any) =>
    setSlide((s: any) => ({
      ...s,
      blocks: (s.blocks || []).map((b: Block) =>
        b.id === id ? (typeof patch === "function" ? patch(b) : { ...b, ...patch }) : b,
      ),
    }));

  return (
    <main className="min-h-screen bg-background p-6">
      <h1 className="mb-4 text-lg font-semibold">Diagnostika editoru prezentací</h1>
      <div ref={canvasWrapRef} className="relative" style={{ height: 560 }}>
        <SlideCanvas
          slide={slide}
          editable
          onChangeBlock={updateBlock}
          onMoveBlock={() => {}}
          onDeleteBlock={() => {}}
          selectedBlockId={selectedBlockId}
          onSelectBlock={setSelectedBlockId}
        />
        <SlideFloatingFormatToolbar
          containerRef={canvasWrapRef}
          block={selectedBlock}
          positionKey={blocks.length}
          onChangeProps={(props) => {
            if (!selectedBlockId) return;
            updateBlock(selectedBlockId, (b: Block) => ({ ...b, props }));
          }}
          onMove={() => {}}
          onDelete={() => {}}
        />
      </div>
      <pre data-testid="state" className="mt-4 max-h-64 overflow-auto rounded bg-muted p-2 text-xs">
        {JSON.stringify(slide.blocks, null, 2)}
      </pre>
    </main>
  );
}
