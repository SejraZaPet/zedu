import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ThumbsUp, Check, RotateCcw, Loader2, MessageCircleQuestion } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface LiveQuestionRow {
  id: string;
  session_id: string;
  player_id: string;
  text: string;
  answered: boolean;
  created_at: string;
}

export interface LiveVoteRow {
  id: string;
  question_id: string;
  player_id: string;
}

/**
 * Fetch + realtime-sync live questions and votes for a session.
 * Shared by student & teacher UIs.
 */
export function useLiveQuestions(sessionId?: string, joinToken?: string) {
  const [questions, setQuestions] = useState<LiveQuestionRow[]>([]);
  const [votes, setVotes] = useState<LiveVoteRow[]>([]);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase.rpc("get_session_questions" as any, {
        _session_id: sessionId,
        _join_token: joinToken || null,
      });
      if (cancelled || error || !data) return;
      const payload = data as any;
      setQuestions((payload.questions ?? []) as LiveQuestionRow[]);
      setVotes(
        ((payload.votes ?? []) as any[]).map((r) => ({
          id: r.id,
          question_id: r.question_id,
          player_id: r.player_id,
        }))
      );
    };
    load();

    // Poll as well: anonymous guests do not receive realtime row events.
    const poll = setInterval(load, 5000);

    const ch = supabase
      .channel(`live-questions-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_questions", filter: `session_id=eq.${sessionId}` },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_question_votes" },
        () => load()
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(poll);
      supabase.removeChannel(ch);
    };
  }, [sessionId, joinToken]);

  const unansweredCount = useMemo(() => questions.filter((q) => !q.answered).length, [questions]);

  return { questions, votes, unansweredCount };
}

interface LiveQuestionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  role: "student" | "teacher";
  joinToken?: string;
  playerId?: string;
  players?: Array<{ id: string; nickname?: string }>;
  anonymous?: boolean;
}

const LiveQuestionsSheet = ({
  open,
  onOpenChange,
  sessionId,
  role,
  joinToken,
  playerId,
  players,
  anonymous = false,
}: LiveQuestionsSheetProps) => {
  const { questions, votes } = useLiveQuestions(sessionId, joinToken);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const voteCountByQ = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of votes) m.set(v.question_id, (m.get(v.question_id) ?? 0) + 1);
    return m;
  }, [votes]);

  const myVoteSet = useMemo(() => {
    if (!playerId) return new Set<string>();
    return new Set(votes.filter((v) => v.player_id === playerId).map((v) => v.question_id));
  }, [votes, playerId]);

  const sorted = useMemo(() => {
    return [...questions].sort((a, b) => {
      if (a.answered !== b.answered) return a.answered ? 1 : -1;
      const va = voteCountByQ.get(a.id) ?? 0;
      const vb = voteCountByQ.get(b.id) ?? 0;
      if (va !== vb) return vb - va;
      return a.created_at.localeCompare(b.created_at);
    });
  }, [questions, voteCountByQ]);

  const submit = async () => {
    if (!joinToken) return;
    const clean = text.trim();
    if (!clean) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("submit_live_question" as any, {
        _join_token: joinToken,
        _text: clean,
      });
      if (error) throw error;
      setText("");
      toast.success("Dotaz odeslán.");
    } catch (e: any) {
      toast.error(e.message || "Nepodařilo se odeslat dotaz.");
    } finally {
      setBusy(false);
    }
  };

  const toggleVote = async (qid: string) => {
    if (!joinToken) return;
    const { error } = await supabase.rpc("toggle_question_vote" as any, {
      _join_token: joinToken,
      _question_id: qid,
    });
    if (error) toast.error(error.message);
  };

  const setAnswered = async (qid: string, answered: boolean) => {
    const { error } = await supabase.rpc("set_question_answered" as any, {
      _question_id: qid,
      _answered: answered,
    });
    if (error) toast.error(error.message);
  };

  const nicknameFor = (pid: string) => {
    if (anonymous) return "Žák";
    return players?.find((p) => p.id === pid)?.nickname || "Žák";
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <MessageCircleQuestion className="w-5 h-5" /> Živé dotazy
          </SheetTitle>
          <SheetDescription>
            {role === "student"
              ? "Napiš dotaz nebo dej 👍 dotazu, který tě zajímá."
              : "Dotazy seřazené podle počtu hlasů."}
          </SheetDescription>
        </SheetHeader>

        {role === "student" && (
          <div className="mt-4 space-y-2">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 200))}
              placeholder="Co potřebuješ vysvětlit?"
              rows={2}
              disabled={busy}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{text.length}/200</span>
              <Button size="sm" onClick={submit} disabled={busy || !text.trim()}>
                {busy && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                Odeslat
              </Button>
            </div>
          </div>
        )}

        <div className="mt-4 space-y-2">
          {sorted.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Zatím žádné dotazy.</p>
          )}
          {sorted.map((q) => {
            const count = voteCountByQ.get(q.id) ?? 0;
            const mine = myVoteSet.has(q.id);
            return (
              <div
                key={q.id}
                className={`flex items-start gap-2 border rounded-lg p-2.5 ${
                  q.answered ? "opacity-50 border-dashed" : "border-border"
                }`}
              >
                {role === "student" ? (
                  <button
                    type="button"
                    onClick={() => toggleVote(q.id)}
                    className={`flex flex-col items-center justify-center rounded-md px-2 py-1 border text-xs min-w-[44px] transition-colors ${
                      mine ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
                    }`}
                    aria-label={mine ? "Zrušit hlas" : "Hlasovat"}
                  >
                    <ThumbsUp className="w-4 h-4" />
                    <span className="font-medium">{count}</span>
                  </button>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-md px-2 py-1 border border-border text-xs min-w-[44px] bg-muted/40">
                    <ThumbsUp className="w-4 h-4" />
                    <span className="font-medium">{count}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${q.answered ? "line-through" : ""}`}>{q.text}</p>
                  {role === "teacher" && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {nicknameFor(q.player_id)}
                    </p>
                  )}
                </div>
                {role === "teacher" && (
                  <Button
                    size="sm"
                    variant={q.answered ? "ghost" : "outline"}
                    className="h-8 gap-1"
                    onClick={() => setAnswered(q.id, !q.answered)}
                  >
                    {q.answered ? (
                      <>
                        <RotateCcw className="w-3.5 h-3.5" /> Obnovit
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" /> Vyřešeno
                      </>
                    )}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default LiveQuestionsSheet;
