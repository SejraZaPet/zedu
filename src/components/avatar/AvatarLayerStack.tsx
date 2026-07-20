import FrameOverlay from "@/components/avatar/FrameOverlay";
import EffectOverlay from "@/components/avatar/EffectOverlay";

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
};

export type StackLayer = {
  item: AvatarStackItem;
  sub?: "back" | "front";
  /** Hex color applied to hairstyle layers (brightness/contrast + optional mask overlay). */
  hairColor?: string | null;
};

export function hairTintFromHex(hex: string): { filter: string; useOverlay: boolean } {
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

export function AvatarLayer({
  item, sub, hairColor, reduceMotion,
}: {
  item: AvatarStackItem;
  sub?: "back" | "front";
  hairColor?: string | null;
  reduceMotion?: boolean;
}) {
  if (item.category === "frame") return <FrameOverlay slug={item.slug} reduceMotion={reduceMotion} />;
  if (item.category === "effect") return <EffectOverlay slug={item.slug} reduceMotion={reduceMotion} />;

  const src = sub === "back" ? item.image_url_back : item.image_url;
  const ox = Number.isFinite(item.layer_offset_x) ? item.layer_offset_x : 0;
  const oy = Number.isFinite(item.layer_offset_y) ? item.layer_offset_y : 0;
  const sc = Number.isFinite(item.layer_scale) ? item.layer_scale : 1;
  const style: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    transform: `translate(${ox}%, ${oy}%) scale(${sc})`,
    transformOrigin: "center",
  };

  if (src) {
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
          hairColor={l.hairColor}
          reduceMotion={reduceMotion}
        />
      ))}
    </div>
  );
}
