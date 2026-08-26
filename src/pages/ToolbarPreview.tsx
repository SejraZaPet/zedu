import { useRef, useState } from "react";
import { SlideBody } from "@/components/admin/SlideCanvas";
import SlideFloatingFormatToolbar from "@/components/admin/SlideFloatingFormatToolbar";
import { createDefaultBlock, type Block } from "@/lib/textbook-config";

export default function ToolbarPreview() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [slide, setSlide] = useState(() => {
    const block = createDefaultBlock("paragraph");
    block.props = { ...block.props, text: "Testovací text pro zarovnání a řádkování." };
    return { blocks: [block] as Block[], projector: { headline: "Náhled", body: "" } };
  });
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(slide.blocks[0].id);

  const selectedBlock = slide.blocks.find((b) => b.id === selectedBlockId) || null;

  const onChangeBlock = (blockId: string, patch: Partial<Block> | ((b: Block) => Block)) => {
    setSlide((s) => ({
      ...s,
      blocks: s.blocks.map((b) => {
        if (b.id !== blockId) return b;
        const p = typeof patch === "function" ? patch(b) : { ...b, ...patch };
        return { ...b, ...p, props: { ...b.props, ...p.props } };
      }),
    }));
  };

  const onChangeProps = (props: Record<string, any>) => {
    if (!selectedBlock) return;
    onChangeBlock(selectedBlock.id, { props: { ...selectedBlock.props, ...props } });
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="mb-4 text-xl font-semibold">Test plovoucí lišty</h1>
      <div
        ref={containerRef}
        className="relative mx-auto w-full max-w-4xl rounded-xl border border-border bg-slate-900 p-8"
      >
        <SlideBody
          slide={slide}
          editable
          darkMode
          selectedBlockId={selectedBlockId}
          onSelectBlock={setSelectedBlockId}
          onChangeBlock={onChangeBlock}
        />
        {selectedBlock && (
          <SlideFloatingFormatToolbar
            containerRef={containerRef as any}
            block={selectedBlock}
            onChangeProps={onChangeProps}
            onMove={() => {}}
            onDelete={() => {}}
          />
        )}
      </div>
      <pre className="mt-4 rounded bg-muted p-2 text-xs">
        {JSON.stringify(selectedBlock?.props, null, 2)}
      </pre>
    </div>
  );
}
