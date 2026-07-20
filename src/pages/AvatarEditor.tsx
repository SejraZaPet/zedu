import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import SiteHeader from "@/components/SiteHeader";
import FrameOverlay from "@/components/avatar/FrameOverlay";
import EffectOverlay from "@/components/avatar/EffectOverlay";
import BadgeOverlay from "@/components/avatar/BadgeOverlay";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  User, Scissors, Shirt, Glasses, Crown, Image as ImageIcon,
  Frame, Sparkles, Award, Type, Lock, Heart, Shuffle, ArrowLeft, Check, Droplet,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------- Types ----------
type Category =
  | "base" | "hairstyle" | "hair_color" | "outfit"
  | "face_accessory" | "head_accessory" | "background"
  | "frame" | "effect" | "badge" | "title";

interface AvatarItem {
  id: string;
  slug: string;
  name: string;
  category: Category;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";
  image_url: string | null;
  icon_name: string | null;
  image_url_back: string | null;
  color_value: string | null;
  is_neutral_color: boolean | null;

  recommended_for_role: "student" | "teacher" | "both";
  unlock_type: string;
  unlock_value: string | null;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  layer_offset_x: number;
  layer_offset_y: number;
  layer_scale: number;
}

interface Profile {
  user_id: string;
  base_id: string | null;
  hairstyle_id: string | null;
  hair_color_id: string | null;
  outfit_id: string | null;
  face_accessory_id: string | null;
  head_accessory_id: string | null;
  background_id: string | null;
  frame_id: string | null;
  effect_id: string | null;
  badge_id: string | null;
  active_title: string | null;
  reduce_motion: boolean;
}

interface OwnedItem {
  avatar_item_id: string;
  is_new: boolean;
  is_favorite: boolean;
}

// ---------- Config ----------
const CATEGORY_META: {
  key: Category;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  profileField: keyof Profile | "active_title";
  storesValue: "id" | "name";
}[] = [
  { key: "base",            label: "Postava",         icon: User,       profileField: "base_id",           storesValue: "id" },
  { key: "hairstyle",       label: "Vlasy",           icon: Scissors,   profileField: "hairstyle_id",      storesValue: "id" },
  { key: "hair_color",      label: "Barva vlasů",     icon: Droplet,    profileField: "hair_color_id",     storesValue: "id" },
  { key: "outfit",          label: "Oblečení",        icon: Shirt,      profileField: "outfit_id",         storesValue: "id" },
  { key: "face_accessory",  label: "Doplňky obličej", icon: Glasses,    profileField: "face_accessory_id", storesValue: "id" },
  { key: "head_accessory",  label: "Doplňky hlava",   icon: Crown,      profileField: "head_accessory_id", storesValue: "id" },
  { key: "background",      label: "Pozadí",          icon: ImageIcon,  profileField: "background_id",     storesValue: "id" },
  { key: "frame",           label: "Rámeček",         icon: Frame,      profileField: "frame_id",          storesValue: "id" },
  { key: "effect",          label: "Efekty",          icon: Sparkles,   profileField: "effect_id",         storesValue: "id" },
  { key: "badge",           label: "Odznaky",         icon: Award,      profileField: "badge_id",          storesValue: "id" },
  { key: "title",           label: "Titul",           icon: Type,       profileField: "active_title",      storesValue: "name" },
];

const CATEGORY_ICON: Record<Category, React.ComponentType<{ className?: string }>> = Object.fromEntries(
  CATEGORY_META.map((c) => [c.key, c.icon]),
) as Record<Category, React.ComponentType<{ className?: string }>>;

// Bottom-up render order for the preview stack.
// Explicit sub: "back" | "front" for hairstyle so we don't rely on positional counting.
const LAYER_ORDER: { category: Category; sub?: "back" | "front" }[] = [
  { category: "background" },
  { category: "hairstyle", sub: "back" },
  { category: "base" },
  { category: "outfit" },
  { category: "hairstyle", sub: "front" },
  { category: "face_accessory" },
  { category: "head_accessory" },
  { category: "effect" },
  { category: "frame" },
];

const RARITY_LABEL: Record<AvatarItem["rarity"], string> = {
  common: "Běžné",
  uncommon: "Neobyčejné",
  rare: "Vzácné",
  epic: "Epické",
  legendary: "Legendární",
  mythic: "Mýtické",
};

