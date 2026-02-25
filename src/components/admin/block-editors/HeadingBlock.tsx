import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MiniRichEditor from "./MiniRichEditor";
import type { Block } from "@/lib/textbook-config";

interface Props {
  block: Block;
  onChange: (props: Record<string, any>) => void;
}

const HeadingBlock = ({ block, onChange }: Props) => (
  <div className="flex gap-2 items-start">
    <Select value={String(block.props.level)} onValueChange={(v) => onChange({ ...block.props, level: Number(v) })}>
      <SelectTrigger className="w-20 mt-1">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="1">H1</SelectItem>
        <SelectItem value="2">H2</SelectItem>
        <SelectItem value="3">H3</SelectItem>
        <SelectItem value="4">H4</SelectItem>
      </SelectContent>
    </Select>
    <div className="flex-1">
      <MiniRichEditor
        content={block.props.text || ""}
        onChange={(html) => onChange({ ...block.props, text: html })}
        placeholder="Text nadpisu…"
        minHeight="40px"
        showHeadings={false}
        showLists={false}
        showAlign
      />
    </div>
  </div>
);

export default HeadingBlock;
