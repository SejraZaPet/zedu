import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Block } from "@/lib/textbook-config";

interface Props {
  /** Vybraný textový blok (paragraph/heading); bez něj je tlačítko neaktivní. */
  block: Block | null;
  headline: string;
  lessonTitle: string;
  onAccept: (text: string) => void;
}

/** „Doplnit AI“ – návrh textu pro vybraný textový blok slidu. */
const AiBlockTextButton = ({ block, headline, lessonTitle, onAccept }: Props) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const isTextBlock = block?.type === "paragraph" || block?.type === "heading";

  const generate = async () => {
    if (!isTextBlock || !block) return;
    setLoading(true);
    try {
      const existing = String(block.props?.text || "").replace(/<[^>]+>/g, " ").trim();
      const { data, error } = await supabase.functions.invoke("generate-slide-text", {
        body: {
          kind: block.type,
          headline,
          lessonTitle,
          existingText: existing,
        },
      });
      if (error) throw error;
      const text = String((data as any)?.text || "").trim();
      if (!text) throw new Error("AI nevrátila text.");
      setDraft(text);
      setOpen(true);
    } catch (e: any) {
      toast({
        title: "AI návrh se nepodařilo vytvořit",
        description: e?.message ?? String(e),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1"
        disabled={!isTextBlock || loading}
        onClick={generate}
        title={isTextBlock ? "Návrh textu od AI pro vybraný blok" : "Nejprve klikněte na textový blok v náhledu"}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        Doplnit AI
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Návrh textu od AI</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Text vytvořila umělá inteligence. Před použitím jej prosím zkontrolujte a upravte.
          </p>
          <Textarea rows={6} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Zahodit</Button>
            <Button variant="outline" onClick={generate} disabled={loading}>
              {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Jiný návrh
            </Button>
            <Button
              onClick={() => {
                onAccept(draft.trim());
                setOpen(false);
              }}
              disabled={!draft.trim()}
            >
              Použít
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AiBlockTextButton;
