import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { Block } from "@/lib/textbook-config";

interface Props {
  block: Block;
  onChange: (props: Record<string, any>) => void;
  /** Ovládání stylu se zobrazuje jen při najetí / výběru bloku. */
  showControls?: boolean;
}

const styleOf = (block: Block) => block.props.style || "line";

/** Klidový (needitovaný) vzhled – stejný jako u žáka. */
const DividerPreview = ({ block }: { block: Block }) => {
  const style = styleOf(block);
  if (style === "space") return <div className="h-8" />;
  if (style === "dots") {
    return (
      <div className="flex items-center justify-center gap-2 py-4" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1.5 w-1.5 rounded-full bg-border" />
        ))}
      </div>
    );
  }
  return <div className="my-4 border-t border-border" />;
};

const DividerBlock = ({ block, onChange, showControls = true }: Props) => {
  if (!showControls) return <DividerPreview block={block} />;

  return (
    <div className="flex gap-3 items-end">
      <div className="w-40">
        <Label className="text-xs">Styl</Label>
        <Select value={styleOf(block)} onValueChange={(v) => onChange({ ...block.props, style: v })}>
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
};

export default DividerBlock;
