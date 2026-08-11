import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  SLIDE_ANIMATIONS, SLIDE_FONTS, SLIDE_FONT_SIZES, SLIDE_HIGHLIGHT_COLORS, SLIDE_TEXT_COLORS,
} from "@/lib/slide-typography";

import type { Block } from "@/lib/textbook-config";

interface Props {
  block: Block;
  onChange: (props: Record<string, any>) => void;
  /** Barvu/velikost/font nabízet jen u textových bloků. */
  showText?: boolean;
}

/** Per-blok typografie (velikost, barva, font) a animace vstupu v prezentaci. */
const BlockStyleControls = ({ block, onChange, showText = true }: Props) => {
  const p = block.props || {};
  const set = (patch: Record<string, any>) => onChange({ ...p, ...patch });

  return (
    <div className="mt-2 flex flex-wrap items-end gap-3 rounded-md border border-border bg-muted/30 p-2">
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

          <div>
            <Label className="text-[11px] text-muted-foreground">Barva textu</Label>
            <div className="mt-1 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => set({ color: null })}
                title="Podle tématu"
                className={`h-6 rounded border px-1.5 text-[10px] ${!p.color ? "border-primary text-foreground" : "border-border text-muted-foreground"}`}
              >
                Auto
              </button>
              {SLIDE_TEXT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set({ color: c })}
                  title={c}
                  aria-label={`Barva ${c}`}
                  className={`h-6 w-6 rounded-full border-2 transition-transform ${p.color === c ? "border-primary scale-110" : "border-border"}`}
                  style={{ background: c }}
                />
              ))}
              <input
                type="color"
                value={/^#/.test(p.color || "") ? p.color : "#000000"}
                onChange={(e) => set({ color: e.target.value })}
                className="h-6 w-9 cursor-pointer rounded border border-border bg-transparent"
                aria-label="Vlastní barva textu"
              />
            </div>
          </div>

          <div>
            <Label className="text-[11px] text-muted-foreground">Zvýrazňovač</Label>
            <div className="mt-1 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => set({ highlightColor: null })}
                title="Bez zvýraznění"
                className={`h-6 rounded border px-1.5 text-[10px] ${!p.highlightColor ? "border-primary text-foreground" : "border-border text-muted-foreground"}`}
              >
                Bez
              </button>
              {SLIDE_HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set({ highlightColor: c })}
                  title={c}
                  aria-label={`Zvýraznění ${c}`}
                  className={`h-6 w-6 rounded-full border-2 transition-transform ${p.highlightColor === c ? "border-primary scale-110" : "border-border"}`}
                  style={{ background: c }}
                />
              ))}
              <input
                type="color"
                value={/^#/.test(p.highlightColor || "") ? p.highlightColor : "#FEF08A"}
                onChange={(e) => set({ highlightColor: e.target.value })}
                className="h-6 w-9 cursor-pointer rounded border border-border bg-transparent"
                aria-label="Vlastní barva zvýraznění"
              />
            </div>
          </div>
        </>
      )}


      <div>
        <Label className="text-[11px] text-muted-foreground">Animace vstupu</Label>
        <Select
          value={p.animation || "none"}
          onValueChange={(v) => set({ animation: v === "none" ? null : v })}
        >
          <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SLIDE_ANIMATIONS.map((a) => (
              <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default BlockStyleControls;
