import { useState } from "react";
import { Upload, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  label: string;
  value: string;
  onChange: (url: string) => void;
  /** Optional folder prefix inside `lesson-images` bucket (default: "landing"). */
  prefix?: string;
}

/**
 * Simple image URL input + upload button for landing CMS.
 * Uploads to `lesson-images` bucket under `landing/` prefix and returns a public URL.
 */
export function LandingImageInput({ label, value, onChange, prefix = "landing" }: Props) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${prefix}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("lesson-images").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("lesson-images").getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success("Obrázek nahrán");
    } catch (err: any) {
      toast.error("Nahrání selhalo: " + (err?.message || "neznámá chyba"));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2 items-center">
        <Input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://… nebo nechte prázdné pro výchozí"
          className="flex-1"
        />
        <Button size="sm" variant="outline" type="button" className="relative shrink-0" disabled={uploading}>
          <Upload className="w-4 h-4 mr-1" />
          {uploading ? "…" : "Nahrát"}
          <input
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </Button>
        {value && (
          <Button size="sm" variant="ghost" type="button" onClick={() => onChange("")} className="shrink-0">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
      {value && (
        <img src={value} alt="" className="max-h-24 rounded border border-border object-cover" />
      )}
    </div>
  );
}
