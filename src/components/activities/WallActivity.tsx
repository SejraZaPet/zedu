import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Send } from "lucide-react";

interface Props {
  question: string;
  anonymous: boolean;
  onComplete?: () => void;
  onSubmitResponse?: (response: string) => void;
}

const WallActivity = ({ question, anonymous, onComplete, onSubmitResponse }: Props) => {
  const [response, setResponse] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!response.trim()) return;
    onSubmitResponse?.(response.trim());
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
        className="resize-none"
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
