import { useRef, useState, useCallback } from "react";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  ACCEPTED_EXT,
  uploadMedia,
  validateFile,
  type TeacherMediaItem,
} from "@/lib/teacher-media";
import { cn } from "@/lib/utils";

interface Props {
  teacherId: string;
  defaultTags?: string[];
  onUploaded: (item: TeacherMediaItem) => void;
}

export function MediaUploadZone({ teacherId, defaultTags = [], onUploaded }: Props) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [tagInput, setTagInput] = useState(defaultTags.join(", "));

  const parsedTags = tagInput
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setBusy(true);
      let ok = 0;
      let failed = 0;
      for (const file of Array.from(files)) {
        const err = validateFile(file);
        if (err) {
          toast({ title: file.name, description: err, variant: "destructive" });
          failed++;
          continue;
        }
        try {
          const item = await uploadMedia(file, teacherId, parsedTags);
          onUploaded(item);
          ok++;
        } catch (e: any) {
          toast({
            title: `Chyba při nahrávání: ${file.name}`,
            description: e?.message ?? String(e),
            variant: "destructive",
          });
          failed++;
        }
      }
      setBusy(false);
      if (ok > 0)
        toast({ title: `Nahráno ${ok} ${ok === 1 ? "soubor" : "souborů"}.` });
      if (inputRef.current) inputRef.current.value = "";
    },
    [teacherId, parsedTags, onUploaded, toast],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "border-2 border-dashed rounded-xl p-6 text-center transition-colors space-y-3",
        dragOver
          ? "border-primary bg-primary/5"
          : "border-border bg-muted/20 hover:bg-muted/30",
      )}
    >
      <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
      <div>
        <p className="font-medium">Přetáhněte soubory sem</p>
        <p className="text-xs text-muted-foreground mt-1">
          Povolené formáty: {ACCEPTED_EXT.join(", ")} · max 10 MB
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 max-w-md mx-auto">
        <Input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          placeholder="Složky/štítky (oddělené čárkou)"
          className="flex-1 min-w-[180px]"
        />
        <Button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          variant="hero"
          className="gap-2"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          Nahrát soubor
        </Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_EXT.map((e) => "." + e).join(",")}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
