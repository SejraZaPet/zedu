import { Input } from "@/components/ui/input";
import type { WorksheetItemProps } from "./types";

export default function ShortAnswerItem({ item, value, onChange, disabled }: WorksheetItemProps) {
  return (
    <Input
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder="Vaše odpověď…"
      className="max-w-md"
    />
  );
}
