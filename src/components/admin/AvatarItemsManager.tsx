import { useEffect, useMemo, useRef, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Loader2, Pencil, Plus, Trash2, ImageOff } from "lucide-react";
import AvatarLayerStack, { type StackLayer } from "@/components/avatar/AvatarLayerStack";

type Category =
  | "base"
  | "skin_tone"
  | "hairstyle"
  | "hair_color"
  | "outfit"
  | "face_accessory"
  | "head_accessory"
  | "background"
  | "frame"
  | "effect"
  | "badge"
  | "title";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "base", label: "Postava (base)" },
  { value: "skin_tone", label: "Barva pleti (skin_tone)" },
  { value: "hairstyle", label: "Účes (hairstyle)" },
  { value: "hair_color", label: "Barva vlasů (hair_color)" },
  { value: "outfit", label: "Oblečení (outfit)" },
  { value: "face_accessory", label: "Doplněk obličej" },
  { value: "head_accessory", label: "Doplněk hlava" },
  { value: "background", label: "Pozadí" },
  { value: "frame", label: "Rámeček" },
  { value: "effect", label: "Efekt" },
  { value: "badge", label: "Odznak" },
  { value: "title", label: "Titul" },
];

const RARITIES = ["common", "uncommon", "rare", "epic", "legendary", "mythic"] as const;
const ROLES = ["student", "teacher", "both"] as const;
const UNLOCK_TYPES = [
  "default",
  "level",
  "xp_total",
  "streak",
  "badge",
  "lessons_count",
  "practices_count",
  "teacher_reward",
  "admin_reward",
] as const;

type AvatarItem = {
  id: string;
  slug: string;
  name: string;
  category: Category;
  rarity: string;
  image_url: string | null;
  image_url_back: string | null;
  color_value: string | null;
  recommended_for_role: string;
  unlock_type: string;
  unlock_value: string | null;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  layer_offset_x: number;
  layer_offset_y: number;
  layer_scale: number;
  updated_at?: string;
};

type CalibrationValues = {
  layer_offset_x: number;
  layer_offset_y: number;
  layer_scale: number;
};

const calibrationKeys = ["layer_offset_x", "layer_offset_y", "layer_scale"] as const;

const toFiniteNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const readCalibrationValues = (item: Partial<AvatarItem> | null | undefined): CalibrationValues => ({
  layer_offset_x: toFiniteNumber(item?.layer_offset_x, 0),
  layer_offset_y: toFiniteNumber(item?.layer_offset_y, 0),
  layer_scale: toFiniteNumber(item?.layer_scale, 1),
});

const calibrationMatches = (actual: Partial<CalibrationValues>, expected: CalibrationValues) =>
  calibrationKeys.every((key) => Math.abs(toFiniteNumber(actual[key], NaN) - expected[key]) < 0.000001);

const emptyForm = (): Partial<AvatarItem> => ({
  slug: "",
  name: "",
  category: "base",
  rarity: "common",
  image_url: "",
  image_url_back: "",
  color_value: "",
  recommended_for_role: "both",
  unlock_type: "default",
  unlock_value: "",
  is_default: false,
  is_active: true,
  sort_order: 0,
  layer_offset_x: 0,
  layer_offset_y: 0,
  layer_scale: 1,
});

type HairVariant = {
  id: string;
  avatar_item_id: string;
  base_id: string;
  image_url: string | null;
  image_url_back: string | null;
  layer_offset_x: number;
  layer_offset_y: number;
  layer_scale: number;
  updated_at?: string | null;
};

