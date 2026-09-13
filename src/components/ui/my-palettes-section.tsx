import { useState } from "react";
import { MoreHorizontal, Plus, Check, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { gradientCss } from "@/lib/slide-gradient";
import {
  isGradientPaletteValue,
  useColorPalettes,
  type PaletteValue,
  type UserPalette,
} from "@/hooks/useColorPalettes";

interface Props {
  /** Aktuálně zvolená barva / přechod – nabídne se k uložení. */
  current: PaletteValue | null | undefined;
  /** Použití uložené hodnoty. */
  onPick: (value: PaletteValue) => void;
  /** Zobrazovat i přechody (v kontextech, kde je appka umí použít). */
  allowGradients?: boolean;
  className?: string;
}

const previewStyle = (v: PaletteValue): React.CSSProperties =>
  isGradientPaletteValue(v)
    ? { backgroundImage: gradientCss(v) || undefined }
    : { backgroundColor: v };

const sameValue = (a: PaletteValue, b: PaletteValue | null | undefined) => {
  if (!b) return false;
  if (isGradientPaletteValue(a) || isGradientPaletteValue(b)) {
    return (
      isGradientPaletteValue(a) &&
      isGradientPaletteValue(b) &&
      a.from.toLowerCase() === b.from.toLowerCase() &&
      a.to.toLowerCase() === b.to.toLowerCase()
    );
  }
  return a.toLowerCase() === (b as string).toLowerCase();
};

/**
 * Společná sekce „Moje palety“ – vlastní uložené barvy a přechody,
 * dostupné ve všech místech, kde appka nabízí výběr barvy.
 */
const MyPalettesSection = ({ current, onPick, allowGradients = true, className }: Props) => {
  const { palettes, savePalette, renamePalette, deletePalette } = useColorPalettes();
  const [naming, setNaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<UserPalette | null>(null);
  const [renameName, setRenameName] = useState("");
  const [busy, setBusy] = useState(false);

  const visible = palettes.filter(
    (p) => allowGradients || p.colors.some((c) => !isGradientPaletteValue(c)),
  );

  const doSave = async () => {
    if (!current) return;
    setBusy(true);
    const res = await savePalette(newName, [current]);
    setBusy(false);
    if (res.error) {
      toast({ title: "Paletu nešlo uložit", description: res.error, variant: "destructive" });
      return;
    }
    setNaming(false);
    setNewName("");
    toast({ title: "Paleta uložena" });
  };

  const doRename = async () => {
    if (!renaming) return;
    setBusy(true);
    const res = await renamePalette(renaming.id, renameName);
    setBusy(false);
    if (res.error) {
      toast({ title: "Přejmenování selhalo", description: res.error, variant: "destructive" });
      return;
    }
    setRenaming(null);
  };

  return (
    <div className={className}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Moje palety</p>
        {current && !naming && (
          <button
            type="button"
            onClick={() => setNaming(true)}
            className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10px] text-primary hover:bg-muted"
          >
            <Plus className="h-3 w-3" /> Uložit jako paletu
          </button>
        )}
      </div>

      {naming && (
        <div className="mb-2 space-y-1.5 rounded-md border border-border bg-muted/40 p-2">
          <div className="flex items-center gap-2">
            <span
              className="h-5 w-5 shrink-0 rounded border border-border"
              style={current ? previewStyle(current) : undefined}
              aria-hidden
            />
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void doSave();
                }
              }}
              placeholder="Název palety"
              aria-label="Název palety"
              className="h-7 text-xs"
            />
          </div>
          <div className="flex justify-end gap-1">
            <button
              type="button"
              onClick={() => { setNaming(false); setNewName(""); }}
              className="rounded px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
            >
              Zrušit
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void doSave()}
              className="rounded bg-primary px-2 py-0.5 text-[11px] text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Uložit
            </button>
          </div>
        </div>
      )}

      {visible.length === 0 && !naming && (
        <p className="text-[10px] text-muted-foreground">
          Zatím žádné palety. Vyber barvu a ulož ji.
        </p>
      )}

      <div className="space-y-1">
        {visible.map((p) => {
          const first = p.colors[0];
          if (renaming?.id === p.id) {
            return (
              <div key={p.id} className="flex items-center gap-1">
                <Input
                  autoFocus
                  value={renameName}
                  onChange={(e) => setRenameName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); void doRename(); }
                    if (e.key === "Escape") setRenaming(null);
                  }}
                  aria-label="Nový název palety"
                  className="h-7 text-xs"
                />
                <button type="button" disabled={busy} onClick={() => void doRename()} aria-label="Potvrdit název" className="rounded p-1 hover:bg-muted">
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => setRenaming(null)} aria-label="Zrušit přejmenování" className="rounded p-1 hover:bg-muted">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          }
          return (
            <div key={p.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => first && onPick(first)}
                title={p.name}
                className={`flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-1 text-left text-xs hover:bg-muted ${
                  first && sameValue(first, current ?? null) ? "ring-1 ring-primary" : ""
                }`}
              >
                <span className="flex shrink-0 items-center gap-0.5">
                  {p.colors.slice(0, 4).map((c, i) => (
                    <span
                      key={i}
                      className="h-5 w-5 rounded border border-border"
                      style={previewStyle(c)}
                      aria-hidden
                    />
                  ))}
                </span>
                <span className="truncate">{p.name}</span>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Možnosti palety ${p.name}`}
                    className="rounded p-1 text-muted-foreground hover:bg-muted"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      setRenaming(p);
                      setRenameName(p.name);
                    }}
                  >
                    Přejmenovat
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onSelect={async (e) => {
                      e.preventDefault();
                      const res = await deletePalette(p.id);
                      if (res.error) {
                        toast({ title: "Smazání selhalo", description: res.error, variant: "destructive" });
                      }
                    }}
                  >
                    Smazat
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MyPalettesSection;
