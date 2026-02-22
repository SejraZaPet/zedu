import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Block } from "@/lib/textbook-config";

interface Props {
  block: Block;
  onChange: (props: Record<string, any>) => void;
}

const HeadingBlock = ({ block, onChange }: Props) => (
  <div className="flex gap-2">
    <Select value={String(block.props.level)} onValueChange={(v) => onChange({ ...block.props, level: Number(v) })}>
      <SelectTrigger className="w-20">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="1">H1</SelectItem>
        <SelectItem value="2">H2</SelectItem>
        <SelectItem value="3">H3</SelectItem>
      </SelectContent>
    </Select>
    <Input
      value={block.props.text}
      onChange={(e) => onChange({ ...block.props, text: e.target.value })}
      placeholder="Text nadpisu…"
      className="flex-1"
    />
  </div>
);

export default HeadingBlock;