const RARITY_TONE: Record<AvatarItem["rarity"], string> = {
  common: "bg-muted text-muted-foreground",
  uncommon: "bg-primary/15 text-primary",
  rare: "bg-secondary/15 text-secondary",
  epic: "bg-accent/20 text-accent-foreground",
  legendary: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300",
  mythic: "bg-gradient-brand-sm text-white",
};

const emptyProfile = (userId: string): Profile => ({
  user_id: userId,
  base_id: null, hairstyle_id: null, hair_color_id: null, outfit_id: null,
  face_accessory_id: null, head_accessory_id: null, background_id: null,
  frame_id: null, effect_id: null, badge_id: null,
  active_title: null, reduce_motion: false,
});

function unlockLabel(item: AvatarItem): string {
  const v = item.unlock_value ?? "";
  switch (item.unlock_type) {
    case "level":            return `Odemkne se na úrovni ${v}`;
    case "xp_total":         return `Získej ještě ${v} XP`;
    case "streak":           return `Udrž studijní sérii ${v} dnů`;
    case "badge":            return `Získej odznak ${v}`;
    case "lessons_count":    return `Dokonči ${v} lekcí`;
    case "practices_count":  return `Dokonči ${v} procvičení`;
    case "teacher_reward":   return "Odměna od učitele";
    case "admin_reward":     return "Speciální odměna";
    default:                 return "Zamčeno";
  }
}

// ---------- Layer renderer ----------
function hairTintFromHex(hex: string): { filter: string; useOverlay: boolean } {
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return { filter: "none", useOverlay: false };
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const L = (max + min) / 2;
  const d = max - min;
  const S = d === 0 ? 0 : d / (1 - Math.abs(2 * L - 1));
  const F = Math.max(0.35, Math.min(2.6, 0.4 + L * 2.0));
  const C = Math.max(0.45, Math.min(1, 1 - Math.max(0, F - 1) * 0.4));
  return { filter: `brightness(${F}) contrast(${C})`, useOverlay: S > 0.08 };
}

function LayerVisual({
  item, subLayer, reduceMotion, hairColor,
}: { item: AvatarItem; subLayer?: "back" | "front"; reduceMotion?: boolean; hairColor?: string | null }) {
  // Decorative SVG overlays for frame/effect — no image_url needed
  if (item.category === "frame") {
    return <FrameOverlay slug={item.slug} reduceMotion={reduceMotion} />;
  }
  if (item.category === "effect") {
    return <EffectOverlay slug={item.slug} reduceMotion={reduceMotion} />;
  }
  const src = subLayer === "back" ? item.image_url_back : item.image_url;
  const style: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    transform: `translate(${item.layer_offset_x}%, ${item.layer_offset_y}%) scale(${item.layer_scale})`,
    transformOrigin: "center",
  };
  if (src) {
    // Hair tinting: unified brightness/contrast + optional color overlay for saturated hues.
    if (item.category === "hairstyle" && hairColor) {
      const { filter, useOverlay } = hairTintFromHex(hairColor);
      return (
        <div aria-hidden="true" style={style} className="w-full h-full pointer-events-none select-none">
          <img
            src={src}
            alt=""
            aria-hidden="true"
            draggable={false}
            style={{ filter }}
            className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
          />
          {useOverlay && (
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                background: hairColor,
                mixBlendMode: "color",
                WebkitMaskImage: `url(${src})`,
                maskImage: `url(${src})`,
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
                WebkitMaskPosition: "center",
                maskPosition: "center",
                WebkitMaskSize: "contain",
                maskSize: "contain",
              }}
            />
          )}
        </div>
      );
    }
    return (
      <img
        src={src}
        alt=""
        aria-hidden="true"
        style={style}
        className="w-full h-full object-contain pointer-events-none select-none"
        draggable={false}
      />
    );
  }


  // Fallback: colored bubble with category icon + item name
  const Icon = CATEGORY_ICON[item.category] ?? Sparkles;
  const bg = item.color_value ?? "hsl(var(--muted))";
  return (
    <div style={style} className="w-full h-full flex items-center justify-center pointer-events-none">
      <div
        className="rounded-full flex flex-col items-center justify-center border-2 border-white/60 shadow-sm"
        style={{
          background: bg,
          width: "55%",
          height: "55%",
        }}
      >
        <Icon className="w-6 h-6 text-white drop-shadow" />
        <span className="text-[10px] font-semibold text-white/95 mt-0.5 px-1 text-center leading-tight line-clamp-2">
          {item.name}
        </span>
      </div>
    </div>
  );
}

