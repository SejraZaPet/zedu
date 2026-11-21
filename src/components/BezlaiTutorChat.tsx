import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { BookOpenCheck, FilePlus2, ListChecks, Loader2, MessageCircleQuestion, Paperclip, Send, Sparkles, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import PracticeSourceEditor, { type PracticeEditorSourceKind } from "@/components/practice/PracticeSourceEditor";
import BezlaiSummaryDialog from "@/components/student/BezlaiSummaryDialog";
import BezlaiSourceBadge, { type BezlaiResponseSource } from "@/components/student/BezlaiSourceBadge";
import BezlaiVerificationGuide from "@/components/student/BezlaiVerificationGuide";
import BezlaiTeacherVerificationDialog from "@/components/student/BezlaiTeacherVerificationDialog";
import { BEZLAI_VERIFICATION_GUIDE } from "@/lib/bezlai-verification";
import { parseBezlaiSummary, type BezlaiSummaryDraft } from "@/lib/bezlai-summary";
import { useDemoPair } from "@/lib/demo";
import { practiceErrorMessage } from "@/lib/practice-error";
import type { PracticeSource } from "@/lib/practice-method";
import { MIN_SOURCE_TEXT_LENGTH, SOURCE_TEXT_LIMIT } from "../../supabase/functions/_shared/practice-phases";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  generated?: boolean;
  grounded?: boolean;
  sources?: BezlaiResponseSource[];
  studentQuestion?: string;
}

export type BezlaiTutorMode = "context" | "free";

interface BezlaiTutorChatProps {
  /** Kontext = zadání bez přímé odpovědi; free = otevřená otázka nad materiály žáka. */
  mode?: BezlaiTutorMode;
  /** Aktuální otázka / zadání / nadpis lekce – dá se AI jako kontext. */
  question: string;
  subject?: string;
  /** Volitelná změna klíče vyresetuje konverzaci (např. při přechodu na další otázku). */
  contextKey?: string;
  /** Umístění plovoucího tlačítka. */
  className?: string;
  /** Řízené otevření zvenčí (např. tlačítkem „Zeptat se“ ve studijní liště). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Skryje plovoucí tlačítko – chat se otevírá jen přes open. */
  hideTrigger?: boolean;
}

/** Povinné odhalení AI podle EU AI Act (čl. 50) – vždy první zpráva konverzace. */
const AI_DISCLOSURE =
  "Ahoj, jsem Bezlai, umělá inteligence. Nejsem člověk – dávám ti nápovědy, abys na odpověď přišel/přišla sám/sama.";
const FREE_AI_DISCLOSURE =
  "Ahoj, jsem Bezlai, umělá inteligence. Nejsem člověk – pomůžu ti vysvětlit učivo a ptát se, abys mu porozuměl/a.";

const initialMessages = (mode: BezlaiTutorMode): ChatMsg[] => [
  { role: "assistant", content: mode === "free" ? FREE_AI_DISCLOSURE : AI_DISCLOSURE },
  { role: "assistant", content: mode === "free" ? "S čím ti pomůžu?" : "Čeho se zadání týká, čemu nerozumíš?" },
];

