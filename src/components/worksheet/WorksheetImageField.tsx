import { useRef, useState } from "react";
import { FolderOpen, ImagePlus, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MediaPickerDialog } from "@/components/media/MediaPickerDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { isSignedTeacherMediaUrl } from "@/lib/slide-image-persist";
import { persistWorksheetImageUrl, uploadWorksheetImage } from "@/lib/worksheet-images";

interface Props {
  label?: string;
  url?: string;
  alt?: string;
  onChange: (patch: { url?: string; alt?: string }) => void;
}

/**
 * Výběr obrázku pro položku pracovního listu — stejný mechanismus jako editor
 * prezentací: nahrání z počítače, přetažení, vložení ze schránky, knihovna médií
 * a vyhledání fotek. Vždy ukládá trvalou veřejnou adresu.
 */
export default function WorksheetImageField({ label = "Obrázek", url, alt, onChange }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fail = (e: any) =>
    toast({
      title: "Obrázek se nepodařilo vložit",
      description: e?.message || "Zkuste to prosím znovu.",
      variant: "destructive",
    });

  const handleFile = async (file: File | null | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      onChange({ url: await uploadWorksheetImage(file, user?.id) });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const handlePicked = async (pickedUrl: string, item: any) => {
    setBusy(true);
    try {
      onChange({ url: await persistWorksheetImageUrl(pickedUrl, item?.storage_path ? item : undefined, user?.id) });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const expiring = !!url && isSignedTeacherMediaUrl(url);

  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <div
        tabIndex={0}
        role="group"
        aria-label={`${label}: přetáhněte nebo vložte obrázek (Ctrl+V)`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFile(e.dataTransfer.files?.[0]);
        }}
        onPaste={(e) => {
          const file = Array.from(e.clipboardData.files ?? []).find((f) => f.type.startsWith("image/"));
          if (file) { e.preventDefault(); void handleFile(file); }
        }}
        className={`rounded-lg border-2 border-dashed p-3 text-center outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          dragOver ? "border-primary bg-primary/10" : "border-border bg-muted/20"
        }`}
      >
        {url ? (
          <img src={url} alt={alt || ""} className="mx-auto max-h-40 rounded border border-border object-contain" />
        ) : (
          <p className="text-xs text-muted-foreground">
            Přetáhněte sem obrázek nebo klikněte a vložte ho ze schránky (Ctrl+V).
          </p>
        )}
        {busy && (
          <p className="mt-2 flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Nahrávám…
          </p>
        )}
      </div>

      {expiring && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
          <div className="flex-1">
            Tento obrázek má dočasný odkaz z knihovny a žáci ho neuvidí.
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="ml-2 h-6 px-2 text-xs"
              disabled={busy}
              onClick={() => url && handlePicked(url, undefined)}
            >
              Převést na trvalý
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ""; }}
        />
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
          <ImagePlus className="mr-1 h-4 w-4" /> Nahrát z počítače
        </Button>
        <MediaPickerDialog
          imageOnly
          onPick={(u, item) => void handlePicked(u, item)}
          onPickPhotoMeta={({ alt: a }) => { if (a && !alt) onChange({ alt: a }); }}
          trigger={
            <Button type="button" size="sm" variant="outline" disabled={busy}>
              <FolderOpen className="mr-1 h-4 w-4" /> Knihovna / fotky
            </Button>
          }
        />
        {url && (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange({ url: "", alt: "" })}>
            <Trash2 className="mr-1 h-4 w-4" /> Odebrat
          </Button>
        )}
      </div>

      <Input
        value={url ?? ""}
        onChange={(e) => onChange({ url: e.target.value })}
        placeholder="nebo vložte adresu https://…"
        className="text-xs"
      />
      {url && (
        <Input
          value={alt ?? ""}
          onChange={(e) => onChange({ alt: e.target.value })}
          placeholder="Popisek obrázku pro čtečky (alt)"
        />
      )}
    </div>
  );
}
