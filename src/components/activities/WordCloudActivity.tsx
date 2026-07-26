import { useState } from "react";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  question: string;
  onComplete?: () => void;
  sessionId?: string;
  questionIndex?: number;
  playerId?: string;
  joinToken?: string;
}

const MAX_LEN = 30;

const WordCloudActivity = ({
  question,
  onComplete,
  sessionId,
  questionIndex,
  playerId,
  joinToken,
}: Props) => {
  const [value, setValue] = useState("");
  const [submittedCount, setSubmittedCount] = useState(0);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const handleSubmit = () => {
    const text = value.trim().slice(0, MAX_LEN);
    if (!text) return;

    if (sessionId && playerId) {
      supabase.functions
        .invoke("submit-activity-response", {
          body: {
            joinToken,
            sessionId,
            questionIndex: questionIndex ?? 0,
            isCorrect: true,
            score: 100,
            responseTimeMs: 0,
            answerData: { text },
          },
        })
        .then(({ error }) => {
          if (error) console.error("Failed to save wordcloud response:", error);
        });
    }

    setSubmittedCount((c) => c + 1);
    setJustSubmitted(true);
    setValue("");
    onComplete?.();
    setTimeout(() => setJustSubmitted(false), 1500);
  };

  return (
    <div className="flex flex-col h-full">
      {question && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-4">
          <p className="font-medium text-base">{question}</p>
        </div>
      )}

      <div className="flex items-end gap-2 bg-muted rounded-2xl px-4 py-2 border border-border">
        <input
          type="text"
          value={value}
          maxLength={MAX_LEN}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Napište slovo nebo krátkou frázi..."
          className="flex-1 bg-transparent outline-none text-sm py-1 text-foreground placeholder:text-muted-foreground"
        />
        <button
          onClick={handleSubmit}
          disabled={!value.trim()}
          className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
        >
          <Send className="w-4 h-4 text-white" />
        </button>
      </div>
      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
        <span>{value.length}/{MAX_LEN}</span>
        {justSubmitted ? (
          <span>✓ Odesláno · celkem: {submittedCount}</span>
        ) : submittedCount > 0 ? (
          <span>Odesláno: {submittedCount} · můžete přidat další</span>
        ) : (
          <span>Můžete poslat i více slov</span>
        )}
      </div>
    </div>
  );
};

export default WordCloudActivity;
