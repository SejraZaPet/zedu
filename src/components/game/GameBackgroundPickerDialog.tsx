import { useMemo, useState, type ReactNode } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, ImageOff } from "lucide-react";
import { useGameBackgrounds } from "@/hooks/useGameBackgrounds";
import {
  BACKGROUND_CATEGORY_LABEL, type BackgroundCategory, type GameBackground,
} from "@/lib/game-backgrounds";

const CATEGORY_ORDER: BackgroundCategory[] = ["universal", "subject", "season", "field"];

interface Props {
  trigger: ReactNode;
  /** Vrací URL vybraného obrázku – zapisuje se do stejného pole jako vlastní obrázek pozadí. */
  onPick: (imageUrl: string) => void;
}

/** Výběr pozadí z appkou spravovaných herních pozadí (game_backgrounds, jen aktivní). */
export const GameBackgroundPickerDialog = ({ trigger, onPick }: Props) => {
  const [open, setOpen] = useState(false);
  const { backgrounds, loading } = useGameBackgrounds();

  const groups = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        items: backgrounds.filter((b) => b.category === category),
      })).filter((g) => g.items.length > 0),
    [backgrounds],
  );

  const pick = (bg: GameBackground) => {
    onPick(bg.image_url);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Herní pozadí</DialogTitle>
          <DialogDescription>
            Vyberte pozadí ze sady spravované v aplikaci. Nastaví se jako obrázek pozadí tohoto slidu.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
          {loading && (
            <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Načítání herních pozadí…
            </p>
          )}

          {!loading && groups.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-10 text-center">
              <ImageOff className="h-8 w-8 text-muted-foreground" />
              <p className="max-w-sm text-sm text-muted-foreground">
                Zatím nejsou nahraná žádná herní pozadí – nahraj je v adminu (Vzhled webu → Herní pozadí).
              </p>
            </div>
          )}

          {!loading &&
            groups.map((group) => (
              <section key={group.category}>
                <h3 className="mb-2 text-sm font-semibold text-foreground">
                  {BACKGROUND_CATEGORY_LABEL[group.category]}
                </h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {group.items.map((bg) => (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={() => pick(bg)}
                      className="group overflow-hidden rounded-lg border border-border text-left transition-colors hover:border-primary"
                      title={bg.name}
                    >
                      <img
                        src={bg.image_url}
                        alt={bg.name}
                        loading="lazy"
                        className="h-20 w-full bg-muted object-cover transition-transform group-hover:scale-105"
                      />
                      <span className="block truncate px-2 py-1 text-xs text-foreground">{bg.name}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GameBackgroundPickerDialog;
