import { useState } from "react";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface BetaBadgeProps {
  /** Volitelný popis místa, odkud zpětná vazba přišla (jinak se použije URL). */
  context?: string;
  className?: string;
}

/**
 * Malý štítek "BETA" pro nové, ještě neodladěné funkce.
 * Klik otevře popover s možností poslat zpětnou vazbu (edge funkce submit-feedback).
 */
export function BetaBadge({ context, className }: BetaBadgeProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const pageContext = [context, typeof window !== "undefined" ? window.location.pathname : ""]
    .filter(Boolean)
    .join(" · ");

  const handleSend = async () => {
    const text = message.trim();
    if (!text) {
      toast({ title: "Napište prosím krátkou zprávu", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("submit-feedback", {
        body: { message: text, page_context: pageContext },
      });
      if (error) throw error;
      if (data && (data as { error?: string }).error) {
        throw new Error((data as { error?: string }).error);
      }
      toast({
        title: "Děkujeme! 💜",
        description: "Zprávu jsme dostali a podíváme se na to.",
      });
      setMessage("");
      setOpen(false);
    } catch (e) {
      toast({
        title: "Odeslání se nepodařilo",
        description: "Zkuste to prosím znovu, nebo nám napište na info@zedu.cz.",
        variant: "destructive",
      });
      console.error("submit-feedback failed", e);
    } finally {
      setSending(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Beta funkce – poslat zpětnou vazbu"
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            className,
          )}
        >
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          Beta
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-3">
        <p className="text-sm text-muted-foreground">
          Tahle funkce je nová a možná není ještě úplně doladěná. Něco nefunguje? Napište nám, díky
          že nám pomáháte appku vylepšovat! 💜
        </p>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Co nefunguje nebo co by šlo zlepšit?"
          rows={4}
          maxLength={4000}
          aria-label="Zpráva pro tým ZEdu"
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSend} disabled={sending}>
            {sending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Odeslat
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default BetaBadge;
