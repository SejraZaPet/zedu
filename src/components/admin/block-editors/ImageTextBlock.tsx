import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import type { Block } from "@/lib/textbook-config";
import { useState } from "react";

interface Props {
  block: Block;
  onChange: (props: Record<string, any>) => void;
}

const ImageTextBlock = ({ block, onChange }: Props) => {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("lesson-images").upload(path, file);
    if (!error) {
      const { data } = supabase.storage.from("lesson-images").getPublicUrl(path);
      onChange({ ...block.props, imageUrl: data.publicUrl });
    }
    setUploading(false);
  };

  return (
    <div className="space-y-2">
      <div className="w-32">
        <Label className="text-xs">Pozice obrázku</Label>
        <Select value={block.props.imagePosition} onValueChange={(v) => onChange({ ...block.props, imagePosition: v })}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Vlevo</SelectItem>
            <SelectItem value="right">Vpravo</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Obrázek</Label>
          <div className="flex gap-1 mt-1">
            <Input value={block.props.imageUrl} onChange={(e) => onChange({ ...block.props, imageUrl: e.target.value })} placeholder="URL…" className="flex-1" />
            <Button size="icon" variant="outline" className="relative shrink-0" disabled={uploading}>
              <Upload className="w-4 h-4" />
              <input type="file" accept="image/*" onChange={handleUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
            </Button>
          </div>
          {block.props.imageUrl && <img src={block.props.imageUrl} alt="" className="mt-2 max-h-24 rounded border border-border" />}
        </div>
        <div>
          <Label className="text-xs">Text</Label>
          <Textarea value={block.props.text} onChange={(e) => onChange({ ...block.props, text: e.target.value })} rows={4} className="mt-1" />
        </div>
      </div>
    </div>
  );
};

export default ImageTextBlock;
