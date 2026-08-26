import { useState } from "react";
import SlideCanvas from "@/components/admin/SlideCanvas";
import type { Block } from "@/lib/textbook-config";

const sampleBlocks: Block[] = [
  { id: "b1", type: "heading", visible: true, props: { level: 2, text: "" } },
  { id: "b2", type: "paragraph", visible: true, props: { text: "" } },
  { id: "b3", type: "bullet_list", visible: true, props: { items: [] } },
  { id: "b4", type: "paragraph", visible: true, props: { text: "Toto je vyplněný blok." } },
];

export default function SlideHintsPreview() {
  const [blocks, setBlocks] = useState(sampleBlocks);
  const [selected, setSelected] = useState<string | null>("b1");

  return (
    <div className="h-screen w-screen bg-background p-8">
      <div className="mx-auto h-full max-w-6xl rounded-xl border border-border bg-black/80 p-4">
        <SlideCanvas
          slide={{
            layout: "full",
            headline: "Náhled hintů",
            blocks,
            background: { type: "solid", value: "#1e293b" },
          }}
          themeId="dark"
          editable
          selectedBlockId={selected}
          onSelectBlock={setSelected}
          onChangeBlock={(_, patch) => {
            setBlocks((prev) =>
              prev.map((b) => {
                const next = typeof patch === "function" ? patch(b) : { ...b, ...patch };
                return b.id === next.id ? next : b;
              })
            );
          }}
        />
      </div>
    </div>
  );
}
