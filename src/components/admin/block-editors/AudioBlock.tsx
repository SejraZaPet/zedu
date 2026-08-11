import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FolderOpen } from "lucide-react";
import { MediaPickerDialog } from "@/components/media/MediaPickerDialog";
import type { Block } from "@/lib/textbook-config";

interface Props {
  block: Block;
  onChange: (props: Record<string, any>) => void;
}

const AudioBlock = ({ block, onChange }: Props) => {
  const p = block.props || {};
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label className="text-xs">Odkaz na zvukový soubor</Label>
          <Input
            className="mt-1"
            value={p.url || ""}
            onChange={(e) => onChange({ ...p, url: e.target.value })}
            placeholder="https://… (mp3)"
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
      <div>
        <Label className="text-xs">Popisek</Label>
        <Input
          className="mt-1"
          value={p.caption || ""}
          onChange={(e) => onChange({ ...p, caption: e.target.value })}
          placeholder="např. Ukázka výslovnosti"
        />
      </div>
      {p.url && <audio controls src={p.url} className="w-full" />}
    </div>
  );
};

export default AudioBlock;
