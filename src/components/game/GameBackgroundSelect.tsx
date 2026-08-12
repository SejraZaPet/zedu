import { useMemo } from "react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useGameBackgrounds } from "@/hooks/useGameBackgrounds";
import { currentSeasonKey, seasonLabel, subjectLabel, type GameBackground } from "@/lib/game-backgrounds";

interface Props {
  /** Aktuálně vybrané pozadí (URL) nebo null pro univerzální */
  value: string | null;
  onChange: (url: string | null) => void;
  /** Klíč předmětu lekce – jeho pozadí se označí jako doporučené */
  subjectKey?: string | null;
  /** Obor školy – pokud je znám */
  fieldKey?: string | null;
  label?: string;
}

const NONE = "__none__";

const GameBackgroundSelect = ({ value, onChange, subjectKey, fieldKey, label = "Pozadí" }: Props) => {
  const { backgrounds, loading } = useGameBackgrounds();
  const season = currentSeasonKey();

  const groups = useMemo(() => {
    const by = (cat: string) => backgrounds.filter((b) => b.category === cat);
    const sortRecommended = (list: GameBackground[], isRec: (b: GameBackground) => boolean) =>
      [...list].sort((a, b) => Number(isRec(b)) - Number(isRec(a)));
    return {
      universal: by("universal"),
      subject: sortRecommended(by("subject"), (b) => !!subjectKey && b.subject_key === subjectKey),
      season: sortRecommended(by("season"), (b) => b.season_key === season),
      field: sortRecommended(by("field"), (b) => !!fieldKey && b.field_key === fieldKey),
    };
  }, [backgrounds, subjectKey, fieldKey, season]);

  const renderItems = (list: GameBackground[], recommended: (b: GameBackground) => boolean, suffix: (b: GameBackground) => string) =>
    list.map((b) => (
      <SelectItem key={b.id} value={b.image_url}>
        {b.name}
        {suffix(b) ? ` · ${suffix(b)}` : ""}
        {recommended(b) ? " · doporučeno" : ""}
      </SelectItem>
    ));

  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
        <SelectTrigger>
          <SelectValue placeholder="Univerzální (výchozí)" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectItem value={NONE}>Univerzální (výchozí)</SelectItem>
          {loading && <SelectItem value="__loading__" disabled>Načítání…</SelectItem>}
          {groups.universal.length > 0 && (
            <SelectGroup>
              <SelectLabel>Univerzální</SelectLabel>
              {renderItems(groups.universal, () => false, () => "")}
            </SelectGroup>
          )}
          {groups.subject.length > 0 && (
            <SelectGroup>
              <SelectLabel>Podle předmětu</SelectLabel>
              {renderItems(
                groups.subject,
                (b) => !!subjectKey && b.subject_key === subjectKey,
                (b) => subjectLabel(b.subject_key),
              )}
            </SelectGroup>
          )}
          {groups.season.length > 0 && (
            <SelectGroup>
              <SelectLabel>Podle ročního období</SelectLabel>
              {renderItems(groups.season, (b) => b.season_key === season, (b) => seasonLabel(b.season_key))}
            </SelectGroup>
          )}
          {groups.field.length > 0 && (
            <SelectGroup>
              <SelectLabel>Podle oboru</SelectLabel>
              {renderItems(groups.field, (b) => !!fieldKey && b.field_key === fieldKey, (b) => b.field_key ?? "")}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>
    </div>
  );
};

export default GameBackgroundSelect;
