import FrameOverlay from "@/components/avatar/FrameOverlay";
import EffectOverlay from "@/components/avatar/EffectOverlay";
import { BRAND_GRADIENT_CSS, isGradientValue } from "@/lib/avatar-palettes";

/**
 * Shared avatar rendering primitives used by both the student-facing
 * AvatarEditor preview and the admin AvatarItemsManager calibration preview.
 *
 * Keeping a single implementation guarantees pixel-identical output for the
 * same input values (layer_offset_x/y/layer_scale) — the admin calibration
 * environment is literally the same code path as production.
 */

export type AvatarStackItem = {
  id: string;
  slug: string;
  category: string;
  image_url: string | null;
  image_url_back: string | null;
  color_value: string | null;
  layer_offset_x: number;
  layer_offset_y: number;
  layer_scale: number;
  /** Optional updated_at timestamp used as cache-buster query parameter on image URLs. */
  updated_at?: string | null;
};

/**
 * Append `?v=<updated_at>` to a storage URL so browsers (and the service worker)
 * refetch the file when it's been replaced under the same name.
 */
export function withCacheBuster(url: string | null | undefined, version?: string | null): string {
  if (!url) return "";
  if (!version) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${encodeURIComponent(version)}`;
}

export type StackLayer = {
  item: AvatarStackItem;
  sub?: "back" | "front";
  /** Optional hex color used to tint this specific layer via brightness/contrast + mask overlay. */
  tintColor?: string | null;
};

export function hairTintFromHex(hex: string): { filter: string; useOverlay: boolean; neutral: boolean } {
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return { filter: "none", useOverlay: false, neutral: false };
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const L = (max + min) / 2;
  const d = max - min;
  const S = d === 0 ? 0 : d / (1 - Math.abs(2 * L - 1));
  // Neutral (black/white/grey): mix-blend-mode:color can't tint zero-saturation
  // targets, so bypass the overlay entirely and desaturate the source instead.
  if (S < 0.12) {
    const Fn = Math.max(0.3, Math.min(2.3, 0.35 + L * 1.85));
    return { filter: `brightness(${Fn}) saturate(0)`, useOverlay: false, neutral: true };
  }
  const F = Math.max(0.35, Math.min(2.6, 0.4 + L * 2.0));
  const C = Math.max(0.45, Math.min(1, 1 - Math.max(0, F - 1) * 0.4));
  return { filter: `brightness(${F}) contrast(${C})`, useOverlay: S > 0.08, neutral: false };
}

export function outfitTintFromHex(hex: string): { filter: string; useOverlay: boolean; neutral: boolean } {
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return { filter: "none", useOverlay: false, neutral: false };
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const L = (max + min) / 2;
  const d = max - min;
  const S = d === 0 ? 0 : d / (1 - Math.abs(2 * L - 1));
  if (S < 0.12) {
    const Fn = Math.max(0.3, Math.min(2.3, 0.35 + L * 1.85));
    return { filter: `brightness(${Fn}) saturate(0)`, useOverlay: false, neutral: true };
  }
  // Normalize very light garment PNGs (near-white) to mid-grey BEFORE the
  // mix-blend-mode:color overlay. Fixed values, independent of target color —
  // otherwise `color` blend preserves source luminance and the tint disappears.
  return { filter: "grayscale(1) brightness(0.55)", useOverlay: true, neutral: false };
}

export function AvatarLayer({
  item, sub, tintColor, reduceMotion,
}: {
  item: AvatarStackItem;
  sub?: "back" | "front";
  tintColor?: string | null;
  reduceMotion?: boolean;
}) {
  if (item.category === "frame") return <FrameOverlay slug={item.slug} reduceMotion={reduceMotion} />;
  if (item.category === "effect") return <EffectOverlay slug={item.slug} reduceMotion={reduceMotion} />;

  const rawSrc = sub === "back" ? item.image_url_back : item.image_url;
  const src = rawSrc ? withCacheBuster(rawSrc, item.updated_at) : rawSrc;
  const ox = Number.isFinite(item.layer_offset_x) ? item.layer_offset_x : 0;
  const oy = Number.isFinite(item.layer_offset_y) ? item.layer_offset_y : 0;
  const sc = Number.isFinite(item.layer_scale) ? item.layer_scale : 1;
  const style: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    transform: `translate(${ox}%, ${oy}%) scale(${sc})`,
    transformOrigin: "center",
  };

  // Background is a full-plane fill (never a silhouette to tint).
  // A picked color/gradient replaces the item's default color_value entirely.
  if (item.category === "background") {
    const fill = tintColor
      ? (isGradientValue(tintColor) ? BRAND_GRADIENT_CSS : tintColor)
      : item.color_value;
    if (fill) {
      return <div aria-hidden="true" style={{ ...style, background: fill }} />;
    }
    return null;
  }

  if (src) {
    if (tintColor && !isGradientValue(tintColor)) {


      const { filter, useOverlay } = item.category === "outfit"
        ? outfitTintFromHex(tintColor)
        : hairTintFromHex(tintColor);
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
                background: tintColor,
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
        draggable={false}
        style={style}
        className="w-full h-full object-contain pointer-events-none select-none"
      />
    );
  }

  return null;
}

/**
 * Inner 82% × 82% (inset 9%) wrapper containing the ordered layer stack.
 * Must be placed inside a `position: relative` square container.
 */
export default function AvatarLayerStack({
  layers, reduceMotion,
}: {
  layers: StackLayer[];
  reduceMotion?: boolean;
}) {
  return (
    <div className="absolute" style={{ top: "9%", left: "9%", width: "82%", height: "82%" }}>
      {layers.map((l, i) => (
        <AvatarLayer
          key={`${l.item.id}-${l.sub ?? "main"}-${i}`}
          item={l.item}
          sub={l.sub}
          tintColor={l.tintColor}
          reduceMotion={reduceMotion}
        />
      ))}
    </div>
  );
}
