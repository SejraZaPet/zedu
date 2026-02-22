import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Block } from "@/lib/textbook-config";

interface Props {
  block: Block;
  onChange: (props: Record<string, any>) => void;
}

const extractYouTubeId = (url: string): string | null => {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
};

const YouTubeBlock = ({ block, onChange }: Props) => {
  const videoId = extractYouTubeId(block.props.url || "");
  const isInvalid = block.props.url && !videoId;

  return (
    <div className="space-y-3">
      <div>
        <Label>YouTube URL</Label>
        <Input
          value={block.props.url || ""}
          onChange={(e) => onChange({ ...block.props, url: e.target.value })}
          placeholder="https://www.youtube.com/watch?v=... nebo https://youtu.be/..."
          className="mt-1"
        />
        {isInvalid && (
          <p className="text-destructive text-xs mt-1">Neplatný odkaz na YouTube</p>
        )}
      </div>

      {videoId && (
        <div className="aspect-video w-full max-w-sm rounded overflow-hidden border border-border">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}`}
            className="w-full h-full"
            allowFullScreen
            title="YouTube preview"
          />
        </div>
      )}

      <div>
        <Label>Popisek (volitelné)</Label>
        <Input
          value={block.props.caption || ""}
          onChange={(e) => onChange({ ...block.props, caption: e.target.value })}
          placeholder="Popisek pod videem"
          className="mt-1"
        />
      </div>

      <div>
        <Label>Šířka</Label>
        <Select
          value={block.props.width || "full"}
          onValueChange={(v) => onChange({ ...block.props, width: v })}
        >
          <SelectTrigger className="mt-1 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="full">100 %</SelectItem>
            <SelectItem value="three_quarter">75 %</SelectItem>
            <SelectItem value="half">50 %</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default YouTubeBlock;
