import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface Props {
  onRequest: () => Promise<string>;
  onSuggestion: (text: string) => void;
  disabled?: boolean;
}

/** Společné tlačítko návrhu; nic neukládá, pouze předá text do formuláře učitelky. */
export default function GradingFeedbackSuggestionButton({ onRequest, onSuggestion, disabled }: Props) {
  const [busy, setBusy] = useState(false);

  const suggest = async () => {
    setBusy(true);
    try {
      const feedback = await onRequest();
      onSuggestion(feedback);
      toast({ title: "Návrh vložen", description: "Před uložením ho můžete upravit." });
    } catch (error: any) {
      toast({
        title: "Návrh se nepodařilo vytvořit",
        description: error?.message || "Zkuste to prosím znovu.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={suggest}
      disabled={disabled || busy}
      className="min-h-11 gap-1.5"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
      Navrhnout pomocí AI
    </Button>
  );
}
