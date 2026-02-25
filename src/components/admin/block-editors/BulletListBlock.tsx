import MiniRichEditor from "./MiniRichEditor";
import type { Block } from "@/lib/textbook-config";

interface Props {
  block: Block;
  onChange: (props: Record<string, any>) => void;
}

const BulletListBlock = ({ block, onChange }: Props) => (
  <MiniRichEditor
    content={block.props.html || (block.props.items ? `<ul>${(block.props.items as string[]).map(i => `<li>${i}</li>`).join("")}</ul>` : "")}
    onChange={(html) => onChange({ ...block.props, html })}
    placeholder="Pište body seznamu…"
    showHeadings={false}
    showLists
    showAlign={false}
  />
);

export default BulletListBlock;
