import { useState } from "react";
import BlockEditor from "@/components/admin/BlockEditor";
import type { Block } from "@/lib/textbook-config";
import { groupBlocksIntoSlide } from "@/lib/slide-groups";

const p = (id: string, text: string): Block => ({ id, type: "paragraph", visible: true, props: { text } });

export default function QaGroupHeight() {
  const [blocks, setBlocks] = useState<Block[]>(() =>
    groupBlocksIntoSlide([p("p1", "Karta A"), p("p2", "Karta B")], ["p1", "p2"], 2),
  );
  return (
    <div className="p-8">
      <BlockEditor blocks={blocks} onChange={setBlocks} />
      <pre data-qa="dump">{JSON.stringify(blocks[0]?.props?.groupMinHeight ?? null)}</pre>
    </div>
  );
}
