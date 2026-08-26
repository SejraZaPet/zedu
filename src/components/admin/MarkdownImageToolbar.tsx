import { useRef, useState, type RefObject } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Paperclip, Link2, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

const BUCKET = "lesson-images";

interface Props {
  /** Textarea, do které se vkládá markdown na pozici kurzoru. */
  textareaRef: RefObject<HTMLTextAreaElement>;
  value: string;
  onChange: (next: string) => void;
  /** Podsložka v bucketu, např. `academy/{courseId}` nebo `napoveda`. */
  folder: string;
  showPreviewToggle?: boolean;
  previewOn?: boolean;
  onTogglePreview?: () => void;
}

const MarkdownImageToolbar = ({
  textareaRef, value, onChange, folder,
  showPreviewToggle, previewOn, onTogglePreview,
}: Props) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [urlDlg, setUrlDlg] = useState(false);
  const [imgUrl, setImgUrl] = useState("");
  const [imgAlt, setImgAlt] = useState("");

  const insertAtCursor = (snippet: string) => {
    const el = textareaRef.current;
    const pos = el ? el.selectionStart ?? value.length : value.length;
    const before = value.slice(0, pos);
    const after = value.slice(pos);
    const prefix = before && !before.endsWith("\n") ? "\n\n" : "";
    const next = `${before}${prefix}${snippet}\n${after}`;
    onChange(next);
    requestAnimationFrame(() => {
      if (!el) return;
      const caret = before.length + prefix.length + snippet.length + 1;
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Vyberte obrázek"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Maximální velikost je 10 MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${folder}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
    setUploading(false);
    if (error) { toast.error("Nahrání se nepovedlo: " + error.message); return; }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    insertAtCursor(`![${file.name.replace(/\.[^.]+$/, "")}](${data.publicUrl})`);
    toast.success("Obrázek nahrán a vložen");
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mb-2">
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => fileInput.current?.click()}>
        {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Paperclip className="w-4 h-4 mr-1" />}
        Nahrát obrázek
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => setUrlDlg(true)}>
        <Link2 className="w-4 h-4 mr-1" /> Vložit URL obrázku
      </Button>
      {showPreviewToggle && (
        <Button type="button" size="sm" variant="ghost" onClick={onTogglePreview}>
          {previewOn ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
          {previewOn ? "Skrýt náhled" : "Živý náhled"}
        </Button>
      )}

      <Dialog open={urlDlg} onOpenChange={setUrlDlg}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Vložit obrázek z URL</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>URL obrázku</Label>
              <Input value={imgUrl} onChange={(e) => setImgUrl(e.target.value)} placeholder="https://…/screenshot.png" />
            </div>
            <div>
              <Label>Popis (alt text)</Label>
              <Input value={imgAlt} onChange={(e) => setImgAlt(e.target.value)} placeholder="Screenshot obrazovky Třídy" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUrlDlg(false)}>Zrušit</Button>
            <Button
              onClick={() => {
                if (!imgUrl.trim()) { toast.error("Zadejte URL"); return; }
                insertAtCursor(`![${imgAlt.trim() || "obrázek"}](${imgUrl.trim()})`);
                setImgUrl(""); setImgAlt(""); setUrlDlg(false);
              }}
            >
              Vložit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MarkdownImageToolbar;
