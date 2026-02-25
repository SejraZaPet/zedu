import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import MiniRichEditor from "./MiniRichEditor";
import type { Block } from "@/lib/textbook-config";

interface Props {
  block: Block;
  onChange: (props: Record<string, any>) => void;
}

const CALLOUT_TYPES = [
  { value: "note", label: "📝 Poznámka" },
  { value: "warning", label: "⚠️ Pozor" },
  { value: "tip", label: "💡 Tip" },
  { value: "remember", label: "🧠 Zapamatovat si" },
];

const CalloutBlock = ({ block, onChange }: Props) => (
  <div className="space-y-2">
    <div className="w-48">
      <Label className="text-xs">Typ</Label>
      <Select value={block.props.calloutType || "note"} onValueChange={(v) => onChange({ ...block.props, calloutType: v })}>
        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
        <SelectContent>
          {CALLOUT_TYPES.map((t) => (
            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
    <MiniRichEditor
      content={block.props.text || ""}
      onChange={(html) => onChange({ ...block.props, text: html })}
      placeholder="Text callout boxu…"
      minHeight="60px"
      showHeadings={false}
    />
  </div>
);

export default CalloutBlock;
