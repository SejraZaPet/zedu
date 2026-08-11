import MiniRichEditor from "./MiniRichEditor";
import BlockStyleControls from "./BlockStyleControls";
import type { Block } from "@/lib/textbook-config";

interface Props {
  block: Block;
  onChange: (props: Record<string, any>) => void;
}

const ParagraphBlock = ({ block, onChange }: Props) => (
  <div>
    <MiniRichEditor
      content={block.props.text || ""}
      onChange={(html) => onChange({ ...block.props, text: html })}
      placeholder="Odstavec textu…"
      showHeadings={false}
      showLists
      showAlign
    />
    <BlockStyleControls block={block} onChange={onChange} />
  </div>
);

export default ParagraphBlock;
