import { useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SLIDE_ICON_NAMES, SLIDE_ICONS } from "@/lib/slide-icons";
import { PRESENTATION_THEMES, getPresentationTheme } from "@/lib/presentation-themes";

interface Props {
  trigger: React.ReactNode;
  /** Aktuální téma prezentace – nabídne se jeho barva. */
  themeId?: string;
  onPick: (icon: { name: string; color: string }) => void;
}

const PRESET_COLORS = ["currentColor"];

const IconPickerDialog = ({ trigger, themeId, onPick }: Props) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const theme = getPresentationTheme(themeId);
  const [color, setColor] = useState<string>(theme.primaryColor);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const names = q ? SLIDE_ICON_NAMES.filter((n) => n.toLowerCase().includes(q)) : SLIDE_ICON_NAMES;
    return names.slice(0, 120);
  }, [query]);

  const swatches = useMemo(() => {
    const list = [theme.primaryColor, theme.secondaryColor, "#111111", "#FFFFFF", "#EF4444", "#F59E0B", "#10B981", "#3B82F6"];
    return Array.from(new Set([...list, ...PRESET_COLORS]));
  }, [theme]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Vložit ikonu</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Hledat ikonu (např. star, brain, leaf)…"
          />

          <div>
            <Label className="text-xs">Barva ikony</Label>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              {swatches.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  title={c}
                  className={`h-7 w-7 rounded-full border-2 transition-transform ${
                    color === c ? "border-primary scale-110" : "border-border"
                  }`}
                  style={{ background: c === "currentColor" ? "transparent" : c }}
                />
              ))}
              <input
                type="color"
                value={/^#/.test(color) ? color : "#000000"}
                onChange={(e) => setColor(e.target.value)}
                className="h-7 w-10 cursor-pointer rounded border border-border bg-transparent"
                aria-label="Vlastní barva ikony"
              />
              {swatches.includes(theme.primaryColor) && (
                <span className="text-[11px] text-muted-foreground">
                  Podle tématu: {PRESENTATION_THEMES.find((t) => t.id === theme.id)?.name}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-8 sm:grid-cols-10 gap-1.5 max-h-[45vh] overflow-y-auto p-1">
            {results.map((name) => {
              const Icon = SLIDE_ICONS[name];
              return (
                <button
                  key={name}
                  type="button"
                  title={name}
                  onClick={() => {
                    onPick({ name, color });
                    setOpen(false);
                  }}
                  className="flex aspect-square items-center justify-center rounded-md border border-border hover:border-primary hover:bg-muted/60 transition-colors"
                >
                  <Icon className="h-5 w-5" style={{ color }} />
                </button>
              );
            })}
            {results.length === 0 && (
              <p className="col-span-full text-sm text-muted-foreground py-6 text-center">
                Nic nenalezeno – zkuste anglický název ikony.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default IconPickerDialog;
