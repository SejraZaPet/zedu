import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Block } from "@/lib/textbook-config";
import { useState } from "react";

interface GalleryImage {
  url: string;
  caption: string;
}

interface Props {
  block: Block;
  onChange: (props: Record<string, any>) => void;
}

const GalleryBlock = ({ block, onChange }: Props) => {
  const images: GalleryImage[] = block.props.images || [];
  const [uploading, setUploading] = useState<number | null>(null);

  const update = (i: number, field: string, val: string) => {
    const next = [...images];
    next[i] = { ...next[i], [field]: val };
    onChange({ ...block.props, images: next });
  };

  const add = () => onChange({ ...block.props, images: [...images, { url: "", caption: "" }] });

  const remove = (i: number) => onChange({ ...block.props, images: images.filter((_, idx) => idx !== i) });

  const handleUpload = async (i: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(i);
    const ext = file.name.split(".").pop();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("lesson-images").upload(path, file);
    if (!error) {
      const { data } = supabase.storage.from("lesson-images").getPublicUrl(path);
      update(i, "url", data.publicUrl);
    }
    setUploading(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-3 items-end">
        <div className="w-32">
          <Label className="text-xs">Sloupce</Label>
          <Select value={String(block.props.columns || 3)} onValueChange={(v) => onChange({ ...block.props, columns: Number(v) })}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="2">2</SelectItem>
              <SelectItem value="3">3</SelectItem>
              <SelectItem value="4">4</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        {images.map((img, i) => (
          <div key={i} className="flex gap-2 items-start border border-border rounded p-2">
            {img.url && <img src={img.url} alt="" className="w-16 h-16 rounded object-cover flex-shrink-0" />}
            <div className="flex-1 space-y-1">
              <div className="flex gap-1">
                <Input value={img.url} onChange={(e) => update(i, "url", e.target.value)} placeholder="URL…" className="text-sm h-8" />
                <Button size="sm" variant="outline" className="relative h-8 px-2" disabled={uploading === i}>
                  <Upload className="w-3 h-3" />
                  <input type="file" accept="image/*" onChange={(e) => handleUpload(i, e)} className="absolute inset-0 opacity-0 cursor-pointer" />
                </Button>
              </div>
              <Input value={img.caption} onChange={(e) => update(i, "caption", e.target.value)} placeholder="Popisek…" className="text-sm h-8" />
            </div>
            <Button size="icon" variant="ghost" className="h-6 w-6 flex-shrink-0" onClick={() => remove(i)}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        ))}
      </div>
      <Button size="sm" variant="ghost" onClick={add}><Plus className="w-3 h-3 mr-1" />Přidat obrázek</Button>
    </div>
  );
};

export default GalleryBlock;
