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

interface ChildOpt {
  id: string;
  name: string;
}

interface TeacherOpt {
  id: string;
  name: string;
  className: string;
  subjects: string[];
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

const ParentMessages = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [children, setChildren] = useState<ChildOpt[]>([]);
  const [activeChild, setActiveChild] = useState<string | null>(null);
  const [teachers, setTeachers] = useState<TeacherOpt[]>([]);
  const [activeTeacher, setActiveTeacher] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [unreadByTeacher, setUnreadByTeacher] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showChatMobile, setShowChatMobile] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/auth"); return; }
    (async () => {
      setLoading(true);
      const { data: links } = await supabase
        .from("parent_student_links" as any)
        .select("student_id")
        .eq("parent_id", user.id);
      const ids = ((links as any[]) || []).map((l) => l.student_id);
      if (ids.length === 0) { setChildren([]); setLoading(false); return; }
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", ids);
      const opts = (profs || []).map((p: any) => ({
        id: p.id,
        name: `${p.first_name} ${p.last_name}`.trim() || "Dítě",
      }));
      setChildren(opts);
      setActiveChild(opts[0]?.id ?? null);
      setLoading(false);
    })();
  }, [authLoading, user, navigate]);

  // Load teachers for active child
  useEffect(() => {
    if (!activeChild || !user) { setTeachers([]); return; }
    (async () => {
      const { data: mems } = await supabase
        .from("class_members")
        .select("class_id")
        .eq("user_id", activeChild);
      const classIds = (mems ?? []).map((m: any) => m.class_id);
      if (classIds.length === 0) { setTeachers([]); return; }

      const { data: classes } = await supabase
        .from("classes")
        .select("id, name")
        .in("id", classIds);
      const classNameById: Record<string, string> = {};
      (classes ?? []).forEach((c: any) => { classNameById[c.id] = c.name; });

      const { data: ct } = await supabase
        .from("class_teachers")
        .select("class_id, user_id")
        .in("class_id", classIds);

      const { data: slots } = await supabase
        .from("class_schedule_slots")
        .select("class_id, subject_label")
        .in("class_id", classIds);

      const subjectsByClass: Record<string, Set<string>> = {};
      (slots ?? []).forEach((s: any) => {
        if (!s.subject_label) return;
        subjectsByClass[s.class_id] ??= new Set();
        subjectsByClass[s.class_id].add(s.subject_label);
      });

      const teacherIds = Array.from(new Set((ct ?? []).map((c: any) => c.user_id)));
      const { data: teacherProfs } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", teacherIds);
      const nameById: Record<string, string> = {};
      (teacherProfs ?? []).forEach((p: any) => {
        nameById[p.id] = `${p.first_name} ${p.last_name}`.trim() || "Učitel";
      });

      const aggregated: Record<string, TeacherOpt> = {};
      (ct ?? []).forEach((row: any) => {
        const tId = row.user_id;
        if (!aggregated[tId]) {
          aggregated[tId] = {
            id: tId,
            name: nameById[tId] ?? "Učitel",
            className: classNameById[row.class_id] ?? "",
            subjects: [],
          };
        }
        const subs = subjectsByClass[row.class_id];
        if (subs) {
          subs.forEach((s) => {
            if (!aggregated[tId].subjects.includes(s)) aggregated[tId].subjects.push(s);
          });
        }
      });

      const list = Object.values(aggregated);
      setTeachers(list);
      setActiveTeacher((prev) => prev && list.find((t) => t.id === prev) ? prev : list[0]?.id ?? null);
    })();
  }, [activeChild, user]);

  // Load unread counts for sidebar
  const loadUnreadCounts = async () => {
    if (!user || !activeChild) return;
    const { data } = await supabase
      .from("parent_messages" as any)
      .select("teacher_id")
      .eq("parent_id", user.id)
      .eq("student_id", activeChild)
      .eq("direction", "teacher_to_parent")
      .is("read_at", null);
    const counts: Record<string, number> = {};
    ((data as any[]) || []).forEach((m) => {
      counts[m.teacher_id] = (counts[m.teacher_id] ?? 0) + 1;
    });
    setUnreadByTeacher(counts);
  };

  useEffect(() => { loadUnreadCounts(); }, [user, activeChild, messages]);

  // Load chat messages for active teacher + child
  const loadMessages = async () => {
    if (!user || !activeChild || !activeTeacher) { setMessages([]); return; }
    const { data } = await supabase
      .from("parent_messages" as any)
      .select("*")
      .eq("parent_id", user.id)
      .eq("teacher_id", activeTeacher)
      .eq("student_id", activeChild)
      .order("created_at", { ascending: true });
    setMessages((data as any[]) || []);

    // Mark teacher_to_parent as read
    const unreadIds = ((data as any[]) || [])
      .filter((m) => m.direction === "teacher_to_parent" && !m.read_at)
      .map((m) => m.id);
    if (unreadIds.length > 0) {
      await supabase
        .from("parent_messages" as any)
        .update({ read_at: new Date().toISOString() })
        .in("id", unreadIds);
    }
  };

  useEffect(() => { loadMessages(); }, [user, activeChild, activeTeacher]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`parent-messages-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "parent_messages", filter: `parent_id=eq.${user.id}` },
        () => { loadMessages(); loadUnreadCounts(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeChild, activeTeacher]);

  const handleSend = async () => {
    if (!user || !activeChild || !activeTeacher) return;
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    const { error } = await supabase.from("parent_messages" as any).insert({
      parent_id: user.id,
      teacher_id: activeTeacher,
      student_id: activeChild,
      content: text,
      direction: "parent_to_teacher",
    });
    setSending(false);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    setDraft("");
    loadMessages();
  };

  const activeTeacherObj = useMemo(
    () => teachers.find((t) => t.id === activeTeacher) ?? null,
    [teachers, activeTeacher],
  );

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
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">Zprávy učitelům</h1>
        </div>

        {children.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <p className="text-muted-foreground">Nemáte propojené žádné dítě. Přidejte ho v rodičovském přehledu.</p>
            <Button className="mt-4" onClick={() => navigate("/rodic")}>Přejít na přehled</Button>
          </div>
        ) : (
          <>
            {children.length > 1 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {children.map((c) => (
                  <Button
                    key={c.id}
                    size="sm"
                    variant={activeChild === c.id ? "default" : "outline"}
                    onClick={() => { setActiveChild(c.id); setActiveTeacher(null); setShowChatMobile(false); }}
                  >
                    {c.name}
                  </Button>
                ))}
              </div>
            )}

            <div className="bg-card border border-border rounded-xl overflow-hidden grid grid-cols-1 md:grid-cols-[280px_1fr] min-h-[60vh]">
              {/* Teacher list */}
              <aside className={`border-r border-border ${showChatMobile ? "hidden md:block" : "block"}`}>
                <div className="p-3 border-b border-border">
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Učitelé</h2>
                </div>
                {teachers.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">Žádní učitelé.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {teachers.map((t) => {
                      const unread = unreadByTeacher[t.id] ?? 0;
                      const isActive = activeTeacher === t.id;
                      return (
                        <li key={t.id}>
                          <button
                            onClick={() => { setActiveTeacher(t.id); setShowChatMobile(true); }}
                            className={`w-full text-left p-3 flex items-start gap-2.5 hover:bg-muted/50 transition ${
                              isActive ? "bg-muted/60" : ""
                            }`}
                          >
                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <UserIcon className="w-4 h-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className={`text-sm truncate ${unread > 0 ? "font-bold text-foreground" : "font-medium text-foreground"}`}>
                                  {t.name}
                                </span>
                                {unread > 0 && (
                                  <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full px-1.5 min-w-[18px] h-[18px] flex items-center justify-center">
                                    {unread}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {t.className}{t.subjects.length > 0 ? ` · ${t.subjects.join(", ")}` : ""}
                              </p>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </aside>

              {/* Chat */}
              <section className={`flex flex-col ${!showChatMobile ? "hidden md:flex" : "flex"}`}>
                {!activeTeacherObj ? (
                  <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-6 text-center">
                    Vyberte učitele a začněte psát zprávu.
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
                        <h3 className="font-semibold text-foreground truncate">{activeTeacherObj.name}</h3>
                        <p className="text-xs text-muted-foreground truncate">
                          {activeTeacherObj.className}
                          {activeTeacherObj.subjects.length > 0 ? ` · ${activeTeacherObj.subjects.join(", ")}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-muted/20">
                      {messages.length === 0 ? (
                        <p className="text-center text-sm text-muted-foreground mt-8">
                          Zatím žádné zprávy. Napište první.
                        </p>
                      ) : (
                        messages.map((m) => {
                          const mine = m.direction === "parent_to_teacher";
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
                        })
                      )}
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
                        placeholder="Napište zprávu..."
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
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

export default ParentMessages;
