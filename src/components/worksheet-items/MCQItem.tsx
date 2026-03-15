import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import type { WorksheetItemProps } from "./types";

const CHOICE_LETTERS = "ABCDEFGHIJKLMNOP";

export default function MCQItem({ item, value, onChange, disabled, showResults, answerKeyEntry }: WorksheetItemProps) {
  const correctVal = answerKeyEntry ? String(answerKeyEntry.correctAnswer) : "";

  return (
    <RadioGroup
      value={typeof value === "string" ? value : ""}
      onValueChange={(v) => onChange(v)}
      disabled={disabled}
      className="space-y-2"
    >
      {(item.choices ?? []).map((choice, i) => {
        const val = CHOICE_LETTERS[i];
        const isCorrect = showResults && correctVal === val;
        const isWrong = showResults && value === val && !isCorrect;
        return (
          <div
            key={i}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
              isCorrect ? "border-green-500 bg-green-50" : isWrong ? "border-red-300 bg-red-50" : "border-border"
            }`}
          >
            <RadioGroupItem value={val} id={`${item.id}-${val}`} />
            <Label htmlFor={`${item.id}-${val}`} className="flex-1 cursor-pointer text-sm">
              <span className="font-semibold mr-2 text-muted-foreground">{val}.</span>
              {choice}
            </Label>
          </div>
        );
      })}
    </RadioGroup>
  );
}
