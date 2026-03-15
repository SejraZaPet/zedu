import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { WorksheetItemProps } from "./types";

export default function MatchingItem({ item, value, onChange, disabled }: WorksheetItemProps) {
  const pairs = item.matchPairs ?? [];
  const rights = pairs.map((p) => p.right);
  const currentAnswers: string[] = Array.isArray(value) ? value : Array(pairs.length).fill("");

  return (
    <div className="space-y-3">
      {pairs.map((pair, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-sm font-medium min-w-[120px]">{pair.left}</span>
          <span className="text-muted-foreground">→</span>
          <Select
            value={currentAnswers[i] ?? ""}
            onValueChange={(v) => {
              const next = [...currentAnswers];
              next[i] = v;
              onChange(next);
            }}
            disabled={disabled}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Vyberte…" />
            </SelectTrigger>
            <SelectContent>
              {rights.map((r, ri) => (
                <SelectItem key={ri} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );
}