// ---------- Preview ----------
function AvatarPreview({
  profile, itemsById, reduceMotion,
}: {
  profile: Profile;
  itemsById: Map<string, AvatarItem>;
  reduceMotion: boolean;
}) {
  const layers: { item: AvatarItem; sub?: "back" | "front" }[] = [];
  for (const l of LAYER_ORDER) {
    let id: string | null = null;
    if (l.category === "background") id = profile.background_id;
    else if (l.category === "base") id = profile.base_id;
    else if (l.category === "outfit") id = profile.outfit_id;
    else if (l.category === "hairstyle") id = profile.hairstyle_id;
    else if (l.category === "face_accessory") id = profile.face_accessory_id;
    else if (l.category === "head_accessory") id = profile.head_accessory_id;
    else if (l.category === "effect") id = profile.effect_id;
    else if (l.category === "frame") id = profile.frame_id;
    if (!id) continue;
    const item = itemsById.get(id);
    if (!item) continue;
    if (l.sub === "back" && !item.image_url_back) continue;
    if (l.sub === "front" && !item.image_url) continue;
    layers.push({ item, sub: l.sub });
  }

  const hairColorItem = profile.hair_color_id ? itemsById.get(profile.hair_color_id) : null;
  const hairColor = hairColorItem?.color_value ?? null;


  return (
    <div
      className={cn(
        "relative w-full aspect-square rounded-2xl overflow-hidden border bg-gradient-to-br from-muted/50 to-muted",
        !reduceMotion && "transition-all",
      )}
      role="img"
      aria-label="Náhled avatara"
    >
      {layers.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground text-center px-4">
          Vyber postavu, abys začal(a) skládat svůj avatar.
        </div>
      )}
      <div className="absolute" style={{ top: "9%", left: "9%", width: "82%", height: "82%" }}>
        {layers.map((l, idx) => (
          <LayerVisual
            key={`${l.item.id}-${l.sub ?? "main"}-${idx}`}
            item={l.item}
            subLayer={l.sub}
            reduceMotion={reduceMotion}
            hairColor={l.item.category === "hairstyle" ? hairColor : null}
          />
        ))}
      </div>
      {profile.active_title && (
        <div className="absolute bottom-2 inset-x-2 text-center">
          <span className="inline-block rounded-full bg-background/90 backdrop-blur px-3 py-1 text-xs font-medium border">
            {profile.active_title}
          </span>
        </div>
      )}
      {profile.badge_id && itemsById.get(profile.badge_id) && (
        <BadgeOverlay
          iconName={itemsById.get(profile.badge_id)!.icon_name}
          rarity={itemsById.get(profile.badge_id)!.rarity}
          title={itemsById.get(profile.badge_id)!.name}
        />
      )}
    </div>
  );
}

