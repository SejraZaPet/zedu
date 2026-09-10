import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, Upload, X, ImageOff } from "lucide-react";
import { CLOTHING_SLOTS, SLOT_LABEL, type LayerSlot } from "@/lib/avatar-slots";

const slugifyName = (input: string): string =>
  (input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "");

type Category =
  | "base"
  | "skin_tone"
  | "hairstyle"
  | "hair_color"
  | "eyes"
  | "eyebrow"
  | "mouth"
  | "outfit"
  | "face_accessory"
  | "head_accessory"
  | "background"
  | "frame"
  | "badge";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "hairstyle", label: "Účes" },
  { value: "eyes", label: "Oči" },
  { value: "eyebrow", label: "Obočí" },
  { value: "mouth", label: "Ústa" },
  { value: "outfit", label: "Oblečení" },
  { value: "face_accessory", label: "Doplněk obličej" },
  { value: "head_accessory", label: "Doplněk hlava" },
  { value: "background", label: "Pozadí" },
  { value: "frame", label: "Rámeček" },
  { value: "badge", label: "Odznak" },
  { value: "base", label: "Postava (base)" },
];

/** Keyword → clothing slot guess, so a batch of files lands in the right slot. */
const SLOT_KEYWORDS: { slot: LayerSlot; words: string[] }[] = [
  {
    slot: "clothing_head",
    words: ["celenka", "cepice", "kulich", "klobouk", "cap", "snap", "kseltovka", "ksiltovka", "beanie", "hat"],
  },
  {
    slot: "clothing_shoes",
    words: ["boty", "bota", "tenisky", "kopacky", "lakyrky", "pantofle", "papuce", "shoes", "sneakers", "obuv"],
  },
  { slot: "clothing_face", words: ["bryle", "glasses"] },
  { slot: "clothing_neck", words: ["sala", "kravata", "salu", "scarf"] },
  { slot: "clothing_hands", words: ["rukavice", "hodinky"] },
  { slot: "clothing_bag", words: ["taska", "batoh", "bag"] },
  { slot: "clothing_bottom", words: ["kalhoty", "sukne", "kratasy", "teplaky"] },
  { slot: "clothing_full", words: ["outfit", "overal", "saty"] },
];

const guessSlot = (baseName: string): LayerSlot => {
  const key = slugifyName(baseName);
  for (const { slot, words } of SLOT_KEYWORDS) {
    if (words.some((w) => key.includes(w))) return slot;
  }
  return "clothing_top";
};

interface Row {
  id: string;
  fileName: string;
  imageUrl: string | null;
  thumbUrl: string | null;
  uploading: boolean;
  uploadingThumb: boolean;
  error: string | null;
  name: string;
  category: Category;
  slot: LayerSlot | null;
}

const prettifyName = (fileName: string): string => {
  const dot = fileName.lastIndexOf(".");
  const base = dot >= 0 ? fileName.slice(0, dot) : fileName;
  const cleaned = base.replace(/[_-]+/g, " ").trim();
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : fileName;
};

const stripExt = (fileName: string): string => {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(0, dot) : fileName;
};

