import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Check, CheckCircle2 } from "lucide-react";
import { pollOptionId, type PollOption } from "@/lib/poll-options";

export type { PollOption } from "@/lib/poll-options";

interface Props {
  question: string;
  options: PollOption[];
  allowMultiple?: boolean;
  sessionId?: string;
  questionIndex?: number;
  playerId?: string;
  joinToken?: string;
  onComplete?: () => void;
}

const PollActivity = ({
  question,
  options,
  allowMultiple = false,
  sessionId,
  questionIndex,
  playerId,
  joinToken,
  onComplete,
}: Props) => {
  const [selected, setSelected] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const toggle = (id: string) => {
    if (submitted) return;
    if (allowMultiple) {
      setSelected((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    } else {
      setSelected([id]);
    }
  };

  const handleSubmit = async () => {
    if (selected.length === 0 || submitting) return;
    setSubmitting(true);
    if (sessionId && playerId) {
      const { error } = await supabase.functions.invoke("submit-activity-response", {
        body: {
          joinToken,
          sessionId,
          questionIndex: questionIndex ?? 0,
          isCorrect: true,
          score: 100,
          responseTimeMs: 0,
          answerData: { selectedOptions: selected },
        },
      });
      if (error) console.error("Failed to save poll response:", error);
    }
    setSubmitted(true);
    setSubmitting(false);
    onComplete?.();
  };

  if (submitted) {
    const chosenOptions = options.filter((option, index) => selected.includes(pollOptionId(option, index)));
    return (
      <div className="my-auto flex w-full flex-col items-center rounded-2xl border border-border bg-card p-5 text-center text-card-foreground shadow-xl">
        <CheckCircle2 className="mb-3 h-14 w-14 text-primary" aria-hidden="true" />
        <p className="text-xl font-bold">Hlas odeslán</p>
        <p className="mt-4 text-sm font-medium text-muted-foreground">
          {chosenOptions.length > 1 ? "Tvoje odpovědi" : "Tvoje odpověď"}
        </p>
        <div className="mt-2 grid w-full gap-2">
          {chosenOptions.map((option) => (
            <div
              key={pollOptionId(option, options.indexOf(option))}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-[3px] border-primary bg-foreground p-3 text-lg font-bold text-background"
            >
              <Check className="h-6 w-6 shrink-0" strokeWidth={3} aria-hidden="true" />
              <span className="min-w-0 break-words font-bold">{option.text}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Čekejte na výsledky…</p>
      </div>
    );
  }

  return (
    <div data-testid="poll-activity" className="flex h-full min-h-0 flex-col">
      {question && (
        <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-4 text-foreground">
          <p className="text-lg font-medium">{question}</p>
        </div>
      )}
      {allowMultiple && (
        <p className="mb-2 text-sm text-muted-foreground">
          Můžete vybrat více možností
        </p>
      )}
      <div className="mb-3 grid grid-cols-1 gap-2">
        {options.map((option, index) => {
          const optionId = pollOptionId(option, index);
          const isSelected = selected.includes(optionId);
          return (
            <button
              key={optionId}
              type="button"
              onClick={() => toggle(optionId)}
              aria-pressed={isSelected}
              className={`flex min-h-14 w-full items-center gap-3 rounded-xl p-3 text-left text-lg transition-all ${
                isSelected
                  ? "border-[3px] border-primary bg-foreground font-bold text-background ring-2 ring-primary/30"
                  : "border-2 border-border bg-card font-medium text-card-foreground hover:border-primary/50"
              }`}
            >
              <span
                aria-hidden="true"
                className={`flex h-6 w-6 shrink-0 items-center justify-center border-2 ${allowMultiple ? "rounded-md" : "rounded-full"} ${
                  isSelected ? "border-background bg-background text-foreground" : "border-muted-foreground/50"
                }`}
              >
                {isSelected && <Check className="h-4 w-4" strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1 break-words">{option.text}</span>
            </button>
          );
        })}
      </div>
      <div
        className="sticky bottom-0 z-20 mt-auto bg-card/95 pt-2 backdrop-blur"
        style={{ paddingBottom: "max(0.25rem, env(safe-area-inset-bottom))" }}
      >
        <Button
          variant="outline"
          onClick={handleSubmit}
          disabled={selected.length === 0 || submitting}
          className="h-12 min-h-12 w-full border-primary bg-foreground text-lg font-bold text-background shadow-lg hover:bg-foreground/90"
        >
          Hlasovat
        </Button>
      </div>
    </div>
  );
};

export default PollActivity;
