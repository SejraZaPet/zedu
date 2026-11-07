import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Block } from "@/lib/textbook-config";
import { normalizeMindMap } from "@/lib/mind-map";
import MindMapEditor from "@/components/mind-map/MindMapEditor";
import MindMapView from "@/components/mind-map/MindMapView";

interface Props {
  block: Block;
  onChange: (props: Record<string, any>) => void;
}

/** Editor bloku učebnice „Myšlenková mapa“ (jen zobrazení pro žáky). */
const MindMapBlock = ({ block, onChange }: Props) => {
  const map = normalizeMindMap(block.props.map);
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label className="text-xs">Nadpis (volitelný)</Label>
        <Input
          value={block.props.title ?? ""}
          onChange={(e) => onChange({ ...block.props, title: e.target.value })}
          className="h-11"
          placeholder="Např. Druhy masa"
        />
      </div>
      <MindMapEditor data={map} onChange={(next) => onChange({ ...block.props, map: next })} />
      <div className="rounded-lg border border-border bg-muted/20 p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Náhled</p>
        <MindMapView data={map} title={block.props.title || undefined} />
      </div>
    </div>
  );
};

export default MindMapBlock;
