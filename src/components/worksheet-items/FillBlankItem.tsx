import { Input } from "@/components/ui/input";
import type { WorksheetItemProps } from "./types";

export default function FillBlankItem({ item, value, onChange, disabled }: WorksheetItemProps) {
  const blanks = (item.blankText ?? "").split("___");
  const blankCount = blanks.length - 1;
  const currentAnswers: string[] = Array.isArray(value) ? value : Array(blankCount).fill("");

  return (
    <div className="space-y-2">
      <p className="text-sm leading-relaxed">
        {blanks.map((segment, i) => (
          <span key={i}>
            {segment}
            {i < blankCount && (
              <Input
                className="inline-block w-32 mx-1 h-8 text-sm"
                value={currentAnswers[i] ?? ""}
                disabled={disabled}
                placeholder={`(${i + 1})`}
                onChange={(e) => {
                  const next = [...currentAnswers];
                  next[i] = e.target.value;
                  onChange(next);
                }}
              />
            )}
          </span>
        ))}
      </p>
    </div>
  );
}
