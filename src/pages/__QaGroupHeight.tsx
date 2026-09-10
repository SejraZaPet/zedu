import BlockEditor from "@/components/admin/BlockEditor";
import { useState } from "react";

const long = Array.from({ length: 14 }, (_, i) => `<li>Dlouhá odrážka číslo ${i + 1} s textem</li>`).join("");

const QaGroupHeight = () => {
  const [blocks, setBlocks] = useState<any[]>([
    {
      id: "g1",
      type: "slide_group",
      visible: true,
      props: {
        layout: 2,
        children: [
          { id: "c1", type: "paragraph", visible: true, props: { text: `<ul>${long}</ul>`, groupHeight: 160 } },
          { id: "c2", type: "paragraph", visible: true, props: { text: "Krátký text" } },
        ],
      },
    },
  ]);
  return <div className="p-6"><BlockEditor blocks={blocks} onChange={setBlocks} /></div>;
};
export default QaGroupHeight;
