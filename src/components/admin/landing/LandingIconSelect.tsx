import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { LANDING_ICON_NAMES, getLandingIcon } from "@/lib/landing-icons";

interface Props {
  label?: string;
  value: string;
  onChange: (name: string) => void;
}

export function LandingIconSelect({ label, value, onChange }: Props) {
  const Preview = getLandingIcon(value);
  return (
    <div className="space-y-1">
      {label && <Label className="text-xs">{label}</Label>}
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded bg-muted flex items-center justify-center shrink-0">
          <Preview className="w-4 h-4 text-foreground" />
        </div>
        <Select value={value || ""} onValueChange={onChange}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Vyberte ikonu…" />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            {LANDING_ICON_NAMES.map((name) => {
              const Icon = getLandingIcon(name);
              return (
                <SelectItem key={name} value={name}>
                  <span className="inline-flex items-center gap-2">
                    <Icon className="w-4 h-4" /> {name}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
