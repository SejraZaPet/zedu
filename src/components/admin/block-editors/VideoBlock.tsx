import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FolderOpen } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MediaPickerDialog } from "@/components/media/MediaPickerDialog";
import type { Block } from "@/lib/textbook-config";

interface Props {
  block: Block;
  onChange: (props: Record<string, any>) => void;
}

const VideoBlock = ({ block, onChange }: Props) => {
  const p = block.props || {};
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label className="text-xs">Odkaz na video soubor</Label>
          <Input
            className="mt-1"
            value={p.url || ""}
            onChange={(e) => onChange({ ...p, url: e.target.value })}
            placeholder="https://… (mp4)"
          />
        </div>
        <MediaPickerDialog
          imageOnly={false}
          onPick={(url) => onChange({ ...p, url })}
          trigger={
            <Button size="sm" variant="outline">
              <FolderOpen className="mr-1 h-4 w-4" /> Z knihovny
            </Button>
          }
        />
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <Label className="text-xs">Popisek</Label>
          <Input
            className="mt-1"
            value={p.caption || ""}
            onChange={(e) => onChange({ ...p, caption: e.target.value })}
          />
        </div>
        <div className="w-32">
          <Label className="text-xs">Šířka</Label>
          <Select value={p.width || "full"} onValueChange={(v) => onChange({ ...p, width: v })}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="full">Plná</SelectItem>
              <SelectItem value="medium">Střední</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {p.url && <video controls src={p.url} className="max-h-48 w-full rounded border border-border" />}
    </div>
  );
};

export default VideoBlock;
