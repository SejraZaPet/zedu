import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageSquare, Send, Loader2, Bot, UserPlus, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

/** Povinné odhalení AI podle EU AI Act (čl. 50) – vždy první zpráva konverzace. */
const AI_DISCLOSURE =
  "Dobrý den, jsem ZedAI – umělá inteligence, ne člověk. Ráda zodpovím vaše dotazy o platformě ZEdu.";
const INITIAL_GREETING =
  "Zajímá vás funkce platformy, ceník nebo termín spuštění? Zeptejte se.";

const SUGGESTIONS = ["Co ZEdu umí?", "Kolik to stojí?", "Kdy se platforma spouští?"];

const initialMessages = (): ChatMsg[] => [
  { role: "assistant", content: AI_DISCLOSURE },
  { role: "assistant", content: INITIAL_GREETING },
];

export default function WebsiteAssistantChat({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showLead, setShowLead] = useState(false);
  const [leadSent, setLeadSent] = useState(false);
  const [leadLoading, setLeadLoading] = useState(false);
  const [leadError, setLeadError] = useState<string | null>(null);
  const [lead, setLead] = useState({ name: "", email: "", organization: "", note: "", website: "" });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, showLead]);

  const sendText = async (text: string) => {
    if (!text.trim() || loading) return;
    const nextHistory: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(nextHistory);
    setInput("");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("website-assistant-chat", {
        body: {
          action: "chat",
          visitorMessage: text,
          // Neposílej úvodní odhalení AI ani pozdrav.
          conversationHistory: nextHistory.slice(2, -1),
        },
      });
      if (error) throw error;
      const reply = (data as any)?.reply as string | undefined;
      const errMsg = (data as any)?.error as string | undefined;
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            errMsg ??
            reply ??
            "⚠️ Odpověď se nepodařilo získat. Zkuste to prosím znovu nebo nám nechte kontakt.",
        },
      ]);
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `⚠️ Chyba spojení: ${e?.message ?? "zkuste to znovu"}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const submitLead = async () => {
    if (leadLoading) return;
    setLeadError(null);
    setLeadLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("website-assistant-chat", {
        body: { action: "lead", ...lead },
      });
      if (error) throw error;
      const errMsg = (data as any)?.error as string | undefined;
      if (errMsg) {
        setLeadError(errMsg);
        return;
      }
      setLeadSent(true);
      setShowLead(false);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: "Děkujeme, kontakt jsme zaznamenali. Ozveme se vám s dalšími informacemi.",
        },
      ]);
    } catch (e: any) {
      setLeadError(e?.message ?? "Odeslání se nepodařilo, zkuste to prosím znovu.");
    } finally {
      setLeadLoading(false);
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
        aria-label="Zeptat se ZedAI na platformu ZEdu"
      >
        <MessageSquare className="w-5 h-5" />
        <span className="font-semibold">Zeptat se ZedAI</span>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              ZedAI – asistent ZEdu
            </SheetTitle>
            <p className="text-xs text-muted-foreground text-left">
              Odpovědi na dotazy o platformě, funkcích a ceníku.
            </p>
          </SheetHeader>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
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
                  ZedAI odpovídá…
                </div>
              </div>
            )}

            {messages.length <= 2 && !loading && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((s) => (
                  <Button key={s} variant="outline" size="sm" onClick={() => sendText(s)}>
                    {s}
                  </Button>
                ))}
              </div>
            )}

            {showLead && !leadSent && (
              <div className="rounded-xl border p-3 space-y-2 bg-card">
                <p className="text-sm font-medium">Nechat na sebe kontakt</p>
                <div className="space-y-1">
                  <Label htmlFor="wa-name" className="text-xs">Jméno (nepovinné)</Label>
                  <Input
                    id="wa-name"
                    value={lead.name}
                    onChange={(e) => setLead({ ...lead, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="wa-email" className="text-xs">E-mail *</Label>
                  <Input
                    id="wa-email"
                    type="email"
                    value={lead.email}
                    onChange={(e) => setLead({ ...lead, email: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="wa-org" className="text-xs">Škola / organizace (nepovinné)</Label>
                  <Input
                    id="wa-org"
                    value={lead.organization}
                    onChange={(e) => setLead({ ...lead, organization: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="wa-note" className="text-xs">Poznámka (nepovinné)</Label>
                  <Textarea
                    id="wa-note"
                    rows={2}
                    className="resize-none"
                    value={lead.note}
                    onChange={(e) => setLead({ ...lead, note: e.target.value })}
                  />
                </div>
                {/* honeypot */}
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="hidden"
                  value={lead.website}
                  onChange={(e) => setLead({ ...lead, website: e.target.value })}
                />
                {leadError && <p className="text-xs text-destructive">{leadError}</p>}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={submitLead} disabled={leadLoading || !lead.email.trim()}>
                    {leadLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Odeslat"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowLead(false)}>
                    Zrušit
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="border-t px-3 pt-2">
            {leadSent ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 pb-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                Kontakt odeslán.
              </p>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={() => setShowLead(true)}
                disabled={showLead}
              >
                <UserPlus className="w-4 h-4" />
                Nechat na sebe kontakt
              </Button>
            )}
          </div>

          <div className="p-3 flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendText(input.trim());
                }
              }}
              placeholder="Na co se chcete zeptat?"
              rows={2}
              className="resize-none flex-1"
              disabled={loading}
            />
            <Button
              type="button"
              size="icon"
              onClick={() => sendText(input.trim())}
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
