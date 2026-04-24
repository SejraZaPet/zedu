import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  question: string;
  anonymous: boolean;
  onComplete?: () => void;
  onSubmitResponse?: (response: string) => void;
  sessionId?: string;
  questionIndex?: number;
  playerId?: string;
}

const WallActivity = ({ question, anonymous, onComplete, onSubmitResponse, sessionId, questionIndex, playerId }: Props) => {
  const [response, setResponse] = useState("");
  const [submitted, setSubmitted] = useState(false);

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

    setSubmitted(true);
    onComplete?.();
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-8 gap-3">
        <CheckCircle2 className="w-12 h-12 text-primary" />
        <p className="text-lg font-semibold text-foreground">Odpověď odeslána!</p>
        {!anonymous && (
          <p className="text-sm text-muted-foreground">Vaše jméno bude zobrazeno u odpovědi.</p>
        )}
        {anonymous && (
          <p className="text-sm text-muted-foreground">Odpověď je anonymní.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-base font-medium text-foreground">
          {question || "Odpovězte na otázku učitele"}
        </p>
      </div>
      <Textarea
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        placeholder="Napište svou odpověď..."
        rows={4}
        className="resize-none wall-response-text"
      />
      <Button onClick={handleSubmit} disabled={!response.trim()} className="w-full gap-2">
        <Send className="w-4 h-4" />
        Odeslat odpověď
      </Button>
      {anonymous && (
        <p className="text-xs text-muted-foreground text-center">Vaše odpověď bude anonymní</p>
      )}
    </div>
  );
};

export default WallActivity;
