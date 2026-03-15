import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import type { WorksheetItemProps } from "./types";

export default function TrueFalseItem({ item, value, onChange, disabled }: WorksheetItemProps) {
  return (
    <RadioGroup
      value={typeof value === "string" ? value : ""}
      onValueChange={(v) => onChange(v)}
      disabled={disabled}
      className="flex gap-4"
    >
      {["true", "false"].map((val) => (
        <div key={val} className="flex items-center gap-2 p-3 rounded-lg border border-border">
          <RadioGroupItem value={val} id={`${item.id}-${val}`} />
          <Label htmlFor={`${item.id}-${val}`} className="cursor-pointer">
            {val === "true" ? "Pravda" : "Nepravda"}
          </Label>
        </div>
      ))}
    </RadioGroup>
  );
}
