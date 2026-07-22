import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

import BadgeOverlay from "@/components/avatar/BadgeOverlay";
import AvatarLayerStack, { type AvatarStackItem, type StackLayer } from "@/components/avatar/AvatarLayerStack";
import { isTintable, CATEGORY_COLOR_COLUMN, type TintableCategory } from "@/lib/avatar-palettes";

interface AvatarItem extends AvatarStackItem {
  name: string;
  icon_name: string | null;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";
  is_neutral_color: boolean | null;
}

interface AvatarProfile {
  base_id: string | null;
  skin_tone_id: string | null;
  hairstyle_id: string | null;
  hair_color_id: string | null;
  eyes_id: string | null;
  eyebrow_id: string | null;
  outfit_id: string | null;
  face_accessory_id: string | null;
  head_accessory_id: string | null;
  background_id: string | null;
  frame_id: string | null;
  effect_id: string | null;
  badge_id: string | null;
  base_color: string | null;
  hairstyle_color: string | null;
  outfit_color: string | null;
  face_accessory_color: string | null;
  head_accessory_color: string | null;
  background_color: string | null;
}

// Same order as AvatarEditor: bottom → top
const LAYER_ORDER: { field: keyof AvatarProfile; sub?: "back" | "front" }[] = [
  { field: "background_id" },
  { field: "hairstyle_id", sub: "back" },
  { field: "base_id" },
  { field: "eyes_id" },
  { field: "eyebrow_id" },
  { field: "outfit_id" },
  { field: "hairstyle_id", sub: "front" },
  { field: "face_accessory_id" },
  { field: "head_accessory_id" },
  { field: "effect_id" },
  { field: "frame_id" },
];

interface Props {
  userId: string | null | undefined;
  size?: number;
  className?: string;
  /** When false, renders a plain (non-linked) avatar without pencil badge. Default true. */
  editable?: boolean;
  /**
   * "full" (default): show the entire avatar as authored.
   * "head": zoom in on the head/shoulders — hides legs/arms. Useful for small
   * nav/header/list bubbles where the full character wouldn't be legible.
   */
  crop?: "head" | "full";
  /** When false, hides the pencil edit badge (and "new items" dot) overlay. Default true. */
  showEditButton?: boolean;
  /** When false, hides the equipped achievement badge overlay (used for teachers). Default true. */
  showStreakBadge?: boolean;
}

