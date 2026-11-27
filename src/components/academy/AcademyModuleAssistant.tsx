import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import AiContentBadge from "@/components/ai/AiContentBadge";
import MarkdownContent from "@/components/MarkdownContent";
import { Loader2, MessageCircleQuestion, Send } from "lucide-react";

interface Msg { role: "user" | "assistant"; content: string }

export const ACADEMY_AI_DISCLOSURE = "Jsem AI asistent, ne člověk. Odpovídám jen z obsahu tohoto kurzu a mohu se mýlit — postup si vždy ověřte v aplikaci.";

export default function AcademyModuleAssistant({ moduleId, moduleTitle }: { moduleId: string; moduleTitle: string }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  useEffect(() => { reqId.current++; setMsgs([]); setError(null); setBusy(false); }, [moduleId]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const id = ++reqId.current;
    const history = msgs;
    setMsgs([...history, { role: "user", content: text }]);
    setInput(""); setBusy(true); setError(null);
    const { data, error: err } = await supabase.functions.invoke("academy-assistant", { body: { moduleId, message: text, history } });
    if (id !== reqId.current) return;
    setBusy(false);
    let msg: string | null = null;
    if (err) {
      try { msg = (await (err as { context?: Response }).context?.json())?.error ?? null; } catch { /* ignore */ }
      setError(msg || "AI asistent teď neodpovídá. Zkuste to prosím znovu.");
      return;
    }
    if (data?.error || !data?.reply) { setError(data?.error || "AI nevrátila odpověď."); return; }
    setMsgs((m) => [...m, { role: "assistant", content: data.reply }]);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="min-h-11 whitespace-normal"><MessageCircleQuestion className="mr-2 h-4 w-4" aria-hidden="true" />Zeptat se k tomuto modulu</Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-3 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>AI asistent Akademie</SheetTitle>
          <SheetDescription className="break-words">K modulu: {moduleTitle}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto" aria-live="polite">
          <p role="note" className="rounded-lg border border-border bg-muted p-3 text-sm">{ACADEMY_AI_DISCLOSURE}</p>
          {msgs.map((m, i) => m.role === "user"
            ? <p key={i} className="ml-8 rounded-lg bg-primary/10 p-3 text-sm break-words">{m.content}</p>
            : <div key={i} className="mr-4 space-y-2 rounded-lg border border-border bg-card p-3 text-sm"><AiContentBadge aiGenerated /><MarkdownContent content={m.content} /></div>)}
          {busy && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Asistent připravuje odpověď…</p>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <label htmlFor="academy-ai-input" className="sr-only">Vaše otázka</label>
          <Textarea id="academy-ai-input" value={input} maxLength={2000} rows={2} placeholder="Např. Jak přidám hodinu do rozvrhu?" onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} />
          <Button type="submit" size="icon" className="h-11 w-11 shrink-0" disabled={busy || !input.trim()} aria-label="Odeslat otázku"><Send className="h-4 w-4" aria-hidden="true" /></Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