export default function AvatarItemsManager() {
  const [items, setItems] = useState<AvatarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [editing, setEditing] = useState<Partial<AvatarItem> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AvatarItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [previewBaseSlug, setPreviewBaseSlug] = useState<string>("base_01");
  const calibrationDraftRef = useRef<CalibrationValues>(readCalibrationValues(null));
  const [variants, setVariants] = useState<Record<string, HairVariant>>({});
  const [variantValues, setVariantValues] = useState<CalibrationValues>({
    layer_offset_x: 0,
    layer_offset_y: 0,
    layer_scale: 1,
  });
  const variantDraftRef = useRef<CalibrationValues>({
    layer_offset_x: 0,
    layer_offset_y: 0,
    layer_scale: 1,
  });

  const bases = useMemo(() => items.filter((i) => i.category === "base" && i.image_url), [items]);
  const previewBase = useMemo(
    () => bases.find((b) => b.slug === previewBaseSlug) ?? bases[0],
    [bases, previewBaseSlug],
  );

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("avatar_items")
      .select("*")
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true });
    if (error) {
      toast({ title: "Chyba při načítání", description: error.message, variant: "destructive" });
    } else {
      setItems((data ?? []) as AvatarItem[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    calibrationDraftRef.current = readCalibrationValues(editing);
  }, [editing?.id, editing?.slug, editing?.layer_offset_x, editing?.layer_offset_y, editing?.layer_scale]);

  // Load per-base variants for hairstyle items
  useEffect(() => {
    let cancelled = false;
    if (editing?.id && editing.category === "hairstyle") {
      supabase
        .from("avatar_item_base_variants")
        .select("*")
        .eq("avatar_item_id", editing.id)
        .then(({ data, error }: any) => {
          if (cancelled) return;
          if (error) {
            setVariants({});
            return;
          }
          const map: Record<string, HairVariant> = {};
          (data ?? []).forEach((v: any) => {
            map[v.base_id] = v as HairVariant;
          });
          setVariants(map);
          // Auto-select the base of the most-recently-updated existing variant
          const list = (data ?? []) as HairVariant[];
          if (list.length > 0) {
            const newest = [...list].sort((a, b) => {
              const ta = a.updated_at ? Date.parse(a.updated_at) : 0;
              const tb = b.updated_at ? Date.parse(b.updated_at) : 0;
              return tb - ta;
            })[0];
            const baseItem = items.find((i) => i.id === newest.base_id);
            if (baseItem?.slug) setPreviewBaseSlug(baseItem.slug);
          } else {
            setPreviewBaseSlug("base_01");
          }
        });
    } else {
      setVariants({});
    }
    return () => {
      cancelled = true;
    };
  }, [editing?.id, editing?.category]);

  const openEditor = (item: Partial<AvatarItem>) => {
    calibrationDraftRef.current = readCalibrationValues(item);
    setEditing(item);
  };

  const filtered =
    filterCategory === "all" ? items : items.filter((i) => i.category === filterCategory);

  const toggleActive = async (item: AvatarItem, next: boolean) => {
    const prev = item.is_active;
    setItems((s) => s.map((i) => (i.id === item.id ? { ...i, is_active: next } : i)));
    const { error } = await supabase
      .from("avatar_items")
      .update({ is_active: next })
      .eq("id", item.id);
    if (error) {
      setItems((s) => s.map((i) => (i.id === item.id ? { ...i, is_active: prev } : i)));
      toast({ title: "Nepodařilo se aktualizovat", description: error.message, variant: "destructive" });
    }
  };

  const handleSave = async () => {
    if (!editing) return;
    const slug = (editing.slug ?? "").trim();
    const name = (editing.name ?? "").trim();
    if (!slug) {
      toast({ title: "Slug je povinný", variant: "destructive" });
      return;
    }
    if (!/^[a-z0-9_\-]+$/.test(slug)) {
      toast({ title: "Slug může obsahovat jen a-z, 0-9, _ a -", variant: "destructive" });
      return;
    }
    if (!name) {
      toast({ title: "Název je povinný", variant: "destructive" });
      return;
    }
    if (!CATEGORIES.some((c) => c.value === editing.category)) {
      toast({ title: "Neplatná kategorie", variant: "destructive" });
      return;
    }

    setSaving(true);
    const payload = {
      slug,
      name,
      category: editing.category as Category,
      rarity: editing.rarity ?? "common",
      image_url: (editing.image_url ?? "") || null,
      image_url_back: (editing.image_url_back ?? "") || null,
      color_value: (editing.color_value ?? "") || null,
      recommended_for_role: editing.recommended_for_role ?? "both",
      unlock_type: editing.unlock_type ?? "default",
      unlock_value: (editing.unlock_value ?? "") || null,
      is_default: !!editing.is_default,
      is_active: editing.is_active ?? true,
      sort_order: Number(editing.sort_order ?? 0),
      layer_offset_x: Number(editing.layer_offset_x ?? 0),
      layer_offset_y: Number(editing.layer_offset_y ?? 0),
      layer_scale: Number(editing.layer_scale ?? 1),
    };

    const { error } = editing.id
      ? await supabase.from("avatar_items").update(payload).eq("id", editing.id)
      : await supabase.from("avatar_items").insert(payload);
    setSaving(false);

    if (error) {
      const dup = error.code === "23505" || error.message?.toLowerCase().includes("duplicate");
      toast({
        title: dup ? "Slug již existuje" : "Uložení selhalo",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: editing.id ? "Uloženo" : "Vytvořeno" });
    setEditing(null);
    load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("avatar_items").delete().eq("id", deleteTarget.id);
    if (error) {
      toast({
        title: "Smazání selhalo",
        description: error.message.includes("foreign")
          ? "Položka je použita v profilu některého uživatele. Nejprve ji z profilů odeberte."
          : error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Smazáno" });
      load();
    }
    setDeleteTarget(null);
  };

  const cat = editing?.category as Category | undefined;
  const showBack = cat === "hairstyle";
  const showColor = cat === "hair_color" || cat === "skin_tone";
  const CALIB_CATEGORIES: Category[] = [
    "hairstyle",
    "outfit",
    "face_accessory",
    "head_accessory",
    "frame",
    "effect",
  ];
  const base01 = useMemo(() => bases.find((b) => b.slug === "base_01"), [bases]);
  const isCalibratingBase = cat === "base";
  const showBase01Ghost =
    isCalibratingBase && !!base01?.image_url && editing?.slug !== "base_01";
  const showCalibration =
    !!cat && CALIB_CATEGORIES.includes(cat) && !!(editing?.image_url ?? "").trim();

  // Per-base variant handling (hairstyle only)
  const activeVariant: HairVariant | null =
    cat === "hairstyle" && previewBase ? variants[previewBase.id] ?? null : null;
  const isVariantMode = !!activeVariant;

  useEffect(() => {
    if (activeVariant) {
      const v = readCalibrationValues(activeVariant);
      variantDraftRef.current = v;
      setVariantValues(v);
    } else {
      const zero = { layer_offset_x: 0, layer_offset_y: 0, layer_scale: 1 };
      variantDraftRef.current = zero;
      setVariantValues(zero);
    }
  }, [activeVariant?.id]);

  const saveCalibration = async () => {
    const expected = calibrationDraftRef.current;
    if (!editing?.id || !editing.slug) {
      toast({ title: "Nejprve položku uložte", variant: "destructive" });
      return;
    }
    if (editing.slug === "base_01") {
      toast({
        title: "base_01 je referenční a nelze kalibrovat",
        variant: "destructive",
      });
      return;
    }
    const targetId = editing.id;
    const targetSlug = editing.slug;
    if (!calibrationMatches(expected, expected)) {
      toast({ title: "Neplatné hodnoty kalibrace", variant: "destructive" });
      return;
    }
    const updatedAt = new Date().toISOString();
    setCalibrating(true);
    const { data, error } = await supabase
      .from("avatar_items")
      .update({
        ...expected,
        updated_at: updatedAt,
      })
      .eq("id", targetId)
      .eq("slug", targetSlug)
      .select("id, slug, layer_offset_x, layer_offset_y, layer_scale, updated_at")
      .maybeSingle();
    if (error) {
      setCalibrating(false);
      toast({
        title: "Uložení kalibrace selhalo",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    if (!data) {
      setCalibrating(false);
      toast({
        title: "Kalibrace nebyla uložena",
        description:
          "Databáze neaktualizovala žádný řádek. Pravděpodobně chybí oprávnění (RLS) nebo se položka mezitím změnila. Obnovte stránku a zkuste znovu.",
        variant: "destructive",
      });
      return;
    }
    if (!calibrationMatches(data, expected)) {
      setCalibrating(false);
      toast({
        title: "Kalibrace nebyla potvrzena",
        description: `Odesláno ${expected.layer_offset_x} / ${expected.layer_offset_y} / ${expected.layer_scale}, server vrátil ${data.layer_offset_x} / ${data.layer_offset_y} / ${data.layer_scale}.`,
        variant: "destructive",
      });
      return;
    }

    const { data: verifyData, error: verifyError } = await supabase
      .from("avatar_items")
      .select("id, slug, layer_offset_x, layer_offset_y, layer_scale, updated_at")
      .eq("id", targetId)
      .eq("slug", targetSlug)
      .maybeSingle();
    setCalibrating(false);
    if (verifyError || !verifyData || !calibrationMatches(verifyData, expected)) {
      toast({
        title: "Kalibrace nebyla potvrzena v databázi",
        description: verifyError?.message ?? "Kontrolní SELECT po uložení nevrátil stejné hodnoty, proto nezobrazuji falešný úspěch.",
        variant: "destructive",
      });
      return;
    }
    const persistedPatch = verifyData as Partial<AvatarItem>;
    setItems((current) => current.map((item) => (item.id === targetId ? { ...item, ...persistedPatch } : item)));
    setEditing((current) => (current?.id === targetId ? { ...current, ...persistedPatch } : current));
    toast({ title: "Kalibrace uložena" });
  };


  const updateCalibrationValue = (key: keyof CalibrationValues, value: number) => {
    if (!Number.isFinite(value)) return;
    calibrationDraftRef.current = {
      ...calibrationDraftRef.current,
      [key]: value,
    };
    setEditing((current) => (current ? { ...current, [key]: value } : current));
  };

  const updateVariantValue = (key: keyof CalibrationValues, value: number) => {
    if (!Number.isFinite(value)) return;
    variantDraftRef.current = { ...variantDraftRef.current, [key]: value };
    setVariantValues((prev) => ({ ...prev, [key]: value }));
  };

  const updateCurrentValue = (key: keyof CalibrationValues, value: number) => {
    if (isVariantMode) updateVariantValue(key, value);
    else updateCalibrationValue(key, value);
  };

  const saveVariantCalibration = async () => {
    if (!activeVariant) return;
    const expected = variantDraftRef.current;
    if (!calibrationMatches(expected, expected)) {
      toast({ title: "Neplatné hodnoty kalibrace", variant: "destructive" });
      return;
    }
    const variantId = activeVariant.id;
    setCalibrating(true);
    const { data, error } = await supabase
      .from("avatar_item_base_variants")
      .update({ ...expected, updated_at: new Date().toISOString() })
      .eq("id", variantId)
      .select("id, base_id, avatar_item_id, image_url, image_url_back, layer_offset_x, layer_offset_y, layer_scale")
      .maybeSingle();
    if (error) {
      setCalibrating(false);
      toast({ title: "Uložení varianty selhalo", description: error.message, variant: "destructive" });
      return;
    }
    if (!data) {
      setCalibrating(false);
      toast({
        title: "Varianta nebyla uložena",
        description: "Databáze neaktualizovala žádný řádek (RLS?). Obnovte stránku a zkuste znovu.",
        variant: "destructive",
      });
      return;
    }
    if (!calibrationMatches(data, expected)) {
      setCalibrating(false);
      toast({
        title: "Kalibrace varianty nebyla potvrzena",
        description: `Odesláno ${expected.layer_offset_x} / ${expected.layer_offset_y} / ${expected.layer_scale}, server vrátil ${data.layer_offset_x} / ${data.layer_offset_y} / ${data.layer_scale}.`,
        variant: "destructive",
      });
      return;
    }
    const { data: verifyData, error: verifyError } = await supabase
      .from("avatar_item_base_variants")
      .select("id, base_id, avatar_item_id, image_url, image_url_back, layer_offset_x, layer_offset_y, layer_scale")
      .eq("id", variantId)
      .maybeSingle();
    setCalibrating(false);
    if (verifyError || !verifyData || !calibrationMatches(verifyData, expected)) {
      toast({
        title: "Varianta nebyla potvrzena v databázi",
        description: verifyError?.message ?? "Kontrolní SELECT nevrátil shodné hodnoty.",
        variant: "destructive",
      });
      return;
    }
    const persisted = verifyData as HairVariant;
    setVariants((prev) => ({ ...prev, [persisted.base_id]: persisted }));
    toast({ title: "Kalibrace varianty uložena" });
  };


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="text-sm">Kategorie:</Label>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[220px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground ml-2">{filtered.length} položek</span>
        </div>
        <Button onClick={() => openEditor(emptyForm())} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Nová položka
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Načítám...
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-2 w-16">Náhled</th>
                <th className="p-2">Slug / Název</th>
                <th className="p-2">Kategorie</th>
                <th className="p-2">Rarita</th>
                <th className="p-2">Odemknutí</th>
                <th className="p-2 w-20 text-center">Pořadí</th>
                <th className="p-2 w-24 text-center">Aktivní</th>
                <th className="p-2 w-24 text-right">Akce</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-t hover:bg-muted/30">
                  <td className="p-2">
                    <div
                      className="w-10 h-10 rounded flex items-center justify-center overflow-hidden border"
                      style={{
                        backgroundColor: item.color_value || "hsl(var(--muted))",
                      }}
                    >
                      {item.image_url ? (
                        <img src={item.image_url} alt="" className="w-full h-full object-contain" />
                      ) : !item.color_value ? (
                        <ImageOff className="w-4 h-4 text-muted-foreground" />
                      ) : null}
                    </div>
                  </td>
                  <td className="p-2">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{item.slug}</div>
                  </td>
                  <td className="p-2">{item.category}</td>
                  <td className="p-2">{item.rarity}</td>
                  <td className="p-2">
                    <span className="text-xs">
                      {item.unlock_type}
                      {item.unlock_value ? ` · ${item.unlock_value}` : ""}
                    </span>
                  </td>
                  <td className="p-2 text-center">{item.sort_order}</td>
                  <td className="p-2 text-center">
                    <Switch
                      checked={item.is_active}
                      onCheckedChange={(v) => toggleActive(item, v)}
                    />
                  </td>
                  <td className="p-2 text-right">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => openEditor(item)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteTarget(item)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    Žádné položky
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Upravit položku" : "Nová položka"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-1">
                <Label>Slug *</Label>
                <Input
                  value={editing.slug ?? ""}
                  onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                  placeholder="unique-slug"
                />
              </div>
              <div className="col-span-1">
                <Label>Název *</Label>
                <Input
                  value={editing.name ?? ""}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </div>

              <div>
                <Label>Kategorie *</Label>
                <Select
                  value={editing.category as string}
                  onValueChange={(v) => setEditing({ ...editing, category: v as Category })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Rarita</Label>
                <Select
                  value={editing.rarity ?? "common"}
                  onValueChange={(v) => setEditing({ ...editing, rarity: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RARITIES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2">
                <Label>Image URL</Label>
                <Input
                  value={editing.image_url ?? ""}
                  onChange={(e) => setEditing({ ...editing, image_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              {showBack && (
                <div className="col-span-2">
                  <Label>Image URL – zadní vrstva (hair_back)</Label>
                  <Input
                    value={editing.image_url_back ?? ""}
                    onChange={(e) => setEditing({ ...editing, image_url_back: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              )}

              {showColor && (
                <div className="col-span-2">
                  <Label>Barva (color_value)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      className="w-16 p-1"
                      value={editing.color_value || "#000000"}
                      onChange={(e) => setEditing({ ...editing, color_value: e.target.value })}
                    />
                    <Input
                      value={editing.color_value ?? ""}
                      onChange={(e) => setEditing({ ...editing, color_value: e.target.value })}
                      placeholder="#RRGGBB"
                    />
                  </div>
                </div>
              )}

              <div>
                <Label>Doporučeno pro roli</Label>
                <Select
                  value={editing.recommended_for_role ?? "both"}
                  onValueChange={(v) => setEditing({ ...editing, recommended_for_role: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Typ odemknutí</Label>
                <Select
                  value={editing.unlock_type ?? "default"}
                  onValueChange={(v) => setEditing({ ...editing, unlock_type: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNLOCK_TYPES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2">
                <Label>Hodnota odemknutí (unlock_value)</Label>
                <Input
                  value={editing.unlock_value ?? ""}
                  onChange={(e) => setEditing({ ...editing, unlock_value: e.target.value })}
                  placeholder="např. 5 (level), 1000 (xp), slug odznaku..."
                />
              </div>

              <div>
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={editing.sort_order ?? 0}
                  onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })}
                />
              </div>
              {showCalibration ? (
                <div className="col-span-2 space-y-3 rounded-lg border p-3 bg-muted/20">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Label className="text-sm font-semibold">Kalibrace vrstvy</Label>
                    {bases.length > 0 && !isCalibratingBase && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">Base:</Label>
                        <Select value={previewBaseSlug} onValueChange={setPreviewBaseSlug}>
                          <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(() => {
                              const isHair = editing?.category === "hairstyle";
                              const variantBases = isHair
                                ? bases.filter((b) => variants[b.id])
                                : [];
                              const hasAnyVariant = variantBases.length > 0;
                              let list: typeof bases;
                              if (!isHair) {
                                list = bases;
                              } else if (hasAnyVariant) {
                                list = [
                                  ...variantBases,
                                  ...(variantBases.some((b) => b.slug === "base_01")
                                    ? []
                                    : bases.filter((b) => b.slug === "base_01")),
                                ];
                              } else {
                                list = bases.filter((b) => b.slug === "base_01");
                              }
                              return list.map((b) => (
                                <SelectItem key={b.id} value={b.slug}>{b.slug}</SelectItem>
                              ));
                            })()}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {isCalibratingBase && showBase01Ghost && (
                      <span className="text-xs text-muted-foreground">
                        Reference: base_01 (obrys, 40% opacity)
                      </span>
                    )}
                  </div>

                  <div className="mx-auto relative w-64 h-64 rounded-md border bg-background overflow-hidden">
                    {showBase01Ghost && base01?.image_url && (
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{ opacity: 0.4 }}
                        aria-hidden="true"
                      >
                        <AvatarLayerStack
                          layers={[
                            {
                              item: {
                                id: base01.id,
                                slug: base01.slug,
                                category: "base",
                                image_url: base01.image_url,
                                image_url_back: base01.image_url_back,
                                color_value: base01.color_value,
                                layer_offset_x: 0,
                                layer_offset_y: 0,
                                layer_scale: 1,
                              },
                            },
                          ]}
                        />
                      </div>
                    )}
                    {(() => {
                      const layers: StackLayer[] = [];
                      if (!isCalibratingBase && previewBase?.image_url) {
                        layers.push({
                          item: {
                            id: previewBase.id,
                            slug: previewBase.slug,
                            category: "base",
                            image_url: previewBase.image_url,
                            image_url_back: previewBase.image_url_back,
                            color_value: previewBase.color_value,
                            layer_offset_x: Number(previewBase.layer_offset_x) || 0,
                            layer_offset_y: Number(previewBase.layer_offset_y) || 0,
                            layer_scale: Number(previewBase.layer_scale) || 1,
                          },
                        });
                      }
                      if (editing.image_url || (isVariantMode && activeVariant?.image_url)) {
                        const useVariant = isVariantMode && !!activeVariant;
                        const imgUrl = useVariant
                          ? activeVariant!.image_url ?? editing.image_url ?? null
                          : editing.image_url ?? null;
                        const imgBack = useVariant
                          ? activeVariant!.image_url_back ?? editing.image_url_back ?? null
                          : editing.image_url_back ?? null;
                        const draft = useVariant ? variantDraftRef.current : calibrationDraftRef.current;
                        layers.push({
                          item: {
                            id: editing.id ?? "editing",
                            slug: editing.slug ?? "editing",
                            category: (editing.category as string) ?? "outfit",
                            image_url: imgUrl,
                            image_url_back: imgBack,
                            color_value: editing.color_value ?? null,
                            layer_offset_x: draft.layer_offset_x,
                            layer_offset_y: draft.layer_offset_y,
                            layer_scale: draft.layer_scale,
                          },
                        });
                      }
                      return <AvatarLayerStack layers={layers} />;
                    })()}
                  </div>

                  {cat === "hairstyle" && previewBase && (
                    isVariantMode ? (
                      <div className="rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-900 dark:text-amber-200 font-medium">
                        Kalibruješ variantu pro {previewBase.slug} (specifický obrázek této kombinace).
                      </div>
                    ) : (
                      <div className="rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                        Kalibruješ OBECNÝ obrázek (žádná varianta pro {previewBase.slug}).
                      </div>
                    )
                  )}

                  {editing.slug === "base_01" ? (
                    <p className="text-xs rounded-md border border-dashed p-3 bg-background text-muted-foreground">
                      Toto je referenční základ — jeho pozice je pevně 0 / 0 / 1
                      a nelze ji měnit, protože na ni jsou zarovnané všechny
                      ostatní základy i vlasy/oblečení.
                    </p>
                  ) : (
                    <>
                      {[
                        { key: "layer_offset_x" as const, label: "Posun X (%)", min: -20, max: 20, step: 0.5, def: 0 },
                        { key: "layer_offset_y" as const, label: "Posun Y (%)", min: -20, max: 20, step: 0.5, def: 0 },
                        { key: "layer_scale" as const, label: "Velikost", min: 0.5, max: 1.5, step: 0.01, def: 1 },
                      ].map((s) => {
                        const raw = isVariantMode ? variantValues[s.key] : (editing as any)[s.key];
                        const parsed = Number(raw ?? s.def);
                        const val = Number.isFinite(parsed) ? parsed : s.def;
                        return (
                          <div key={s.key} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs">{s.label}</Label>
                              <Input
                                type="number"
                                step={s.step}
                                className="h-7 w-24 text-right"
                                value={val}
                                onChange={(e) => {
                                  updateCurrentValue(s.key, parseFloat(e.target.value));
                                }}
                              />
                            </div>
                            <Slider
                              min={s.min}
                              max={s.max}
                              step={s.step}
                              value={[val]}
                              onValueChange={([v]) => updateCurrentValue(s.key, v)}
                            />
                          </div>
                        );
                      })}

                      <div className="flex gap-2 justify-end pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const zero = { layer_offset_x: 0, layer_offset_y: 0, layer_scale: 1 };
                            if (isVariantMode) {
                              variantDraftRef.current = zero;
                              setVariantValues(zero);
                            } else {
                              calibrationDraftRef.current = zero;
                              setEditing({ ...editing, ...zero });
                            }
                          }}
                        >
                          Reset
                        </Button>
                        <Button
                          size="sm"
                          onClick={isVariantMode ? saveVariantCalibration : saveCalibration}
                          disabled={calibrating || (!isVariantMode && !editing.id)}
                        >
                          {calibrating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          {isVariantMode ? "Uložit variantu" : "Uložit kalibraci"}
                        </Button>
                      </div>
                      {!editing.id && !isVariantMode && (
                        <p className="text-xs text-muted-foreground">
                          Kalibraci lze uložit až po prvním vytvoření položky.
                        </p>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <Label>Layer scale</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editing.layer_scale ?? 1}
                      onChange={(e) => setEditing({ ...editing, layer_scale: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Layer offset X</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editing.layer_offset_x ?? 0}
                      onChange={(e) => setEditing({ ...editing, layer_offset_x: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Layer offset Y</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editing.layer_offset_y ?? 0}
                      onChange={(e) => setEditing({ ...editing, layer_offset_y: Number(e.target.value) })}
                    />
                  </div>
                </>
              )}

              <div className="flex items-center gap-2 pt-2">
                <Switch
                  checked={!!editing.is_default}
                  onCheckedChange={(v) => setEditing({ ...editing, is_default: v })}
                />
                <Label>Výchozí</Label>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Switch
                  checked={editing.is_active ?? true}
                  onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                />
                <Label>Aktivní</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Zrušit</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Uložit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smazat položku „{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Akce je nevratná. Smaže se také všechna vazba na tuto položku v odemčených
              položkách uživatelů (user_avatar_items). Pokud je položka aktuálně nastavena
              v něčím profilu (avatar_profiles), smazání selže — nejprve ji z profilů
              odeberte nebo ji deaktivujte.
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
}
