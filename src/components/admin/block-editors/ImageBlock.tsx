import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { Block } from "@/lib/textbook-config";
import { useState } from "react";
import { Upload, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MediaPickerDialog } from "@/components/media/MediaPickerDialog";
import IconPickerDialog from "@/components/admin/IconPickerDialog";
import { getSlideIcon } from "@/lib/slide-icons";
import { Shapes } from "lucide-react";

interface Props {
  block: Block;
  onChange: (props: Record<string, any>) => void;
}

const ImageBlock = ({ block, onChange }: Props) => {
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
      onChange({ ...block.props, url: data.publicUrl });
    }
    setUploading(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Label className="text-xs">URL obrázku</Label>
          <Input value={block.props.url} onChange={(e) => onChange({ ...block.props, url: e.target.value })} placeholder="https://…" className="mt-1" />
        </div>
        <Button size="sm" variant="outline" className="relative" disabled={uploading}>
          <Upload className="w-4 h-4 mr-1" />{uploading ? "…" : "Nahrát"}
          <input type="file" accept="image/*" onChange={handleUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
        </Button>
        <IconPickerDialog
          onPick={({ name, color }) => onChange({ ...block.props, url: "", icon: name, iconColor: color })}
          trigger={
            <Button size="sm" variant="outline">
              <Shapes className="w-4 h-4 mr-1" /> Vložit ikonu
            </Button>
          }
        />
        <MediaPickerDialog
          imageOnly
          onPick={(url) => onChange({ ...block.props, url })}
          onPickPhotoMeta={({ alt }) => {
            if (alt && !block.props.alt) onChange({ ...block.props, alt });
          }}
          trigger={
            <Button size="sm" variant="outline">
              <FolderOpen className="w-4 h-4 mr-1" /> Z knihovny
            </Button>
          }
        />
      </div>
      {block.props.url && (
        <img src={block.props.url} alt="" className="max-h-32 rounded border border-border object-cover" />
      )}
      {!block.props.url && block.props.icon && (() => {
        const IconCmp = getSlideIcon(block.props.icon);
        return (
          <div className="flex items-center gap-2 rounded border border-border p-2">
            <IconCmp style={{ color: block.props.iconColor || "currentColor", width: 40, height: 40 }} />
            <span className="text-xs text-muted-foreground">Ikona: {block.props.icon}</span>
            <Button size="sm" variant="ghost" onClick={() => onChange({ ...block.props, icon: undefined, iconColor: undefined })}>
              Odebrat
            </Button>
          </div>
        );
      })()}
      <div>
        <Label className="text-xs">Alternativní text (pro čtečky obrazovky)</Label>
        <Input
          value={block.props.alt || ""}
          onChange={(e) => onChange({ ...block.props, alt: e.target.value })}
          placeholder="Krátký popis, co je na obrázku"
          className="mt-1"
        />
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <Label className="text-xs">Popisek</Label>
          <Input value={block.props.caption} onChange={(e) => onChange({ ...block.props, caption: e.target.value })} className="mt-1" />
        </div>
        <div className="w-28">
          <Label className="text-xs">Šířka</Label>
          <Select value={block.props.width} onValueChange={(v) => onChange({ ...block.props, width: v })}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="full">Plná</SelectItem>
              <SelectItem value="medium">Střední</SelectItem>
              <SelectItem value="small">Malá</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-28">
          <Label className="text-xs">Zarovnání</Label>
          <Select value={block.props.alignment} onValueChange={(v) => onChange({ ...block.props, alignment: v })}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Vlevo</SelectItem>
              <SelectItem value="center">Střed</SelectItem>
              <SelectItem value="right">Vpravo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};

export default ImageBlock;
