import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
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
  const [showPlayer, setShowPlayer] = useState(false);

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
        <div className="aspect-video w-full max-w-sm rounded overflow-hidden border border-border relative bg-muted">
          {showPlayer ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
              className="w-full h-full"
              allowFullScreen
              title="YouTube preview"
            />
          ) : (
            <>
              <img
                src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                alt="Náhled videa"
                className="w-full h-full object-cover"
                loading="lazy"
                draggable={false}
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setShowPlayer(true)}
                className="absolute inset-0 m-auto h-10 w-10 rounded-full p-0 shadow-lg"
                title="Přehrát náhled"
              >
                <Play className="w-4 h-4" />
              </Button>
            </>
          )}
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
