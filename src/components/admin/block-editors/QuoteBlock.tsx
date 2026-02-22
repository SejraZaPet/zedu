import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Block } from "@/lib/textbook-config";

interface Props {
  block: Block;
  onChange: (props: Record<string, any>) => void;
}

const QuoteBlock = ({ block, onChange }: Props) => (
  <div className="space-y-2 border-l-2 border-primary pl-3">
    <div>
      <Label className="text-xs">Citace</Label>
      <Textarea value={block.props.text} onChange={(e) => onChange({ ...block.props, text: e.target.value })} placeholder="Text citace…" rows={2} className="mt-1" />
    </div>
    <div>
      <Label className="text-xs">Autor (volitelné)</Label>
      <Input value={block.props.author} onChange={(e) => onChange({ ...block.props, author: e.target.value })} placeholder="Autor…" className="mt-1" />
    </div>
  </div>
);

export default QuoteBlock;
