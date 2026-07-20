import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import FrameOverlay from "@/components/avatar/FrameOverlay";
import EffectOverlay from "@/components/avatar/EffectOverlay";
import BadgeOverlay from "@/components/avatar/BadgeOverlay";

interface AvatarItem {
  id: string;
  slug: string;
  category: string;
  name: string;
  image_url: string | null;
  image_url_back: string | null;
  icon_name: string | null;
  color_value: string | null;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";
  layer_offset_x: number;
  layer_offset_y: number;
  layer_scale: number;
}

interface AvatarProfile {
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
}

// Same order as AvatarEditor: bottom → top
const LAYER_ORDER: { field: keyof AvatarProfile; sub?: "back" | "front" }[] = [
  { field: "background_id" },
  { field: "hairstyle_id", sub: "back" },
  { field: "base_id" },
  { field: "outfit_id" },
  { field: "hairstyle_id", sub: "front" },
  { field: "face_accessory_id" },
  { field: "head_accessory_id" },
  { field: "effect_id" },
  { field: "frame_id" },
];

function Layer({ item, sub, hairColor }: { item: AvatarItem; sub?: "back" | "front"; hairColor?: string | null }) {
  if (item.category === "frame") {
    return <FrameOverlay slug={item.slug} />;
  }
  if (item.category === "effect") {
    return <EffectOverlay slug={item.slug} />;
  }
  const src = sub === "back" ? item.image_url_back : item.image_url;
  const style: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    transform: `translate(${item.layer_offset_x}%, ${item.layer_offset_y}%) scale(${item.layer_scale})`,
    transformOrigin: "center",
  };
  if (src) {
    if (item.category === "hairstyle" && hairColor) {
      return (
        <div
          aria-hidden
          style={{
            ...style,
            background: hairColor,
            WebkitMaskImage: `url(${src})`,
            maskImage: `url(${src})`,
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
            maskPosition: "center",
            WebkitMaskSize: "contain",
            maskSize: "contain",
          }}
          className="w-full h-full pointer-events-none select-none"
        />
      );
    }
    return (
      <img
        src={src}
        alt=""
        aria-hidden
        draggable={false}
        style={style}
        className="w-full h-full object-contain pointer-events-none select-none"
      />
    );
  }
  if (item.category === "background" && item.color_value) {
    return <div style={{ ...style, background: item.color_value }} />;
  }
  return null;
}

interface Props {
  userId: string;
  size?: number;
  className?: string;
}

export default function ProfileAvatarBubble({ userId, size = 56, className }: Props) {
  const [profile, setProfile] = useState<AvatarProfile | null>(null);
  const [items, setItems] = useState<Map<string, AvatarItem>>(new Map());
  const [loading, setLoading] = useState(true);
  const [hasNew, setHasNew] = useState(false);

  useEffect(() => {
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
  }, [userId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: prof } = await supabase
        .from("avatar_profiles")
        .select("base_id, hairstyle_id, hair_color_id, outfit_id, face_accessory_id, head_accessory_id, background_id, frame_id, effect_id, badge_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!mounted) return;

      if (!prof) {
        setProfile(null);
        setLoading(false);
        return;
      }
      setProfile(prof as AvatarProfile);

      const ids = Object.values(prof).filter((v): v is string => !!v);
      if (ids.length === 0) {
        setLoading(false);
        return;
      }
      const { data: rows } = await supabase
        .from("avatar_items")
        .select("id, slug, category, name, image_url, image_url_back, icon_name, color_value, rarity, layer_offset_x, layer_offset_y, layer_scale")
        .in("id", ids);
      if (!mounted) return;
      const m = new Map<string, AvatarItem>();
      (rows ?? []).forEach((r: any) => m.set(r.id, r));
      setItems(m);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [userId]);

  const layers: { item: AvatarItem; sub?: "back" | "front" }[] = [];
  if (profile) {
    for (const l of LAYER_ORDER) {
      const id = profile[l.field];
      if (!id) continue;
      const item = items.get(id);
      if (!item) continue;
      if (l.sub === "back" && !item.image_url_back) continue;
      if (l.sub === "front" && !item.image_url) continue;
      layers.push({ item, sub: l.sub });
    }
  }

  const hairColorItem = profile?.hair_color_id ? items.get(profile.hair_color_id) : null;
  const hairColor = hairColorItem?.color_value ?? null;

  const hasContent = !loading && layers.length > 0;

  return (
    <Link
      to="/avatar"
      aria-label="Upravit avatara"
      className={cn(
        "relative inline-block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background group",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <span
        className="absolute inset-0 rounded-full overflow-hidden border-2 border-border bg-muted flex items-center justify-center transition-colors group-hover:border-primary/50"
        aria-hidden
      >
        {hasContent ? (
          layers.map((l, i) => (
            <Layer
              key={`${l.item.id}-${l.sub ?? "m"}-${i}`}
              item={l.item}
              sub={l.sub}
              hairColor={l.item.category === "hairstyle" ? hairColor : null}
            />
          ))
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
      <span
        aria-hidden
        className="absolute -bottom-0.5 -right-0.5 rounded-full bg-primary text-primary-foreground shadow ring-2 ring-background flex items-center justify-center"
        style={{ width: Math.max(20, size * 0.32), height: Math.max(20, size * 0.32) }}
      >
        <Pencil style={{ width: Math.max(10, size * 0.16), height: Math.max(10, size * 0.16) }} />
      </span>
      {hasNew && (
        <span
          aria-label="Nové položky odemčeny"
          className="absolute -top-0.5 -right-0.5 rounded-full bg-destructive ring-2 ring-background"
          style={{ width: Math.max(10, size * 0.2), height: Math.max(10, size * 0.2) }}
        />
      )}
    </Link>
  );
}