export default function BezlaiTutorChat({
  mode = "context",
  question,
  subject,
  contextKey,
  className,
  open: openProp,
  onOpenChange,
  hideTrigger = false,
}: BezlaiTutorChatProps) {
  const [openInner, setOpenInner] = useState(false);
  const open = openProp ?? openInner;
  const setOpen = (value: boolean) => {
    setOpenInner(value);
    onOpenChange?.(value);
  };
  const [messages, setMessages] = useState<ChatMsg[]>(() => initialMessages(mode));
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const demoPair = useDemoPair();
  const [materialOpen, setMaterialOpen] = useState(false);
  const [materialKind, setMaterialKind] = useState<PracticeEditorSourceKind>("text");
  const [materialDraft, setMaterialDraft] = useState<PracticeSource | null>(null);
  const [materialDraftBusy, setMaterialDraftBusy] = useState(false);
  const [material, setMaterial] = useState<PracticeSource | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryDraft, setSummaryDraft] = useState<BezlaiSummaryDraft | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [teacherVerification, setTeacherVerification] = useState<{ question: string; answer: string } | null>(null);
  const navigate = useNavigate();

  const handleMaterialDraft = useCallback((source: PracticeSource | null) => setMaterialDraft(source), []);
  const handleMaterialBusy = useCallback((busy: boolean) => setMaterialDraftBusy(busy), []);

  // Reset conversation when context changes (e.g. student moves to next question).
  useEffect(() => {
    setMessages(initialMessages(mode));
    setInput("");
    setMaterial(null);
    setMaterialDraft(null);
    setMaterialKind("text");
    setSummaryDraft(null);
    setSummaryError(null);
    setSummaryOpen(false);
    setGuideOpen(false);
    setTeacherVerification(null);
  }, [contextKey, mode]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
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
          mode,
          task: "chat",
          question,
          studentMessage: text,
          // Neposílej úvodní odhalení AI, pozdrav ani staré chybové hlášky do historie.
          conversationHistory: nextHistory.slice(2, -1).filter((message) => !message.content.startsWith("⚠️")),
          subject,
          ...(mode === "free" && material ? { material } : {}),
        },
      });
      if (error) throw error;
      const reply = (data as { reply?: string } | null)?.reply;
      const errMsg = (data as { error?: string } | null)?.error;
      if (errMsg) {
        setMessages((current) => [...current, { role: "assistant", content: `⚠️ ${errMsg}` }]);
      } else if (reply) {
        const response = data as { searchError?: string; grounded?: boolean; sources?: unknown } | null;
        const searchError = response?.searchError;
        const sources: BezlaiResponseSource[] = Array.isArray(response?.sources)
          ? response.sources.flatMap((source) => {
            if (!source || typeof source !== "object") return [];
            const item = source as Record<string, unknown>;
            if (typeof item.title !== "string" || typeof item.kind !== "string") return [];
            return [{
              title: item.title,
              kind: item.kind,
              ...(typeof item.href === "string" && item.href.startsWith("/") ? { href: item.href } : {}),
            }];
          }).slice(0, 5)
          : [];
        setMessages((current) => [
          ...current,
          ...(searchError ? [{ role: "assistant" as const, content: `⚠️ ${searchError}` }] : []),
          {
            role: "assistant",
            content: reply,
            generated: true,
            grounded: response?.grounded === true && sources.length > 0,
            sources,
            studentQuestion: text,
          },
        ]);
      } else {
        setMessages((current) => [...current, { role: "assistant", content: "⚠️ Nedostala jsem odpověď. Zkus to prosím znovu." }]);
      }
    } catch (cause) {
      const readable = await practiceErrorMessage(cause);
      setMessages((current) => [
        ...current,
        { role: "assistant", content: `⚠️ ${readable || "Spojení se nepodařilo. Zkus to prosím znovu."}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const generateSummary = async () => {
    if (summaryLoading || mode !== "free") return;
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const { data, error } = await supabase.functions.invoke("ask-zedai-tutor", {
        body: {
          mode: "free",
          task: "summary",
          question: "",
          subject,
          studentMessage: "Vytvoř z naší konverzace koncept krátkých poznámek.",
          conversationHistory: messages.slice(2).filter((message) => !message.content.startsWith("⚠️")),
          ...(material ? { material } : {}),
        },
      });
      if (error) throw error;
      if ((data as { error?: string } | null)?.error) throw new Error((data as { error: string }).error);
      const reply = (data as { reply?: string } | null)?.reply?.trim();
      if (!reply) throw new Error("Bezlai nepřipravila žádné shrnutí. Zkus to prosím znovu.");
      setSummaryDraft({ ...parseBezlaiSummary(reply), aiModifiedAt: null });
    } catch (cause) {
      const readable = await practiceErrorMessage(cause);
      setSummaryError(readable || "Shrnutí se nepodařilo vytvořit. Konverzace zůstala zachovaná.");
    } finally {
      setSummaryLoading(false);
    }
  };

  const openSummary = () => {
    setSummaryOpen(true);
    if (!summaryDraft && !summaryLoading) void generateSummary();
  };

  const openTeacherVerification = (message?: ChatMsg) => {
    const target = message ?? [...messages].reverse().find((item) => item.generated && !item.grounded);
    if (!target) {
      navigate("/zpravy");
      return;
    }
    setGuideOpen(false);
    setTeacherVerification({ question: target.studentQuestion ?? question, answer: target.content });
  };

  const materialValid = Boolean(
    materialDraft
    && materialDraft.text.trim().length >= MIN_SOURCE_TEXT_LENGTH
    && materialDraft.text.trim().length <= SOURCE_TEXT_LIMIT,
  );

  return (
    <>
      {!hideTrigger && (
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
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0 gap-0">
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Bezlai – tvůj tutor
            </SheetTitle>
            <SheetDescription className="text-xs text-left">
              {mode === "free" ? "Hledám v tvých materiálech a pomůžu ti porozumět. 🧭" : "Neřeknu ti přímo odpověď, ale nasměruju tě k ní. 🧭"}
            </SheetDescription>
            <Button type="button" variant="ghost" size="sm" className="min-h-11 self-start gap-2 px-0 text-xs" onClick={() => setGuideOpen(true)}>
              <BookOpenCheck className="h-4 w-4" aria-hidden />{BEZLAI_VERIFICATION_GUIDE.title}
            </Button>
          </SheetHeader>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((message, index) => {
              const isError = message.content.startsWith("⚠️");
              const canSummarize = mode === "free" && message.role === "assistant" && index >= 2 && !isError;
              return (
                <div key={`${index}-${message.role}`} className={cn("flex flex-col", message.role === "user" ? "items-end" : "items-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm",
                    )}
                    role={isError ? "alert" : undefined}
                  >
                    {message.content}
                  </div>
                  {message.generated && (
                    <BezlaiSourceBadge
                      grounded={Boolean(message.grounded)}
                      sources={message.sources ?? []}
                      onGuide={() => setGuideOpen(true)}
                      onTeacher={!message.grounded && !demoPair ? () => openTeacherVerification(message) : undefined}
                    />
                  )}
                  {canSummarize && (
                    <Button type="button" variant="ghost" size="sm" className="mt-1 min-h-11 gap-2 px-2 text-xs" onClick={openSummary}>
                      <ListChecks className="h-4 w-4" />Shrnout do poznámek
                    </Button>
                  )}
                </div>
              );
            })}
            {loading && (
              <div className="flex justify-start">
                <div role="status" className="bg-muted rounded-2xl rounded-bl-sm px-3.5 py-2 text-sm flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Bezlai přemýšlí…
                </div>
              </div>
            )}
          </div>

          <div className="border-t p-3 space-y-2">
            {mode === "free" && (
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" className="min-h-11 gap-2" onClick={() => setMaterialOpen(true)} disabled={loading}>
                  <Paperclip className="h-4 w-4" />Přidat materiál
                </Button>
                {material && (
                  <span className="flex min-w-0 max-w-full items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-1 text-xs">
                    <span className="truncate" title={material.label}>{material.label} · {material.text.length} znaků</span>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`Odebrat materiál ${material.label}`} onClick={() => setMaterial(null)} disabled={loading}><X className="h-3.5 w-3.5" /></Button>
                  </span>
                )}
                <span className="w-full text-xs text-muted-foreground">Materiál se neukládá. Zůstává jen v této konverzaci a paměti prohlížeče.</span>
              </div>
            )}
            <div className="flex items-end gap-2">
              <Textarea
                aria-label={mode === "free" ? "Otázka pro Bezlai" : "Čemu nerozumíš"}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                placeholder={mode === "free" ? "Na co se chceš zeptat?" : "Napiš, čemu nerozumíš…"}
                rows={2}
                className="resize-none flex-1 text-base"
                disabled={loading}
              />
              <Button type="button" size="icon" className="h-11 w-11 shrink-0" onClick={() => void send()} disabled={!input.trim() || loading} aria-label="Odeslat">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {mode === "free" && (
        <>
          <Dialog open={materialOpen} onOpenChange={setMaterialOpen}>
            <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><FilePlus2 className="h-5 w-5 text-primary" />Přidat materiál</DialogTitle>
                <DialogDescription>Materiál se nikam neuloží. Bezlai z něj bude odpovídat jen v této konverzaci.</DialogDescription>
              </DialogHeader>
              <PracticeSourceEditor
                kind={materialKind}
                onKindChange={setMaterialKind}
                onSourceChange={handleMaterialDraft}
                onBusyChange={handleMaterialBusy}
                idPrefix="bezlai-material"
                demoAccount={Boolean(demoPair)}
              />
              {materialDraft && materialDraft.text.trim().length > SOURCE_TEXT_LIMIT && <p role="alert" className="text-sm text-destructive">Text je potřeba zkrátit na {SOURCE_TEXT_LIMIT} znaků; nic se neořízlo.</p>}
              <DialogFooter className="gap-2">
                <Button type="button" variant="ghost" onClick={() => setMaterialOpen(false)} disabled={materialDraftBusy}>Zrušit</Button>
                <Button type="button" className="min-h-11" disabled={!materialValid || materialDraftBusy} onClick={() => {
                  if (!materialDraft || !materialValid) return;
                  setMaterial({ ...materialDraft, text: materialDraft.text.trim() });
                  setMaterialOpen(false);
                }}>Použít v konverzaci</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <BezlaiSummaryDialog
            open={summaryOpen}
            onOpenChange={setSummaryOpen}
            loading={summaryLoading}
            error={summaryError}
            onRetry={() => void generateSummary()}
            draft={summaryDraft}
            onDraftChange={setSummaryDraft}
            subject={subject}
          />
        </>
      )}

      <BezlaiVerificationGuide
        showTrigger={false}
        open={guideOpen}
        onOpenChange={setGuideOpen}
        onTeacher={!demoPair ? () => openTeacherVerification() : undefined}
      />
      <BezlaiTeacherVerificationDialog
        open={Boolean(teacherVerification)}
        onOpenChange={(value) => { if (!value) setTeacherVerification(null); }}
        question={teacherVerification?.question ?? ""}
        answer={teacherVerification?.answer ?? ""}
      />
    </>
  );
}
