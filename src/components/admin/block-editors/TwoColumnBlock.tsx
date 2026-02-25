import MiniRichEditor from "./MiniRichEditor";
import type { Block } from "@/lib/textbook-config";

interface Props {
  block: Block;
  onChange: (props: Record<string, any>) => void;
}

const TwoColumnBlock = ({ block, onChange }: Props) => (
  <div className="grid grid-cols-2 gap-3">
    <div>
      <span className="text-xs text-muted-foreground mb-1 block">Levý sloupec</span>
      <MiniRichEditor
        content={block.props.left || ""}
        onChange={(html) => onChange({ ...block.props, left: html })}
        placeholder="Levý sloupec…"
        showHeadings
      />
    </div>
    <div>
      <span className="text-xs text-muted-foreground mb-1 block">Pravý sloupec</span>
      <MiniRichEditor
        content={block.props.right || ""}
        onChange={(html) => onChange({ ...block.props, right: html })}
        placeholder="Pravý sloupec…"
        showHeadings
      />
    </div>
  </div>
);

export default TwoColumnBlock;