// ---------- Onboarding ----------
function BaseOnboarding({
  bases, ownedIds, onPick,
}: {
  bases: AvatarItem[];
  ownedIds: Set<string>;
  onPick: (id: string) => void;
}) {
  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-semibold mb-2">Vytvoř si avatar</h1>
      <p className="text-muted-foreground mb-6">
        Nejdřív si vyber základní postavu. Zbytek doplníš v editoru.
      </p>
      {bases.length === 0 ? (
        <p className="rounded-lg border p-6 text-sm text-muted-foreground bg-muted/40">
          V katalogu zatím nejsou žádné postavy. Vrať se prosím později.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {bases.map((b) => {
            const locked = !ownedIds.has(b.id) && b.unlock_type !== "default";
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => !locked && onPick(b.id)}
                disabled={locked}
                className={cn(
                  "relative aspect-square rounded-xl border-2 p-2 transition-all bg-background",
                  "hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  locked && "opacity-50 cursor-not-allowed",
                )}
              >
                <div className="relative w-full h-full">
                  <LayerVisual item={b} />
                </div>
                <span className="absolute inset-x-1 bottom-1 text-xs font-medium truncate bg-background/80 rounded px-1">
                  {b.name}
                </span>
                {locked && (
                  <span className="absolute top-1 right-1 rounded-full bg-background/90 p-1 border">
                    <Lock className="w-3 h-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- Main editor ----------
const FILTERS = [
  { key: "all", label: "Vše" },
  { key: "available", label: "Dostupné" },
  { key: "locked", label: "Zamčené" },
  { key: "favorite", label: "Oblíbené" },
] as const;
type FilterKey = typeof FILTERS[number]["key"];

export default function AvatarEditor() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AvatarItem[]>([]);
  const [owned, setOwned] = useState<Map<string, OwnedItem>>(new Map());
  const [dbProfile, setDbProfile] = useState<Profile | null>(null);
  const [draft, setDraft] = useState<Profile | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category>("base");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [saving, setSaving] = useState(false);
  const [pendingNavigate, setPendingNavigate] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [newQueue, setNewQueue] = useState<string[]>([]);

  const userId = user?.id;

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const [itemsRes, ownedRes, profileRes] = await Promise.all([
      supabase.from("avatar_items").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("user_avatar_items").select("avatar_item_id, is_new, is_favorite").eq("user_id", userId),
      supabase.from("avatar_profiles").select("*").eq("user_id", userId).maybeSingle(),
    ]);
    if (itemsRes.error) toast({ title: "Chyba", description: itemsRes.error.message, variant: "destructive" });
    setItems((itemsRes.data ?? []) as AvatarItem[]);
    const ownedMap = new Map<string, OwnedItem>();
    (ownedRes.data ?? []).forEach((r: any) => ownedMap.set(r.avatar_item_id, r));
    setOwned(ownedMap);
    setNewQueue((ownedRes.data ?? []).filter((r: any) => r.is_new).map((r: any) => r.avatar_item_id as string));
    const prof = (profileRes.data as Profile | null) ?? null;
    setDbProfile(prof);
    setDraft(prof ? { ...prof } : null);
    setLoading(false);
  }, [userId, toast]);

  useEffect(() => { load(); }, [load]);

  const itemsById = useMemo(() => {
    const m = new Map<string, AvatarItem>();
    items.forEach((it) => m.set(it.id, it));
    return m;
  }, [items]);

  const itemsByCategory = useMemo(() => {
    const m = new Map<Category, AvatarItem[]>();
    items.forEach((it) => {
      const arr = m.get(it.category) ?? [];
      arr.push(it);
      m.set(it.category, arr);
    });
    return m;
  }, [items]);

  const bases = itemsByCategory.get("base") ?? [];

  const isDirty = useMemo(() => {
    if (!draft || !dbProfile) return !!draft && !dbProfile;
    return JSON.stringify({ ...draft, updated_at: undefined, created_at: undefined }) !==
           JSON.stringify({ ...dbProfile, updated_at: undefined, created_at: undefined });
  }, [draft, dbProfile]);

  // Guard: browser refresh/close
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const applyPick = (item: AvatarItem) => {
    if (!draft) return;
    const meta = CATEGORY_META.find((c) => c.key === item.category);
    if (!meta) return;
    const next: Profile = { ...draft };
    const val = meta.storesValue === "id" ? item.id : item.name;
    // toggle off when clicking already-selected (except base)
    const current = (next as any)[meta.profileField];
    if (current === val && item.category !== "base") {
      (next as any)[meta.profileField] = null;
    } else {
      (next as any)[meta.profileField] = val;
    }
    setDraft(next);
  };

  const isSelected = (item: AvatarItem) => {
    if (!draft) return false;
    const meta = CATEGORY_META.find((c) => c.key === item.category);
    if (!meta) return false;
    const val = meta.storesValue === "id" ? item.id : item.name;
    return (draft as any)[meta.profileField] === val;
  };

  const isUnlocked = (item: AvatarItem) => {
    if (item.unlock_type === "default" || item.is_default) return true;
    return owned.has(item.id);
  };

  const selectCategory = (category: Category) => {
    setActiveCategory(category);
    if (category === "frame" || category === "effect") {
      setFilter("all");
    }
  };

  const toggleFavorite = async (item: AvatarItem) => {
    if (!userId) return;
    const current = owned.get(item.id);
    if (!current) return; // can't favorite locked items
    const next = !current.is_favorite;
    setOwned((prev) => {
      const m = new Map(prev);
      m.set(item.id, { ...current, is_favorite: next });
      return m;
    });
    const { error } = await supabase
      .from("user_avatar_items")
      .update({ is_favorite: next })
      .eq("user_id", userId)
      .eq("avatar_item_id", item.id);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      setOwned((prev) => {
        const m = new Map(prev);
        m.set(item.id, current);
        return m;
      });
    }
  };

  const randomize = () => {
    if (!draft) return;
    const next: Profile = { ...draft };
    for (const meta of CATEGORY_META) {
      if (meta.key === "base") continue; // don't change base randomly
      const pool = (itemsByCategory.get(meta.key) ?? []).filter(isUnlocked);
      if (pool.length === 0) continue;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      (next as any)[meta.profileField] = meta.storesValue === "id" ? pick.id : pick.name;
    }
    setDraft(next);
  };

  const save = async () => {
    if (!draft || !userId) return;
    setSaving(true);
    const payload = { ...draft, user_id: userId, updated_at: new Date().toISOString() };
    const { error } = await supabase.from("avatar_profiles").upsert(payload, { onConflict: "user_id" });
    setSaving(false);
    if (error) {
      toast({ title: "Nepodařilo se uložit", description: error.message, variant: "destructive" });
      return;
    }
    setDbProfile({ ...draft });
    toast({ title: "Uloženo", description: "Změny avatara byly uloženy." });
  };

  const revert = () => {
    setDraft(dbProfile ? { ...dbProfile } : null);
  };

  const toggleReduceMotion = async (val: boolean) => {
    if (!draft || !userId) return;
    const next = { ...draft, reduce_motion: val };
    setDraft(next);
    // Persist immediately — accessibility setting shouldn't require batch save
    const { error } = await supabase
      .from("avatar_profiles")
      .upsert({ ...next, user_id: userId, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (!error) setDbProfile((p) => (p ? { ...p, reduce_motion: val } : next));
  };

  const handleBack = () => {
    if (isDirty) setConfirmDiscard(true);
    else navigate(-1);
  };

  // ---------- "New item unlocked" queue handlers ----------
  const clearIsNew = async (itemId: string, extraPatch: Record<string, unknown> = {}) => {
    if (!userId) return;
    setOwned((prev) => {
      const m = new Map(prev);
      const cur = m.get(itemId);
      if (cur) m.set(itemId, { ...cur, is_new: false, ...(extraPatch.is_favorite !== undefined ? { is_favorite: extraPatch.is_favorite as boolean } : {}) });
      return m;
    });
    setNewQueue((q) => q.filter((id) => id !== itemId));
    const { error } = await supabase
      .from("user_avatar_items")
      .update({ is_new: false, ...extraPatch })
      .eq("user_id", userId)
      .eq("avatar_item_id", itemId);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    }
  };

  const tryOnNewItem = (item: AvatarItem) => {
    if (draft) {
      const meta = CATEGORY_META.find((c) => c.key === item.category);
      if (meta) {
        const val = meta.storesValue === "id" ? item.id : item.name;
        setDraft({ ...draft, [meta.profileField]: val } as Profile);
        setActiveCategory(item.category);
      }
    }
    void clearIsNew(item.id);
  };

  const favoriteNewItem = (item: AvatarItem) => {
    void clearIsNew(item.id, { is_favorite: true });
  };

  const continueNewItem = (item: AvatarItem) => {
    void clearIsNew(item.id);
  };

  // Onboarding: need to create profile first
  const onboardPickBase = async (baseId: string) => {
    if (!userId) return;
    const payload = { ...emptyProfile(userId), base_id: baseId };
    const { error } = await supabase.from("avatar_profiles").insert(payload);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    setDbProfile(payload);
    setDraft(payload);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="flex items-center justify-center py-24 text-muted-foreground">Načítání…</div>
      </div>
    );
  }
  if (!userId) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="flex items-center justify-center py-24 text-muted-foreground">Musíš být přihlášen(a).</div>
      </div>
    );
  }

  if (!dbProfile) {
    const ownedIds = new Set(owned.keys());
    bases.forEach((b) => { if (b.unlock_type === "default" || b.is_default) ownedIds.add(b.id); });
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <BaseOnboarding bases={bases} ownedIds={ownedIds} onPick={onboardPickBase} />
      </div>
    );
  }

  const currentList = (itemsByCategory.get(activeCategory) ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
  const filteredList = currentList.filter((it) => {
    const unlocked = isUnlocked(it);
    const fav = owned.get(it.id)?.is_favorite;
    if (filter === "available") return unlocked;
    if (filter === "locked") return !unlocked;
    if (filter === "favorite") return !!fav;
    return true;
  });

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8 pt-[70px]">
      <SiteHeader />
      {/* Sub-header (sticky "Zpět" bar) */}
      <header className="sticky top-[70px] z-20 bg-background/95 backdrop-blur border-b">
        <div className="container max-w-6xl mx-auto flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={handleBack} aria-label="Zpět">
              <ArrowLeft className="w-4 h-4 mr-1" /> Zpět
            </Button>
            <h1 className="text-lg font-semibold">Editor avatara</h1>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <Button variant="outline" onClick={revert} disabled={!isDirty || saving}>Vrátit změny</Button>
            <Button onClick={save} disabled={!isDirty || saving}>
              {saving ? "Ukládám…" : "Uložit změny"}
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile category strip */}
      <nav
        aria-label="Kategorie"
        className="md:hidden overflow-x-auto border-b bg-card"
      >
        <div className="flex gap-1 px-2 py-2 min-w-max">
          {CATEGORY_META.map((c) => {
            const Icon = c.icon;
            const active = activeCategory === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => selectCategory(c.key)}
                className={cn(
                  "min-h-[44px] px-3 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap text-sm font-medium border transition-colors",
                  active ? "border-primary bg-primary/10 text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
                aria-current={active ? "true" : undefined}
              >
                <Icon className="w-4 h-4" />
                {c.label}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="container max-w-6xl mx-auto px-4 py-4 md:py-6 grid gap-4 md:grid-cols-[220px_minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* Left: categories (desktop) */}
        <aside className="hidden md:block">
          <ul className="space-y-1" role="tablist" aria-label="Kategorie">
            {CATEGORY_META.map((c) => {
              const Icon = c.icon;
              const active = activeCategory === c.key;
              return (
                <li key={c.key}>
                  <button
                    role="tab"
                    aria-selected={active}
                    type="button"
                    onClick={() => selectCategory(c.key)}
                    className={cn(
                      "w-full min-h-[44px] px-3 py-2 rounded-lg flex items-center gap-3 text-sm font-medium transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      active
                        ? "bg-primary/10 text-primary border border-primary/30"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted",
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {c.label}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="reduce-motion" className="text-sm">Omezit animace</Label>
              <Switch
                id="reduce-motion"
                checked={draft?.reduce_motion ?? false}
                onCheckedChange={toggleReduceMotion}
              />
            </div>
            <p className="text-xs text-muted-foreground">Šetrnější pohyb u efektů a přechodů.</p>
          </div>
        </aside>

        {/* Middle: preview */}
        <section aria-label="Náhled avatara" className="space-y-3">
          {draft && <AvatarPreview profile={draft} itemsById={itemsById} reduceMotion={draft.reduce_motion} />}
          <Button variant="outline" className="w-full" onClick={randomize}>
            <Shuffle className="w-4 h-4 mr-2" /> Náhodný vzhled
          </Button>
        </section>

        {/* Right: grid */}
        <section aria-label="Položky kategorie" className="min-w-0">
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <h2 className="text-lg font-semibold">
              {CATEGORY_META.find((c) => c.key === activeCategory)?.label}
            </h2>
            <div className="flex gap-1 flex-wrap" role="tablist" aria-label="Filtr">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "min-h-[36px] px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                    filter === f.key
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground hover:text-foreground",
                  )}
                  aria-pressed={filter === f.key}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredList.length === 0 ? (
            <p className="rounded-lg border p-6 text-sm text-muted-foreground bg-muted/40">
              {items.length === 0
                ? "V katalogu zatím nejsou žádné položky. Katalog se plní administrátory."
                : "Žádné položky odpovídající vybranému filtru."}
            </p>
          ) : (
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredList.map((it) => {
                const unlocked = isUnlocked(it);
                const selected = isSelected(it);
                const meta = owned.get(it.id);
                return (
                  <li key={it.id}>
                    <div
                      className={cn(
                        "group relative rounded-xl border-2 bg-card overflow-hidden transition-all",
                        selected ? "border-primary ring-2 ring-primary/30" : "border-border",
                        !unlocked && "opacity-70",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => unlocked && applyPick(it)}
                        disabled={!unlocked}
                        aria-label={`${it.name}${unlocked ? "" : " (zamčeno)"}`}
                        className={cn(
                          "w-full text-left p-2 min-h-[44px]",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                          !unlocked && "cursor-not-allowed",
                        )}
                      >
                        <div className="relative w-full aspect-square rounded-lg bg-muted/40 overflow-hidden mb-2">
                          <LayerVisual item={it} />
                          {selected && (
                            <span className="absolute top-1 left-1 rounded-full bg-primary text-primary-foreground w-6 h-6 flex items-center justify-center">
                              <Check className="w-3.5 h-3.5" />
                            </span>
                          )}
                          {!unlocked && (
                            <span className="absolute inset-0 bg-background/40 flex items-center justify-center">
                              <Lock className="w-6 h-6 text-foreground/80" />
                            </span>
                          )}
                          {meta?.is_new && unlocked && (
                            <span className="absolute top-1 right-1 rounded-full bg-secondary text-secondary-foreground text-[10px] font-bold px-1.5 py-0.5">
                              NOVÉ
                            </span>
                          )}
                        </div>
                        <div className="flex items-start justify-between gap-1">
                          <span className="text-sm font-medium truncate" title={it.name}>{it.name}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-1">
                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", RARITY_TONE[it.rarity])}>
                            {RARITY_LABEL[it.rarity]}
                          </Badge>
                        </div>
                        {!unlocked && (
                          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                            {unlockLabel(it)}
                          </p>
                        )}
                      </button>
                      {unlocked && (
                        <button
                          type="button"
                          onClick={() => toggleFavorite(it)}
                          aria-label={meta?.is_favorite ? "Odebrat z oblíbených" : "Přidat do oblíbených"}
                          aria-pressed={!!meta?.is_favorite}
                          className={cn(
                            "absolute bottom-2 right-2 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                            "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <Heart
                            className={cn("w-5 h-5", meta?.is_favorite && "fill-current text-red-500")}
                          />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>

      {/* Mobile sticky save */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-20 border-t bg-background p-3 flex gap-2">
        <Button variant="outline" onClick={revert} disabled={!isDirty || saving} className="flex-1">
          Vrátit
        </Button>
        <Button onClick={save} disabled={!isDirty || saving} className="flex-1">
          {saving ? "Ukládám…" : "Uložit změny"}
        </Button>
      </div>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zahodit neuložené změny?</AlertDialogTitle>
            <AlertDialogDescription>
              Máš neuložené úpravy avatara. Pokud odejdeš, budou ztraceny.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zůstat</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setConfirmDiscard(false); navigate(-1); }}
            >
              Zahodit a odejít
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {(() => {
        const currentId = newQueue[0];
        const item = currentId ? itemsById.get(currentId) : null;
        if (!item) return null;
        return (
          <Dialog
            open={true}
            onOpenChange={(open) => { if (!open) continueNewItem(item); }}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Nová položka odemčena!</DialogTitle>
                <DialogDescription>
                  Do své sbírky získáváš nový kosmetický předmět.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center gap-3 py-2">
                <div className="relative w-32 h-32 rounded-xl border-2 bg-muted/40 overflow-hidden">
                  <LayerVisual item={item} />
                  {item.category === "badge" && (
                    <BadgeOverlay
                      iconName={item.icon_name}
                      rarity={item.rarity}
                      className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                      size={56}
                    />
                  )}
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-base font-semibold">{item.name}</span>
                  <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", RARITY_TONE[item.rarity])}>
                    {RARITY_LABEL[item.rarity]}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Právě jsi odemkl(a) položku <strong>{item.name}</strong>.
                </p>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => continueNewItem(item)}>
                  Pokračovat
                </Button>
                <Button variant="outline" onClick={() => favoriteNewItem(item)}>
                  <Heart className="w-4 h-4 mr-1" /> Přidat do oblíbených
                </Button>
                <Button onClick={() => tryOnNewItem(item)}>
                  Vyzkoušet na avatarovi
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}
