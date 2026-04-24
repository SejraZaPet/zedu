import { useState } from "react";
import { Lock, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  question: string;
  anonymous: boolean;
  allowMultiple?: boolean;
  onComplete?: () => void;
  onSubmitResponse?: (response: string) => void;
  sessionId?: string;
  questionIndex?: number;
  playerId?: string;
}

const WallActivity = ({
  question,
  anonymous,
  allowMultiple = false,
  onComplete,
  onSubmitResponse,
  sessionId,
  questionIndex,
  playerId,
}: Props) => {
  const [response, setResponse] = useState("");
  const [submittedCount, setSubmittedCount] = useState(0);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const handleSubmit = () => {
    const text = response.trim();
    if (!text) return;
    onSubmitResponse?.(text);

    if (sessionId && playerId) {
      supabase
        .from("game_responses")
        .insert({
          session_id: sessionId,
          player_id: playerId,
          question_index: questionIndex ?? 0,
          answer: { text },
          is_correct: true,
          score: 100,
          response_time_ms: 0,
        })
        .then(({ error }) => {
          if (error) console.error("Failed to save wall response:", error);
        });
    }

    setSubmittedCount((c) => c + 1);
    setJustSubmitted(true);
    setResponse("");
    onComplete?.();

    if (allowMultiple) {
      setTimeout(() => setJustSubmitted(false), 1500);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {question && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-4">
          <p className="font-medium text-base">{question}</p>
        </div>
      )}

      {!allowMultiple && submittedCount > 0 ? (
        <div className="flex items-center gap-2 px-4 py-3 bg-muted rounded-xl text-sm text-muted-foreground">
          <Lock className="w-4 h-4 flex-shrink-0" />
          <span>Odpověď odeslána – lze odeslat pouze jednu odpověď</span>
        </div>
      ) : (
        <div className="flex items-end gap-2 bg-muted rounded-2xl px-4 py-2 border border-border">
          <input
            type="text"
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={anonymous ? "Napište anonymní odpověď..." : "Napište odpověď..."}
            className="flex-1 bg-transparent outline-none text-sm py-1 text-foreground placeholder:text-muted-foreground"
          />
          <button
            onClick={handleSubmit}
            disabled={!response.trim()}
            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      )}

      {allowMultiple && justSubmitted && (
        <p className="text-xs text-muted-foreground text-center mt-2">
          ✓ Odesláno · Odeslaných odpovědí: {submittedCount}
        </p>
      )}
      {anonymous && !allowMultiple && submittedCount === 0 && (
        <p className="text-xs text-muted-foreground text-center mt-2">Vaše odpověď bude anonymní</p>
      )}
    </div>
  );
};

export default WallActivity;
