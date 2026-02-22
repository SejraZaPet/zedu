import { Textarea } from "@/components/ui/textarea";
import type { Block } from "@/lib/textbook-config";

interface Props {
  block: Block;
  onChange: (props: Record<string, any>) => void;
}

const ParagraphBlock = ({ block, onChange }: Props) => (
  <Textarea
    value={block.props.text}
    onChange={(e) => onChange({ ...block.props, text: e.target.value })}
    placeholder="Odstavec textu…"
    rows={3}
  />
);

export default ParagraphBlock;
