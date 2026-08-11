import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, Palette } from "lucide-react";
import { PRESENTATION_THEMES, getPresentationTheme } from "@/lib/presentation-themes";

interface Props {
  themeId: string;
  onChange: (themeId: string) => void;
}

const ThemeGalleryPopover = ({ themeId, onChange }: Props) => {
  const active = getPresentationTheme(themeId);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 gap-1" title="Vzhled prezentace">
          <Palette className="w-3.5 h-3.5" /> Vzhled
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-3" align="end">
        <p className="text-xs font-medium mb-2">
          Vzhled prezentace <span className="text-muted-foreground">– {active.name}</span>
        </p>
        <div className="grid grid-cols-2 gap-2">
          {PRESENTATION_THEMES.map((t) => {
            const selected = t.id === active.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onChange(t.id)}
                className={`relative rounded-lg border-2 p-0 overflow-hidden text-left transition-colors ${
                  selected ? "border-primary" : "border-border hover:border-muted-foreground/50"
                }`}
              >
                <div
                  className="h-16 px-3 py-2 flex flex-col justify-between"
                  style={{ background: t.backgroundStyle, fontFamily: t.fontFamily }}
                >
                  <span
                    className="text-sm font-bold"
                    style={{
                      background: `linear-gradient(90deg, ${t.primaryColor}, ${t.secondaryColor})`,
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      color: "transparent",
                    }}
                  >
                    Nadpis slidu
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-3 w-8"
                      style={{
                        background: t.primaryColor,
                        borderRadius: t.cornerStyle === "sharp" ? 0 : t.cornerStyle === "pill" ? 999 : 4,
                      }}
                    />
                    <span
                      className="h-3 w-5"
                      style={{
                        background: t.secondaryColor,
                        borderRadius: t.cornerStyle === "sharp" ? 0 : t.cornerStyle === "pill" ? 999 : 4,
                      }}
                    />
                    <span className="text-[10px]" style={{ color: t.isDark ? "#ffffffcc" : "#00000099" }}>
                      Aa text
                    </span>
                  </span>
                </div>
                <div className="px-2 py-1.5 bg-background">
                  <div className="text-xs font-medium flex items-center gap-1">
                    {t.name}
                    {selected && <Check className="w-3 h-3 text-primary" />}
                  </div>
                  <div className="text-[10px] text-muted-foreground leading-tight">{t.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ThemeGalleryPopover;
