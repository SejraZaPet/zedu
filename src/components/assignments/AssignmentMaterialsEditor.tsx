import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import {
  FileIcon, Film, Image as ImageIcon, Link2, Loader2, Music, Paperclip, Plus, Upload, X,
} from "lucide-react";
import {
  AssignmentMaterial,
  MATERIAL_ACCEPT,
  formatBytes,
  mediaKindOf,
  normalizeUrl,
  removeMaterialFile,
  uploadMaterialFile,
  validateMaterialFile,
} from "@/lib/assignment-materials";

interface Props {
  materials: AssignmentMaterial[];
  onChange: (next: AssignmentMaterial[]) => void;
  teacherId: string;
}

const iconFor = (m: AssignmentMaterial) => {
  if (m.kind === "link") return Link2;
  const kind = mediaKindOf(m);
  if (kind === "image") return ImageIcon;
  if (kind === "video") return Film;
  if (kind === "audio") return Music;
  return FileIcon;
};

/** Karta „Materiály k úkolu“ – odkazy a nahrané soubory, které žák uvidí u zadání. */
const AssignmentMaterialsEditor = ({ materials, onChange, teacherId }: Props) => {
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addLink = () => {
    const url = normalizeUrl(linkUrl);
    if (!url) {
      toast({ title: "Chybí adresa odkazu", variant: "destructive" });
      return;
    }
    onChange([
      ...materials,
      { id: crypto.randomUUID(), kind: "link", title: linkTitle.trim() || url, url },
    ]);
    setLinkTitle("");
    setLinkUrl("");
  };

  const handleFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setUploading(true);
    const added: AssignmentMaterial[] = [];
    for (const file of Array.from(list)) {
      const err = validateMaterialFile(file);
      if (err) {
        toast({ title: `Soubor ${file.name} zamítnut`, description: err, variant: "destructive" });
        continue;
      }
      try {
        added.push(await uploadMaterialFile(file, teacherId));
      } catch (e: any) {
        toast({ title: `Nahrání ${file.name} selhalo`, description: e.message, variant: "destructive" });
      }
    }
    setUploading(false);
    if (added.length) {
      onChange([...materials, ...added]);
      toast({ title: added.length === 1 ? "Soubor nahrán" : `Nahráno ${added.length} souborů` });
    }
  };

  const remove = async (m: AssignmentMaterial) => {
    if (m.kind === "file" && m.path) await removeMaterialFile(m.path);
    onChange(materials.filter((x) => x.id !== m.id));
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Paperclip className="w-4 h-4" />
          Materiály k úkolu
          {materials.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">({materials.length})</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Žáci uvidí materiály přímo u zadání. Obrázky, video a zvuk se přehrají v zadání, ostatní se otevřou nebo stáhnou.
        </p>

        {/* Odkazy */}
        <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
          <div>
            <Label htmlFor="material-link-title" className="text-xs">Název odkazu</Label>
            <Input
              id="material-link-title"
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              placeholder="např. Video k tématu"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="material-link-url" className="text-xs">Adresa (URL)</Label>
            <Input
              id="material-link-url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addLink();
                }
              }}
              placeholder="https://…"
              className="mt-1"
            />
          </div>
          <Button type="button" variant="outline" onClick={addLink}>
            <Plus className="w-4 h-4 mr-1" />
            Přidat odkaz
          </Button>
        </div>

        {/* Soubory */}
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3 text-center">
          <p className="text-xs text-muted-foreground mb-2">
            PDF, Word, Excel, PowerPoint, JPG, PNG, MP3 (do 20 MB) · video MP4/MOV (do 100 MB)
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
            Nahrát soubory
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            accept={MATERIAL_ACCEPT}
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {materials.length > 0 && (
          <ul className="space-y-1">
            {materials.map((m) => {
              const Icon = iconFor(m);
              return (
                <li
                  key={m.id}
                  className="flex items-center gap-2 rounded-md border border-border bg-background p-2 text-sm"
                >
                  <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate" title={m.title}>{m.title}</span>
                  {m.kind === "file" && m.size && (
                    <span className="text-xs text-muted-foreground">{formatBytes(m.size)}</span>
                  )}
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-destructive"
                    onClick={() => remove(m)}
                    aria-label={`Odebrat ${m.title}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default AssignmentMaterialsEditor;
