import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectFilterProps {
  label: string;
  allLabel: string;
  values: string[];
  options: MultiSelectOption[];
  onChange: (values: string[]) => void;
}

export default function MultiSelectFilter({
  label,
  allLabel,
  values,
  options,
  onChange,
}: MultiSelectFilterProps) {
  const selected = options.filter((option) => values.includes(option.value));
  const selectedText = selected.length === 0
    ? allLabel
    : selected.length === 1
    ? selected[0].label
    : `${selected.length} vybráno`;

  function toggle(value: string) {
    if (values.includes(value)) {
      onChange(values.filter((item) => item !== value));
    } else {
      onChange([...values, value]);
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-10 justify-between px-3 font-normal">
          <span className="min-w-0 truncate text-left">
            <span className="text-muted-foreground">{label}: </span>
            {selectedText}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <div className="text-sm font-medium">{label}</div>
          {values.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => onChange([])}>
              Vymazat
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-64">
          <div className="space-y-1 p-1">
            {options.map((option) => {
              const checked = values.includes(option.value);
              return (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted/60",
                    checked && "bg-muted/50",
                  )}
                >
                  <Checkbox checked={checked} onCheckedChange={() => toggle(option.value)} />
                  <span className="flex-1">{option.label}</span>
                  {checked && <Check className="h-4 w-4 text-primary" />}
                </label>
              );
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}