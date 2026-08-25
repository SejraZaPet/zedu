import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageSquare, Send, Loader2, Bot, UserPlus, CheckCircle2, ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  /** ID záznamu v logu konverzací – umožňuje odeslat zpětnou vazbu. */
  logId?: string | null;
  feedback?: "up" | "down" | null;
}

/** Povinné odhalení AI podle EU AI Act (čl. 50) – vždy první zpráva konverzace. */
const AI_DISCLOSURE =
  "Dobrý den, jsem Bezlai – umělá inteligence, ne člověk. Ráda zodpovím vaše dotazy o platformě Bezli.";
const INITIAL_GREETING =
  "Zajímá vás funkce platformy, ceník nebo termín spuštění? Zeptejte se.";

const SUGGESTIONS = ["Co Bezli umí?", "Kolik to stojí?", "Kdy se platforma spouští?"];

const initialMessages = (): ChatMsg[] => [
  { role: "assistant", content: AI_DISCLOSURE },
  { role: "assistant", content: INITIAL_GREETING },
];

const newSessionId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;

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
  /** Náhodné ID session – jen v paměti, nikam se neukládá. */
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (open && !sessionIdRef.current) sessionIdRef.current = newSessionId();
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, showLead]);

  const sendFeedback = async (index: number, feedback: "up" | "down") => {
    const msg = messages[index];
    if (!msg?.logId || msg.feedback === feedback) return;
    setMessages((m) => m.map((x, i) => (i === index ? { ...x, feedback } : x)));
    const { error } = await supabase.functions.invoke("website-assistant-chat", {
      body: { action: "feedback", logId: msg.logId, feedback },
    });
    if (error) setMessages((m) => m.map((x, i) => (i === index ? { ...x, feedback: null } : x)));
  };

  const sendText = async (text: string) => {
    if (!text.trim() || loading) return;
    if (!sessionIdRef.current) sessionIdRef.current = newSessionId();
    const nextHistory: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(nextHistory);
    setInput("");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("website-assistant-chat", {
        body: {
          action: "chat",
          visitorMessage: text,
          sessionId: sessionIdRef.current,
          // Neposílej úvodní odhalení AI ani pozdrav.
          conversationHistory: nextHistory.slice(2, -1).map((m) => ({ role: m.role, content: m.content })),
        },
      });
      if (error) throw error;
      const reply = (data as any)?.reply as string | undefined;
      const logId = ((data as any)?.logId as string | undefined) ?? null;
      const errMsg = (data as any)?.error as string | undefined;
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            errMsg ??
            reply ??
            "⚠️ Odpověď se nepodařilo získat. Zkuste to prosím znovu nebo nám nechte kontakt.",
          logId: errMsg ? null : logId,
          feedback: null,
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
          "fixed bottom-5 right-5 z-40 h-14 w-14 rounded-full shadow-lg p-0",
          "bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent,var(--primary)))]",
          "hover:brightness-110 hover:scale-105 transition-transform",
          className,
        )}
        aria-label="Zeptat se Bezlai na platformu Bezli"
        title="Zeptat se Bezlai"
      >
        <span className="relative flex items-center justify-center w-full h-full">
          {/* Bezlíkova zjednodušená hlava – gumdrop tvar v brand gradientu */}
          <svg
            viewBox="0 0 48 48"
            className="w-8 h-8"
            aria-hidden="true"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="zedHeadGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#6EC6D9" />
                <stop offset="100%" stopColor="#9B6CFF" />
              </linearGradient>
            </defs>
            <path
              d="M24 6C14 6 10 14 10 22C10 32 16 42 24 42C32 42 38 32 38 22C38 14 34 6 24 6Z"
              fill="url(#zedHeadGrad)"
            />
            <circle cx="18" cy="20" r="2.5" fill="white" />
            <circle cx="30" cy="20" r="2.5" fill="white" />
            <path
              d="M19 28C19 28 21 31 24 31C27 31 29 28 29 28"
              stroke="white"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path
              d="M24 6C24 6 27 4 29 5C31 6 32 9 30 10"
              fill="url(#zedHeadGrad)"
            />
            <path
              d="M24 6C24 6 21 4 19 5C17 6 16 9 18 10"
              fill="url(#zedHeadGrad)"
            />
          </svg>
          {/* Odzásek „zeptej se“ v pravém horním rohu */}
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-5 h-5 rounded-full bg-background border border-primary/30 text-primary shadow-sm">
            <svg
              viewBox="0 0 16 16"
              className="w-3 h-3"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="8" cy="8" r="6" />
              <path d="M6 6.5c0-.5.4-1 1-1h.9c.8 0 1.4.6 1.4 1.4 0 1.1-2.3 1.3-2.3 3" />
              <path d="M8 11h.01" />
            </svg>
          </span>
        </span>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              Bezlai – asistent Bezli
            </SheetTitle>
            <p className="text-xs text-muted-foreground text-left">
              Odpovědi na dotazy o platformě, funkcích a ceníku.
            </p>
          </SheetHeader>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex flex-col", m.role === "user" ? "items-end" : "items-start")}>
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
                {m.role === "assistant" && m.logId && (
                  <div className="flex items-center gap-1 pl-1 pt-1">
                    <button
                      type="button"
                      onClick={() => sendFeedback(i, "up")}
                      aria-label="Odpověď byla užitečná"
                      aria-pressed={m.feedback === "up"}
                      className={cn(
                        "p-1 rounded-md transition-colors hover:bg-muted",
                        m.feedback === "up" ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => sendFeedback(i, "down")}
                      aria-label="Odpověď nebyla užitečná"
                      aria-pressed={m.feedback === "down"}
                      className={cn(
                        "p-1 rounded-md transition-colors hover:bg-muted",
                        m.feedback === "down" ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}


            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-3.5 py-2 text-sm flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Bezlai odpovídá…
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
