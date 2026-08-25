import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircleQuestion, Send, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

interface BezlaiTutorChatProps {
  /** Aktuální otázka / zadání / nadpis lekce – dá se AI jako kontext. */
  question: string;
  subject?: string;
  /** Volitelná změna klíče vyresetuje konverzaci (např. při přechodu na další otázku). */
  contextKey?: string;
  /** Umístění plovoucího tlačítka. */
  className?: string;
}

/** Povinné odhalení AI podle EU AI Act (čl. 50) – vždy první zpráva konverzace. */
const AI_DISCLOSURE =
  "Ahoj, jsem Bezlai, umělá inteligence. Nejsem člověk – dávám ti nápovědy, abys na odpověď přišel/přišla sám/sama.";
const INITIAL_GREETING = "Čeho se zadání týká, čemu nerozumíš?";

const initialMessages = (): ChatMsg[] => [
  { role: "assistant", content: AI_DISCLOSURE },
  { role: "assistant", content: INITIAL_GREETING },
];

export default function BezlaiTutorChat({
  question,
  subject,
  contextKey,
  className,
}: BezlaiTutorChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset conversation when context changes (e.g. student moves to next question).
  useEffect(() => {
    setMessages(initialMessages());
    setInput("");
  }, [contextKey]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const nextHistory: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(nextHistory);
    setInput("");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ask-zedai-tutor", {
        body: {
          question,
          studentMessage: text,
          // Neposílej úvodní odhalení AI ani pozdrav do historie.
          conversationHistory: nextHistory.slice(2, -1),
          subject,
        },
      });
      if (error) throw error;
      const reply = (data as any)?.reply as string | undefined;
      const errMsg = (data as any)?.error as string | undefined;
      if (errMsg) {
        setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${errMsg}` }]);
      } else if (reply) {
        setMessages((m) => [...m, { role: "assistant", content: reply }]);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: "⚠️ Nedostal jsem odpověď. Zkus to prosím znovu." }]);
      }
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `⚠️ Chyba spojení: ${e?.message ?? "zkus to znovu"}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-5 right-5 z-40 rounded-full shadow-lg h-14 pl-4 pr-5 gap-2 bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent,var(--primary)))]",
          className,
        )}
        aria-label="Zeptej se Bezlai"
      >
        <MessageCircleQuestion className="w-5 h-5" />
        <span className="font-semibold">Zeptej se Bezlai</span>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Bezlai – tvůj tutor
            </SheetTitle>
            <p className="text-xs text-muted-foreground text-left">
              Neřeknu ti přímo odpověď, ale nasměruju tě k ní. 🧭
            </p>
          </SheetHeader>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "flex",
                  m.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm",
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-3.5 py-2 text-sm flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Bezlai přemýšlí…
                </div>
              </div>
            )}
          </div>

          <div className="border-t p-3 flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Napiš, čemu nerozumíš…"
              rows={2}
              className="resize-none flex-1"
              disabled={loading}
            />
            <Button
              type="button"
              size="icon"
              onClick={send}
              disabled={!input.trim() || loading}
              aria-label="Odeslat"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
