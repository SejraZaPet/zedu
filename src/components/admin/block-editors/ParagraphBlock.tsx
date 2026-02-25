import MiniRichEditor from "./MiniRichEditor";
import type { Block } from "@/lib/textbook-config";

interface Props {
  block: Block;
  onChange: (props: Record<string, any>) => void;
}

const ParagraphBlock = ({ block, onChange }: Props) => (
  <MiniRichEditor
    content={block.props.text || ""}
    onChange={(html) => onChange({ ...block.props, text: html })}
    placeholder="Odstavec textu…"
    showHeadings={false}
    showLists
    showAlign
  />
);

export default ParagraphBlock;
