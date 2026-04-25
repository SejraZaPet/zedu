import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export interface PollOption {
  id: string;
  text: string;
}

interface Props {
  question: string;
  options: PollOption[];
  allowMultiple?: boolean;
  sessionId?: string;
  questionIndex?: number;
  playerId?: string;
  onComplete?: () => void;
}

const PollActivity = ({
  question,
  options,
  allowMultiple = false,
  sessionId,
  questionIndex,
  playerId,
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
      const { error } = await supabase.from("game_responses").insert({
        session_id: sessionId,
        player_id: playerId,
        question_index: questionIndex ?? 0,
        answer: { selectedOptions: selected },
        is_correct: true,
        score: 100,
        response_time_ms: 0,
      });
      if (error) console.error("Failed to save poll response:", error);
    }
    setSubmitted(true);
    setSubmitting(false);
    onComplete?.();
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <CheckCircle2 className="w-14 h-14 text-primary mb-3" />
        <p className="text-lg font-semibold text-foreground">Hlas odeslán!</p>
        <p className="text-sm text-muted-foreground mt-1">Čekejte na výsledky…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {question && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-4">
          <p className="font-medium text-base">{question}</p>
        </div>
      )}
      {allowMultiple && (
        <p className="text-xs text-muted-foreground mb-2">
          Můžete vybrat více možností
        </p>
      )}
      <div className="space-y-2 mb-4">
        {options.map((option) => {
          const isSelected = selected.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => toggle(option.id)}
              className={`w-full p-4 rounded-xl border-2 text-left font-medium transition-all ${
                isSelected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              {option.text}
            </button>
          );
        })}
      </div>
      <Button
        onClick={handleSubmit}
        disabled={selected.length === 0 || submitting}
        className="w-full"
      >
        Hlasovat
      </Button>
    </div>
  );
};

export default PollActivity;
