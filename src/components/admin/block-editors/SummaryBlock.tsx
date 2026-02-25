import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MiniRichEditor from "./MiniRichEditor";
import type { Block } from "@/lib/textbook-config";

interface Props {
  block: Block;
  onChange: (props: Record<string, any>) => void;
}

const SummaryBlock = ({ block, onChange }: Props) => (
  <div className="space-y-2">
    <div>
      <Label className="text-xs">Nadpis shrnutí</Label>
      <Input
        value={block.props.title || ""}
        onChange={(e) => onChange({ ...block.props, title: e.target.value })}
        placeholder="Shrnutí lekce"
        className="mt-1"
      />
    </div>
    <MiniRichEditor
      content={block.props.text || ""}
      onChange={(html) => onChange({ ...block.props, text: html })}
      placeholder="Klíčové body lekce…"
      showHeadings={false}
      showLists
      minHeight="100px"
    />
  </div>
);

export default SummaryBlock;
