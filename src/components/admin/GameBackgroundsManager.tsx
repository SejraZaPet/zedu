import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Loader2, Upload, X, ImageOff, Trash2, RefreshCw } from "lucide-react";
import { useGameBackgrounds } from "@/hooks/useGameBackgrounds";
import {
  BACKGROUND_CATEGORY_LABEL,
  FIELD_SUGGESTIONS,
  SEASON_KEYS,
  SUBJECT_KEYS,
  backgroundScopeLabel,
  type BackgroundCategory,
} from "@/lib/game-backgrounds";

const slugifyName = (input: string): string =>
  (input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "");

const prettifyName = (fileName: string): string => {
  const dot = fileName.lastIndexOf(".");
  const base = dot >= 0 ? fileName.slice(0, dot) : fileName;
  const cleaned = base.replace(/[_-]+/g, " ").trim();
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : fileName;
};

interface Row {
  id: string;
  fileName: string;
  imageUrl: string | null;
  uploading: boolean;
  error: string | null;
  name: string;
  category: BackgroundCategory;
  subjectKey: string;
  seasonKey: string;
  fieldKey: string;
}

const GameBackgroundsManager = () => {
  const { backgrounds, loading, reload } = useGameBackgrounds(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const grouped = useMemo(() => {
    const map: Record<string, typeof backgrounds> = {};
    backgrounds.forEach((bg) => {
      map[bg.category] = [...(map[bg.category] ?? []), bg];
    });
    return map;
  }, [backgrounds]);

  const uploadOne = async (row: Row, file: File) => {
    try {
      const dot = file.name.lastIndexOf(".");
      const base = dot >= 0 ? file.name.slice(0, dot) : file.name;
      const ext = dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : "png";
      const path = `game-backgrounds/${Date.now()}_${slugifyName(base) || "bg"}.${ext}`;
      const { error } = await supabase.storage
        .from("lesson-images")
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("lesson-images").getPublicUrl(path);
      setRows((s) => s.map((r) => (r.id === row.id ? { ...r, uploading: false, imageUrl: data.publicUrl } : r)));
    } catch (err: any) {
      const message = err?.message ?? String(err);
      setRows((s) => s.map((r) => (r.id === row.id ? { ...r, uploading: false, error: message } : r)));
      toast({
        title: `Nahrání souboru ${row.fileName} selhalo`,
        description: message,
        variant: "destructive",
      });
    }

  };

  const addFiles = (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (arr.length === 0) return;
    const newRows: Row[] = arr.map((f) => ({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${f.name}`,
      fileName: f.name,
      imageUrl: null,
      uploading: true,
      error: null,
      name: prettifyName(f.name),
      category: "universal",
      subjectKey: "",
      seasonKey: "",
      fieldKey: "",
    }));
    setRows((s) => [...s, ...newRows]);
    newRows.forEach((r, i) => uploadOne(r, arr[i]));
  };

  const updateRow = (id: string, patch: Partial<Row>) =>
    setRows((s) => s.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const rowValid = (r: Row) => {
    if (r.uploading || !r.imageUrl || !r.name.trim()) return false;
    if (r.category === "subject") return !!r.subjectKey;
    if (r.category === "season") return !!r.seasonKey;
    if (r.category === "field") return !!r.fieldKey.trim();
    return true;
  };

  const canSave = rows.length > 0 && !saving && rows.every(rowValid);

  const handleSaveAll = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payloads = rows.map((r) => ({
        name: r.name.trim(),
        category: r.category,
        subject_key: r.category === "subject" ? r.subjectKey : null,
        season_key: r.category === "season" ? r.seasonKey : null,
        field_key: r.category === "field" ? slugifyName(r.fieldKey) || r.fieldKey.trim() : null,
        image_url: r.imageUrl,
        is_active: true,
      }));
      const { error } = await supabase.from("game_backgrounds" as any).insert(payloads as any);
      if (error) throw error;
      toast({ title: `Uloženo ${payloads.length} pozadí` });
      setRows([]);
      reload();
    } catch (err: any) {
      toast({ title: "Uložení selhalo", description: err?.message ?? String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id: string, next: boolean) => {
    const { error } = await supabase.from("game_backgrounds" as any).update({ is_active: next } as any).eq("id", id);
    if (error) {
      toast({ title: "Změna selhala", description: error.message, variant: "destructive" });
      return;
    }
    reload();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("game_backgrounds" as any).delete().eq("id", deleteTarget);
    setDeleteTarget(null);
    if (error) {
      toast({ title: "Smazání selhalo", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Pozadí smazáno" });
    reload();
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Herní pozadí</h2>
        <p className="text-sm text-muted-foreground">
          Pozadí pro živé hry a prezentace. Nahrajte více souborů najednou a u každého doplňte název a zařazení.
          Doporučený formát je na šířku (16:9) s tlumeným středem, aby zůstal text čitelný.
        </p>
      </div>

      {/* Hromadné nahrání */}
      <section className="rounded-xl border p-4 space-y-4">
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
          }}
          className={`rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30"
          }`}
          aria-label="Nahrát obrázky pozadí"
        >
          <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium">Přetáhněte obrázky sem nebo klikněte pro výběr</p>
          <p className="text-xs text-muted-foreground">PNG, JPG nebo WEBP – klidně všech 26 najednou</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/webp,image/jpeg"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = e.target.files;
              e.target.value = "";
              if (files) addFiles(files);
            }}
          />
        </div>

        {rows.length > 0 && (
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.id} className="rounded-lg border p-3 grid gap-3 md:grid-cols-[96px_1fr_auto] items-start">
                <div className="w-24 h-14 rounded-md bg-muted overflow-hidden flex items-center justify-center shrink-0">
                  {r.uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  ) : r.imageUrl ? (
                    <img src={r.imageUrl} alt={r.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <ImageOff className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <div>
                    <Label className="text-xs">Název</Label>
                    <Input value={r.name} onChange={(e) => updateRow(r.id, { name: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Kategorie</Label>
                    <Select
                      value={r.category}
                      onValueChange={(v) =>
                        updateRow(r.id, { category: v as BackgroundCategory, subjectKey: "", seasonKey: "", fieldKey: "" })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(BACKGROUND_CATEGORY_LABEL) as BackgroundCategory[]).map((c) => (
                          <SelectItem key={c} value={c}>
                            {BACKGROUND_CATEGORY_LABEL[c]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {r.category === "subject" && (
                    <div className="md:col-span-2">
                      <Label className="text-xs">Předmět</Label>
                      <Select value={r.subjectKey} onValueChange={(v) => updateRow(r.id, { subjectKey: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Vyberte předmět" />
                        </SelectTrigger>
                        <SelectContent>
                          {SUBJECT_KEYS.map((s) => (
                            <SelectItem key={s.key} value={s.key}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {r.category === "season" && (
                    <div className="md:col-span-2">
                      <Label className="text-xs">Roční období</Label>
                      <Select value={r.seasonKey} onValueChange={(v) => updateRow(r.id, { seasonKey: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Vyberte období" />
                        </SelectTrigger>
                        <SelectContent>
                          {SEASON_KEYS.map((s) => (
                            <SelectItem key={s.key} value={s.key}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {r.category === "field" && (
                    <div className="md:col-span-2">
                      <Label className="text-xs">Obor školy</Label>
                      <Input
                        value={r.fieldKey}
                        onChange={(e) => updateRow(r.id, { fieldKey: e.target.value })}
                        placeholder="např. gastronomie"
                        list={`fields-${r.id}`}
                      />
                      <datalist id={`fields-${r.id}`}>
                        {FIELD_SUGGESTIONS.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label}
                          </option>
                        ))}
                      </datalist>
                    </div>
                  )}
                  {r.error && <p className="text-xs text-destructive md:col-span-2">{r.error}</p>}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setRows((s) => s.filter((x) => x.id !== r.id))}
                  aria-label="Odebrat"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRows([])} disabled={saving}>
                Zrušit
              </Button>
              <Button onClick={handleSaveAll} disabled={!canSave}>
                {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Uložit {rows.length} pozadí
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Seznam */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Existující pozadí ({backgrounds.length})</h3>
          <Button variant="outline" size="sm" onClick={reload} disabled={loading} className="gap-1.5">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Obnovit
          </Button>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Načítání…</p>
        ) : backgrounds.length === 0 ? (
          <p className="text-sm text-muted-foreground">Zatím není nahrané žádné pozadí.</p>
        ) : (
          Object.entries(grouped).map(([cat, list]) => (
            <div key={cat} className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                {BACKGROUND_CATEGORY_LABEL[cat as BackgroundCategory] ?? cat}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((bg) => (
                  <div key={bg.id} className="rounded-xl border overflow-hidden">
                    <div className="aspect-video bg-muted">
                      <img src={bg.image_url} alt={bg.name} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                    <div className="p-3 space-y-2">
                      <div>
                        <p className="font-medium truncate">{bg.name}</p>
                        <p className="text-xs text-muted-foreground">{backgroundScopeLabel(bg)}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-xs">
                          <Switch
                            checked={bg.is_active}
                            onCheckedChange={(v) => toggleActive(bg.id, v)}
                            aria-label={`Aktivní: ${bg.name}`}
                          />
                          {bg.is_active ? "Aktivní" : "Skryté"}
                        </label>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(bg.id)}
                          aria-label={`Smazat ${bg.name}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smazat pozadí?</AlertDialogTitle>
            <AlertDialogDescription>
              Pozadí se odstraní ze seznamu. Hry, které ho mají nastavené, se vrátí k univerzálnímu vzhledu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Smazat</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GameBackgroundsManager;
