import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { Block } from "@/lib/textbook-config";

interface Props {
  block: Block;
  onChange: (props: Record<string, any>) => void;
}

const DividerBlock = ({ block, onChange }: Props) => (
  <div className="flex gap-3 items-end">
    <div className="w-40">
      <Label className="text-xs">Styl</Label>
      <Select value={block.props.style || "line"} onValueChange={(v) => onChange({ ...block.props, style: v })}>
        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="line">Čára</SelectItem>
          <SelectItem value="dots">Tečky</SelectItem>
          <SelectItem value="space">Mezera</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <div className="flex-1 border-t border-border my-3" />
  </div>
);

export default DividerBlock;