export default function ProfileAvatarBubble({ userId, size = 56, className, editable = true, crop = "full", showEditButton = true, showStreakBadge = true }: Props) {
  const [profile, setProfile] = useState<AvatarProfile | null>(null);
  const [items, setItems] = useState<Map<string, AvatarItem>>(new Map());
  const [loading, setLoading] = useState(true);
  const [hasNew, setHasNew] = useState(false);

  useEffect(() => {
    if (!userId || !editable) {
      setHasNew(false);
      return;
    }
    let mounted = true;
    (async () => {
      const { count } = await supabase
        .from("user_avatar_items")
        .select("avatar_item_id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_new", true);
      if (mounted) setHasNew((count ?? 0) > 0);
    })();
    return () => { mounted = false; };
  }, [userId, editable]);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setItems(new Map());
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    (async () => {
      const { data: prof } = await supabase
        .from("avatar_profiles")
        .select("base_id, skin_tone_id, hairstyle_id, hair_color_id, eyes_id, eyebrow_id, outfit_id, face_accessory_id, head_accessory_id, background_id, frame_id, effect_id, badge_id, base_color, hairstyle_color, outfit_color, face_accessory_color, head_accessory_color, background_color")
        .eq("user_id", userId)
        .maybeSingle();

      if (!mounted) return;

      if (!prof) {
        setProfile(null);
        setLoading(false);
        return;
      }
      setProfile(prof as AvatarProfile);

      const ids = Object.entries(prof)
        .filter(([k]) => k.endsWith("_id"))
        .map(([, v]) => v)
        .filter((v): v is string => !!v);
      if (ids.length === 0) {
        setLoading(false);
        return;
      }
      const { data: rows } = await supabase
        .from("avatar_items")
        .select("id, slug, category, name, image_url, image_url_back, icon_name, color_value, is_neutral_color, rarity, layer_offset_x, layer_offset_y, layer_scale, updated_at")
        .in("id", ids);
      if (!mounted) return;
      const m = new Map<string, AvatarItem>();
      (rows ?? []).forEach((r: any) => m.set(r.id, r));
      setItems(m);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [userId]);

  const tintFor = (category: string): string | null => {
    if (!profile) return null;
    if (!isTintable(category)) return null;
    const col = CATEGORY_COLOR_COLUMN[category as TintableCategory];
    const val = (profile as any)[col] as string | null | undefined;
    return val ?? null;
  };

  const stackLayers: StackLayer[] = [];
  if (profile) {
    for (const l of LAYER_ORDER) {
      const id = profile[l.field];
      if (!id || typeof id !== "string") continue;
      const item = items.get(id);
      if (!item) continue;
      if (l.sub === "back" && !item.image_url_back) continue;
      if (l.sub === "front" && !item.image_url) continue;
      stackLayers.push({ item, sub: l.sub, tintColor: tintFor(item.category) });
    }
  }

  const hasContent = !loading && stackLayers.length > 0;

  // "head" crop: zoom the layer stack so head + a hint of shoulders fill the bubble.
  //
  // Geometry: AvatarLayerStack renders inside an inset 9% (top:9%, height:82%) box
  // of this wrapper. base_01.png is 1000x1200 (portrait) and is displayed with
  // object-contain inside that 82%-square inner box → the image fits by height,
  // so vertically it spans wrapper Y = 9%..91%.
  //
  // Head + a hint of shoulders ≈ top ~42% of the source image →
  // spans wrapper Y = 9%..9% + 0.42*82% ≈ 43.4%.
  //
  // With transformOrigin "center top" and transform "scale(S) translateY(T%)"
  // (applied right-to-left: translate → scale), a Y coordinate y0 (as % of
  // wrapper) maps to S*(y0 + T). Solving for image top (9%) → 0 and head bottom
  // (~43.4%) → 100% gives T = -9%, S ≈ 100/34.4 ≈ 2.9.
  const headCropStyle: React.CSSProperties | undefined = crop === "head"
    ? { transform: "scale(2.1) translateY(-9%)", transformOrigin: "center top" }
    : undefined;

  const inner = (
    <>
      <span
        className={cn(
          "absolute inset-0 rounded-[14px] overflow-hidden border-2 border-border bg-muted flex items-center justify-center",
          editable && "transition-colors group-hover:border-primary/50",
        )}
        aria-hidden
      >
        {hasContent ? (
          <div className="absolute inset-0" style={headCropStyle}>
            <AvatarLayerStack layers={stackLayers} />
          </div>
        ) : (
          <User className="w-1/2 h-1/2 text-muted-foreground" />
        )}
      </span>
      {profile?.badge_id && items.get(profile.badge_id) && (
        <BadgeOverlay
          iconName={items.get(profile.badge_id)!.icon_name}
          rarity={items.get(profile.badge_id)!.rarity}
          title={items.get(profile.badge_id)!.name}
          size={Math.max(20, size * 0.32)}
          className="-bottom-0.5 -left-0.5"
        />
      )}
      {editable && showEditButton && (
        <span
          aria-hidden
          className="absolute -bottom-0.5 -right-0.5 rounded-full bg-primary text-primary-foreground shadow ring-2 ring-background flex items-center justify-center"
          style={{ width: Math.max(20, size * 0.32), height: Math.max(20, size * 0.32) }}
        >
          <Pencil style={{ width: Math.max(10, size * 0.16), height: Math.max(10, size * 0.16) }} />
        </span>
      )}
      {editable && showEditButton && hasNew && (
        <span
          aria-label="Nové položky odemčeny"
          className="absolute -top-0.5 -right-0.5 rounded-full bg-destructive ring-2 ring-background"
          style={{ width: Math.max(10, size * 0.2), height: Math.max(10, size * 0.2) }}
        />
      )}
    </>
  );

  if (!editable) {
    return (
      <span
        className={cn("relative inline-block rounded-[14px]", className)}
        style={{ width: size, height: size }}
        aria-hidden
      >
        {inner}
      </span>
    );
  }

  return (
    <Link
      to="/avatar"
      aria-label="Upravit avatara"
      className={cn(
        "relative inline-block rounded-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background group",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {inner}
    </Link>
  );
}
