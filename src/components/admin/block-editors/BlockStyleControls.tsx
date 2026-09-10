import { Palette } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  SLIDE_FONTS, SLIDE_FONT_SIZES,
} from "@/lib/slide-typography";
import { BLOCK_BACKGROUNDS, getBlockCustomBackground } from "@/lib/block-backgrounds";
import ColorPalettePopover from "@/components/ui/color-palette-popover";

import type { Block } from "@/lib/textbook-config";

interface Props {
  block: Block;
  onChange: (props: Record<string, any>) => void;
  /** Barvu/velikost/font nabízet jen u textových bloků. */
  showText?: boolean;
  /** Kompaktní podoba pro plovoucí lištu nad blokem. */
  compact?: boolean;
}

/** Per-blok typografie (velikost, barva, font, pozadí) pro editor lekce/učebnice. */
const BlockStyleControls = ({ block, onChange, showText = true, compact = false }: Props) => {
  const p = block.props || {};
  const set = (patch: Record<string, any>) => onChange({ ...p, ...patch });
  const bgKey = (p.backgroundStyle as string) || "none";

  return (
    <div
      className={
        compact
          ? "flex flex-wrap items-end gap-3"
          : "mt-2 flex flex-wrap items-end gap-3 rounded-md border border-border bg-muted/30 p-2"
      }
    >
      {block.type === "heading" && (
        <div>
          <Label className="text-[11px] text-muted-foreground">Úroveň</Label>
          <Select
            value={String(p.level ?? 2)}
            onValueChange={(v) => set({ level: Number(v) })}
          >
            <SelectTrigger className="h-8 w-[80px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4].map((l) => (
                <SelectItem key={l} value={String(l)}>{`H${l}`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {showText && (
        <>
          <div>
            <Label className="text-[11px] text-muted-foreground">Velikost</Label>
            <Select
              value={p.fontSize ? String(p.fontSize) : "inherit"}
              onValueChange={(v) => set({ fontSize: v === "inherit" ? null : Number(v) })}
            >
              <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="inherit">Výchozí</SelectItem>
                {SLIDE_FONT_SIZES.map((s) => (
                  <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-[11px] text-muted-foreground">Font</Label>
            <Select
              value={p.fontFamily || "inherit"}
              onValueChange={(v) => set({ fontFamily: v === "inherit" ? null : v })}
            >
              <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="inherit">Podle tématu</SelectItem>
                {SLIDE_FONTS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    <span style={{ fontFamily: f.value }}>{f.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

        </>
      )}

      <div>
        <Label className="text-[11px] text-muted-foreground">Pozadí bloku</Label>
        <div className="mt-1 flex items-center gap-1.5">
          {BLOCK_BACKGROUNDS.map((opt) => {
            const active = !customBg && bgKey === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => set({
                  backgroundStyle: opt.key === "none" ? null : opt.key,
                  backgroundColor: null,
                })}
                title={opt.label}
                aria-label={`Pozadí ${opt.label}`}
                aria-pressed={active}
                className={`h-6 rounded border-2 px-1.5 text-[10px] transition-transform ${active ? "border-primary scale-105" : "border-border"}`}
                style={{
                  background: opt.key === "none" ? "transparent" : opt.bg,
                  borderLeft: opt.accent ? `4px solid ${opt.accent}` : undefined,
                  color: "#171717",
                }}
              >
                {opt.label}
              </button>
            );
          })}

          <ColorPalettePopover
            value={customBg}
            clearLabel="Bez vlastní barvy"
            onChange={(v) => set({ backgroundColor: v, backgroundStyle: v ? null : bgKey === "none" ? null : bgKey })}
            trigger={(
              <button
                type="button"
                title="Vlastní barva pozadí"
                aria-label="Vlastní barva pozadí"
                aria-pressed={!!customBg}
                className={`flex h-6 items-center gap-1 rounded border-2 px-1.5 text-[10px] transition-transform ${customBg ? "border-primary scale-105" : "border-border text-muted-foreground"}`}
                style={customBg ? { background: customBg, color: "#171717" } : undefined}
              >
                <Palette className="h-3 w-3" />
                Vlastní
              </button>
            )}
          />
        </div>
      </div>
    </div>
  );
};

export default BlockStyleControls;