/** `boty_1.png` / `boty_2.png` → group key `boty`, index 1 / 2. */
const parsePair = (fileName: string): { key: string; index: 1 | 2 | null } => {
  const base = stripExt(fileName);
  const m = base.match(/^(.*?)[ _-]?([12])$/);
  if (m && m[1].trim().length > 0) {
    return { key: slugifyName(m[1]), index: Number(m[2]) as 1 | 2 };
  }
  return { key: slugifyName(base), index: null };
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export default function BulkUploadDialog({ open, onOpenChange, onCreated }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setRows([]);
    setSaving(false);
    setDragOver(false);
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const uploadFile = async (file: File): Promise<string> => {
    const dot = file.name.lastIndexOf(".");
    const base = dot >= 0 ? file.name.slice(0, dot) : file.name;
    const ext = dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : "png";
    const rand = Math.random().toString(36).slice(2, 7);
    const path = `${Date.now()}_${rand}_${slugifyName(base) || "file"}.${ext}`;
    const { error } = await supabase.storage
      .from("avatar-assets")
      .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
    if (error) throw error;
    const { data } = supabase.storage.from("avatar-assets").getPublicUrl(path);
    return data.publicUrl;
  };

  const uploadRow = async (rowId: string, layered: File, thumb: File | null) => {
    try {
      const url = await uploadFile(layered);
      setRows((s) => s.map((r) => (r.id === rowId ? { ...r, uploading: false, imageUrl: url } : r)));
    } catch (err: any) {
      setRows((s) =>
        s.map((r) =>
          r.id === rowId ? { ...r, uploading: false, error: err?.message ?? String(err) } : r,
        ),
      );
    }
    if (!thumb) return;
    try {
      const url = await uploadFile(thumb);
      setRows((s) =>
        s.map((r) => (r.id === rowId ? { ...r, uploadingThumb: false, thumbUrl: url } : r)),
      );
    } catch (err: any) {
      setRows((s) =>
        s.map((r) =>
          r.id === rowId
            ? { ...r, uploadingThumb: false, error: r.error ?? (err?.message ?? String(err)) }
            : r,
        ),
      );
    }
  };

  const addFiles = (fileList: FileList | File[]) => {
    // NOTE: copy the FileList into a real array immediately — a live `input.files`
    // reference is emptied as soon as the input's value is reset.
    const arr = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (arr.length === 0) return;

    // Group `<name>_1` (catalog thumbnail) with `<name>_2` (layered image).
    const groups = new Map<string, { thumb: File | null; layered: File | null; label: string }>();
    const order: string[] = [];
    for (const f of arr) {
      const { key, index } = parsePair(f.name);
      const groupKey = index ? key : `${key}__single_${order.length}`;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, { thumb: null, layered: null, label: index ? key : stripExt(f.name) });
        order.push(groupKey);
      }
      const g = groups.get(groupKey)!;
      if (index === 1) g.thumb = f;
      else if (index === 2) g.layered = f;
      else g.layered = f;
    }

    const pending: { row: Row; layered: File; thumb: File | null }[] = [];
    for (const groupKey of order) {
      const g = groups.get(groupKey)!;
      // Only a `_1` file present → treat it as the layered image.
      const layered = g.layered ?? g.thumb!;
      const thumb = g.layered ? g.thumb : null;
      const label = g.label;
      const slot = guessSlot(label);
      const row: Row = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${groupKey}`,
        fileName: thumb ? `${layered.name} + ${thumb.name}` : layered.name,
        imageUrl: null,
        thumbUrl: null,
        uploading: true,
        uploadingThumb: !!thumb,
        error: null,
        name: prettifyName(label),
        category: "outfit",
        slot,
      };
      pending.push({ row, layered, thumb });
    }

    setRows((s) => [...s, ...pending.map((p) => p.row)]);
    pending.forEach((p) => uploadRow(p.row.id, p.layered, p.thumb));
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = "";
    if (picked.length) addFiles(picked);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(Array.from(e.dataTransfer.files));
  };

  const removeRow = (id: string) => {
    setRows((s) => s.filter((r) => r.id !== id));
  };

  const updateRow = (id: string, patch: Partial<Row>) => {
    setRows((s) => s.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const canSave =
    rows.length > 0 &&
    !saving &&
    rows.every((r) => !r.uploading && !r.uploadingThumb && r.imageUrl && r.name.trim().length > 0);

  const handleSaveAll = async () => {
    if (!canSave) return;
    setSaving(true);
    const usedSlugs = new Set<string>();
    const payloads = rows.map((r) => {
      const slug = slugifyName(r.name) || `item_${Math.random().toString(36).slice(2, 8)}`;
      let final = slug;
      let n = 2;
      while (usedSlugs.has(final)) final = `${slug}_${n++}`;
      usedSlugs.add(final);
      return {
        slug: final,
        name: r.name.trim(),
        category: r.category,
        rarity: "common",
        image_url: r.imageUrl,
        thumbnail_url: r.thumbUrl,
        recommended_for_role: "both",
        unlock_type: "default",
        is_default: false,
        is_active: true,
        sort_order: 0,
        layer_offset_x: 0,
        layer_offset_y: 0,
        layer_scale: 1,
        layer_slot: r.category === "outfit" ? r.slot : null,
      };
    });

    const { error } = await supabase.from("avatar_items").insert(payloads as any);
    setSaving(false);
    if (error) {
      toast({
        title: "Hromadné uložení selhalo",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: `Vytvořeno ${payloads.length} položek` });
    onCreated();
    handleClose(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Hromadné nahrání položek</DialogTitle>
        </DialogHeader>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-border"
          }`}
        >
          <p className="text-sm text-muted-foreground mb-3">
            Přetáhněte obrázky sem, nebo vyberte soubory. Dvojice souborů <strong>nazev_1</strong>{" "}
            (náhled do výběru) a <strong>nazev_2</strong> (obrázek vrstvený na avatara) se spojí do
            jedné položky. Kalibrace (offset/scale) se doladí později u konkrétní položky.
          </p>
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-1" /> Vybrat soubory
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/webp,image/jpeg"
            multiple
            className="hidden"
            onChange={handleFileInput}
          />
        </div>

        {rows.length > 0 && (
          <div className="space-y-2">
            {rows.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 border rounded-md p-2 bg-card"
              >
                <div className="w-14 h-14 shrink-0 rounded bg-muted flex items-center justify-center overflow-hidden">
                  {r.uploading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  ) : r.imageUrl ? (
                    <img
                      src={r.imageUrl}
                      alt={r.name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <ImageOff className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="w-14 h-14 shrink-0 rounded bg-muted/60 flex items-center justify-center overflow-hidden text-[10px] text-muted-foreground">
                  {r.uploadingThumb ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : r.thumbUrl ? (
                    <img src={r.thumbUrl} alt={`Náhled ${r.name}`} className="w-full h-full object-contain" />
                  ) : (
                    <span>bez náhledu</span>
                  )}
                </div>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_180px_180px] gap-2">
                  <div>
                    <Label className="text-xs">Název</Label>
                    <Input
                      value={r.name}
                      onChange={(e) => updateRow(r.id, { name: e.target.value })}
                      placeholder="Název položky"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1 truncate">{r.fileName}</p>
                    {r.error && (
                      <p className="text-xs text-destructive mt-1">Nahrání selhalo: {r.error}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs">Kategorie</Label>
                    <Select
                      value={r.category}
                      onValueChange={(v) =>
                        updateRow(r.id, {
                          category: v as Category,
                          slot: v === "outfit" ? r.slot ?? "clothing_top" : null,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {r.category === "outfit" ? (
                    <div>
                      <Label className="text-xs">Slot</Label>
                      <Select
                        value={r.slot ?? "clothing_top"}
                        onValueChange={(v) => updateRow(r.id, { slot: v as LayerSlot })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CLOTHING_SLOTS.map((s) => (
                            <SelectItem key={s} value={s}>
                              {SLOT_LABEL[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div />
                  )}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRow(r.id)}
                  className="shrink-0"
                  aria-label="Odebrat z dávky"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={saving}>
            Zrušit
          </Button>
          <Button onClick={handleSaveAll} disabled={!canSave}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
            Uložit vše ({rows.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
