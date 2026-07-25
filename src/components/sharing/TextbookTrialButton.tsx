import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Clock, Loader2, PlayCircle } from "lucide-react";
import {
  getTextbookTrial,
  activateTextbookTrial,
  type TextbookTrial,
} from "@/lib/content-shares";
import { useToast } from "@/hooks/use-toast";
import PublicTextbookPreviewDialog from "./PublicTextbookPreviewDialog";

function daysLeft(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

interface Props {
  textbookId: string;
  textbookTitle: string;
}

export default function TextbookTrialButton({ textbookId, textbookTitle }: Props) {
  const { toast } = useToast();
  const [trial, setTrial] = useState<TextbookTrial | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTrial(await getTextbookTrial(textbookId));
    } finally {
      setLoading(false);
    }
  }, [textbookId]);

  useEffect(() => {
    load();
  }, [load]);

  const active = trial ? new Date(trial.expires_at).getTime() > Date.now() : false;
  const expired = trial && !active;

  const handleClick = async () => {
    if (active && trial) {
      setOpen(true);
      return;
    }
    if (expired) {
      toast({
        title: "Zkušební přístup vypršel",
        description: "Přidejte si učebnici do materiálů natrvalo zdarma.",
      });
      return;
    }
    setActivating(true);
    try {
      const t = await activateTextbookTrial(textbookId);
      setTrial(t);
      toast({ title: "Zkušební přístup aktivován", description: "Máte 3 dny na prohlédnutí všech lekcí." });
      setOpen(true);
    } catch (e: any) {
      toast({ title: "Aktivace selhala", description: e.message, variant: "destructive" });
    } finally {
      setActivating(false);
    }
  };

  if (loading) {
    return (
      <Button size="sm" variant="outline" disabled>
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        Načítání…
      </Button>
    );
  }

  if (active && trial) {
    const d = daysLeft(trial.expires_at);
    return (
      <>
        <Button size="sm" variant="secondary" onClick={handleClick}>
          <PlayCircle className="w-4 h-4 mr-2" />
          Zkušební přístup aktivní (zbývá {d} {d === 1 ? "den" : d < 5 ? "dny" : "dní"})
        </Button>
        <PublicTextbookPreviewDialog
          open={open}
          onOpenChange={setOpen}
          textbookId={textbookId}
          textbookTitle={textbookTitle}
          mode="trial"
          trialExpiresAt={trial.expires_at}
        />
      </>
    );
  }

  if (expired) {
    return (
      <Button size="sm" variant="outline" disabled>
        <Clock className="w-4 h-4 mr-2" />
        Zkušební přístup vypršel
      </Button>
    );
  }

  return (
    <Button size="sm" variant="outline" onClick={handleClick} disabled={activating}>
      {activating ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <Clock className="w-4 h-4 mr-2" />
      )}
      Vyzkoušet na 3 dny
    </Button>
  );
}
