import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Send, User as UserIcon, ArrowLeft } from "lucide-react";

interface ConversationKey {
  parent_id: string;
  student_id: string;
}

interface ConversationInfo extends ConversationKey {
  parent_name: string;
  student_name: string;
  last_at: string;
  last_content: string;
  unread: number;
}

interface Msg {
  id: string;
  parent_id: string;
  teacher_id: string;
  student_id: string;
  content: string;
  direction: "parent_to_teacher" | "teacher_to_parent";
  created_at: string;
  read_at: string | null;
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const TeacherParentMessages = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [conversations, setConversations] = useState<ConversationInfo[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null); // `${parent_id}:${student_id}`
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showChatMobile, setShowChatMobile] = useState(false);

  const loadConversations = async () => {
    if (!user) return;
    const { data: rows } = await supabase
      .from("parent_messages" as any)
      .select("*")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false });
    const all = ((rows as any[]) || []) as Msg[];

    // Group by parent_id+student_id
    const map = new Map<string, ConversationInfo>();
    const parentIds = new Set<string>();
    const studentIds = new Set<string>();
    for (const r of all) {
      const k = `${r.parent_id}:${r.student_id}`;
      parentIds.add(r.parent_id);
      studentIds.add(r.student_id);
      if (!map.has(k)) {
        map.set(k, {
          parent_id: r.parent_id,
          student_id: r.student_id,
          parent_name: "",
          student_name: "",
          last_at: r.created_at,
          last_content: r.content,
          unread: 0,
        });
      }
      const c = map.get(k)!;
      if (r.direction === "parent_to_teacher" && !r.read_at) c.unread += 1;
    }

    const ids = Array.from(new Set([...parentIds, ...studentIds]));
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", ids);
      const nameById: Record<string, string> = {};
      (profs ?? []).forEach((p: any) => {
        nameById[p.id] = `${p.first_name} ${p.last_name}`.trim() || "—";
      });
      map.forEach((c) => {
        c.parent_name = nameById[c.parent_id] ?? "Rodič";
        c.student_name = nameById[c.student_id] ?? "Dítě";
      });
    }

    const list = Array.from(map.values()).sort((a, b) => (a.last_at < b.last_at ? 1 : -1));
    setConversations(list);
    if (!activeKey && list[0]) setActiveKey(`${list[0].parent_id}:${list[0].student_id}`);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/auth"); return; }
    (async () => {
      setLoading(true);
      await loadConversations();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, navigate]);

  const activeConv = useMemo(() => {
    if (!activeKey) return null;
    const [p, s] = activeKey.split(":");
    return conversations.find((c) => c.parent_id === p && c.student_id === s) ?? null;
  }, [activeKey, conversations]);

  const loadMessages = async () => {
    if (!user || !activeConv) { setMessages([]); return; }
    const { data } = await supabase
      .from("parent_messages" as any)
      .select("*")
      .eq("teacher_id", user.id)
      .eq("parent_id", activeConv.parent_id)
      .eq("student_id", activeConv.student_id)
      .order("created_at", { ascending: true });
    setMessages(((data as any[]) || []) as Msg[]);

    const unreadIds = ((data as any[]) || [])
      .filter((m) => m.direction === "parent_to_teacher" && !m.read_at)
      .map((m) => m.id);
    if (unreadIds.length > 0) {
      await supabase
        .from("parent_messages" as any)
        .update({ read_at: new Date().toISOString() })
        .in("id", unreadIds);
      loadConversations();
    }
  };

  useEffect(() => { loadMessages(); }, [user, activeKey]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`teacher-parent-messages-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "parent_messages", filter: `teacher_id=eq.${user.id}` },
        () => { loadMessages(); loadConversations(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeKey]);

  const handleSend = async () => {
    if (!user || !activeConv) return;
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    const { error } = await supabase.from("parent_messages" as any).insert({
      parent_id: activeConv.parent_id,
      teacher_id: user.id,
      student_id: activeConv.student_id,
      content: text,
      direction: "teacher_to_parent",
    });
    setSending(false);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    setDraft("");
    loadMessages();
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <SiteHeader />
        <main className="flex-1 flex items-center justify-center" style={{ paddingTop: "calc(70px + 1.5rem)" }}>
          <p className="text-muted-foreground">Načítání...</p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 pb-16" style={{ paddingTop: "calc(70px + 1.5rem)" }}>
        <div className="mb-6 flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-primary" />
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">Zprávy od rodičů</h1>
        </div>

        {conversations.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <p className="text-muted-foreground">Zatím Vám nepřišla žádná zpráva od rodičů.</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden grid grid-cols-1 md:grid-cols-[320px_1fr] min-h-[60vh]">
            <aside className={`border-r border-border ${showChatMobile ? "hidden md:block" : "block"}`}>
              <div className="p-3 border-b border-border">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Konverzace</h2>
              </div>
              <ul className="divide-y divide-border">
                {conversations.map((c) => {
                  const k = `${c.parent_id}:${c.student_id}`;
                  const isActive = activeKey === k;
                  return (
                    <li key={k}>
                      <button
                        onClick={() => { setActiveKey(k); setShowChatMobile(true); }}
                        className={`w-full text-left p-3 flex items-start gap-2.5 hover:bg-muted/50 transition ${
                          isActive ? "bg-muted/60" : ""
                        }`}
                      >
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <UserIcon className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-sm truncate ${c.unread > 0 ? "font-bold text-foreground" : "font-medium text-foreground"}`}>
                              {c.parent_name}
                            </span>
                            {c.unread > 0 && (
                              <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full px-1.5 min-w-[18px] h-[18px] flex items-center justify-center">
                                {c.unread}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            Žák: {c.student_name}
                          </p>
                          <p className={`text-xs truncate mt-0.5 ${c.unread > 0 ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                            {c.last_content}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </aside>

            <section className={`flex flex-col ${!showChatMobile ? "hidden md:flex" : "flex"}`}>
              {!activeConv ? (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-6">
                  Vyberte konverzaci.
                </div>
              ) : (
                <>
                  <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="md:hidden"
                      onClick={() => setShowChatMobile(false)}
                      aria-label="Zpět"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{activeConv.parent_name}</h3>
                      <p className="text-xs text-muted-foreground truncate">Žák: {activeConv.student_name}</p>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-muted/20">
                    {messages.map((m) => {
                      const mine = m.direction === "teacher_to_parent";
                      return (
                        <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                              mine
                                ? "bg-primary text-primary-foreground rounded-br-sm"
                                : "bg-card border border-border text-foreground rounded-bl-sm"
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">{m.content}</p>
                            <p className={`text-[10px] mt-1 ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                              {fmtTime(m.created_at)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="border-t border-border p-3 flex items-end gap-2">
                    <Textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Napište odpověď..."
                      className="min-h-[44px] max-h-32 resize-none"
                      rows={1}
                    />
                    <Button onClick={handleSend} disabled={sending || !draft.trim()} className="gap-1 shrink-0">
                      <Send className="w-4 h-4" />
                      Odeslat
                    </Button>
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

export default TeacherParentMessages;
