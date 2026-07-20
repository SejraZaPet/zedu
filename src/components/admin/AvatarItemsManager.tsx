import { useEffect, useMemo, useState } from "react";
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

type Category =
  | "base"
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
};

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

export default function AvatarItemsManager() {
  const [items, setItems] = useState<AvatarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [editing, setEditing] = useState<Partial<AvatarItem> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AvatarItem | null>(null);
  const [saving, setSaving] = useState(false);

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
  const showColor = cat === "hair_color";

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
        <Button onClick={() => setEditing(emptyForm())} size="sm">
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
                      <Button size="sm" variant="ghost" onClick={() => setEditing(item)}>
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
