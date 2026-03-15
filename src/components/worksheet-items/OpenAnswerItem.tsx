import { Textarea } from "@/components/ui/textarea";
import type { WorksheetItemProps } from "./types";

export default function OpenAnswerItem({ item, value, onChange, disabled }: WorksheetItemProps) {
  return (
    <Textarea
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder="Rozepište svou odpověď…"
      rows={5}
      className="max-w-lg"
    />
  );
}
