import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Paperclip, Send, Flag, Users, Plus, FileText } from "lucide-react";

type Contact = { id: string; name: string; is_teacher: boolean; class_id: string | null; class_name: string | null };
type Conv = { id: string; type: string; title: string | null; created_at: string };
type Msg = { id: string; conversation_id: string; sender_id: string; content: string; created_at: string };
type Att = { id: string; message_id: string; file_path: string; file_name: string; content_type: string };

const db = supabase as any;
const ALLOWED = ["application/pdf", "image/jpeg", "image/png"];
const safeName = (n: string) => n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");

const MessagesPage = () => {
  const { user, roles } = useAuth() as any;
  const uid: string | undefined = user?.id;
  const isTeacher = (roles ?? []).some((r: string) => r === "teacher" || r === "admin");
  const [params, setParams] = useSearchParams();
  const activeId = params.get("c");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [convs, setConvs] = useState<Conv[]>([]);
  const [parts, setParts] = useState<{ conversation_id: string; user_id: string; last_read_at: string | null }[]>([]);
  const [lastMsgs, setLastMsgs] = useState<Record<string, Msg>>({});
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [atts, setAtts] = useState<Att[]>([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [newOpen, setNewOpen] = useState<null | "direct" | "group">(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [groupTitle, setGroupTitle] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const names = useMemo(() => {
    const m: Record<string, string> = {};
    contacts.forEach((c) => (m[c.id] = c.name || "Uživatel"));
    return m;
  }, [contacts]);

  const loadList = useCallback(async () => {
    if (!uid) return;
    const [{ data: c }, { data: cs }, { data: p }] = await Promise.all([
      db.rpc("messenger_contacts"),
      db.from("conversations").select("*").order("created_at", { ascending: false }),
      db.from("conversation_participants").select("conversation_id,user_id,last_read_at"),
    ]);
    setContacts(c ?? []);
    setConvs(cs ?? []);
    setParts(p ?? []);
    const { data: lm } = await db.from("messages").select("*").order("created_at", { ascending: false }).limit(500);
    const map: Record<string, Msg> = {};
    (lm ?? []).forEach((m: Msg) => { if (!map[m.conversation_id]) map[m.conversation_id] = m; });
    setLastMsgs(map);
  }, [uid]);

  useEffect(() => { loadList(); }, [loadList]);

  const loadConv = useCallback(async (id: string) => {
    const { data } = await db.from("messages").select("*").eq("conversation_id", id).order("created_at");
    setMsgs(data ?? []);
    const ids = (data ?? []).map((m: Msg) => m.id);
    if (ids.length) {
      const { data: a } = await db.from("message_attachments").select("*").in("message_id", ids);
      setAtts(a ?? []);
    } else setAtts([]);
    if (uid) await db.from("conversation_participants").update({ last_read_at: new Date().toISOString() }).eq("conversation_id", id).eq("user_id", uid);
  }, [uid]);

  useEffect(() => { if (activeId) loadConv(activeId); }, [activeId, loadConv]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  useEffect(() => {
    if (!uid) return;
    const ch = supabase
      .channel("messenger-" + uid)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const m = payload.new as Msg;
        setLastMsgs((prev) => ({ ...prev, [m.conversation_id]: m }));
        if (m.conversation_id === activeId) loadConv(m.conversation_id);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversation_participants" }, () => loadList())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [uid, activeId, loadConv, loadList]);

  const convName = (c: Conv) => {
    if (c.type === "group") return c.title || "Skupina";
    const other = parts.find((p) => p.conversation_id === c.id && p.user_id !== uid);
    return other ? names[other.user_id] ?? "Uživatel" : "Konverzace";
  };
  const isUnread = (c: Conv) => {
    const lm = lastMsgs[c.id];
    if (!lm || lm.sender_id === uid) return false;
    const me = parts.find((p) => p.conversation_id === c.id && p.user_id === uid);
    return !me?.last_read_at || new Date(lm.created_at) > new Date(me.last_read_at);
  };

  const send = async () => {
    if (!activeId || !uid || (!text.trim() && !file)) return;
    if (file && (!ALLOWED.includes(file.type) || file.size > 10 * 1024 * 1024)) {
      toast.error("Příloha musí být PDF, JPG nebo PNG do 10 MB.");
      return;
    }
    let path: string | null = null;
    if (file) {
      path = `${activeId}/${uid}/${crypto.randomUUID()}-${safeName(file.name)}`;
      const { error } = await supabase.storage.from("message-attachments").upload(path, file, { contentType: file.type });
      if (error) { toast.error("Přílohu se nepodařilo nahrát."); return; }
    }
    const { data: m, error } = await db.from("messages").insert({ conversation_id: activeId, sender_id: uid, content: text.trim() }).select().single();
    if (error) { toast.error("Zprávu se nepodařilo odeslat."); return; }
    if (path && file) {
      await db.from("message_attachments").insert({ message_id: m.id, file_path: path, file_name: file.name, file_size: file.size, content_type: file.type });
    }
    setText(""); setFile(null);
    loadConv(activeId);
  };

  const openAtt = async (a: Att) => {
    const { data } = await supabase.storage.from("message-attachments").createSignedUrl(a.file_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  };

  const report = async (m: Msg) => {
    const reason = window.prompt("Proč zprávu nahlašujete? (nepovinné)") ?? null;
    const { error } = await db.from("message_reports").insert({ message_id: m.id, reporter_id: uid, reason: reason || null });
    if (error) toast.error("Nahlášení se nepodařilo."); else toast.success("Zpráva byla nahlášena administrátorovi školy.");
  };

  const create = async () => {
    if (!uid || picked.size === 0) return;
    const type = newOpen!;
    if (type === "direct") {
      const target = [...picked][0];
      const existing = convs.find((c) => c.type === "direct" && parts.some((p) => p.conversation_id === c.id && p.user_id === target));
      if (existing) { setParams({ c: existing.id }); setNewOpen(null); return; }
    }
    if (type === "group" && !groupTitle.trim()) { toast.error("Zadejte název skupiny."); return; }
    const { data: c, error } = await db.from("conversations").insert({ type, title: type === "group" ? groupTitle.trim() : null, created_by: uid }).select().single();
    if (error) { toast.error("Konverzaci se nepodařilo založit."); return; }
    await db.from("conversation_participants").insert({ conversation_id: c.id, user_id: uid });
    const others = type === "direct" ? [[...picked][0]] : [...picked];
    const { error: pe } = await db.from("conversation_participants").insert(others.map((id) => ({ conversation_id: c.id, user_id: id })));
    if (pe) toast.error("Některé účastníky se nepodařilo přidat.");
    setNewOpen(null); setPicked(new Set()); setGroupTitle("");
    await loadList();
    setParams({ c: c.id });
  };

  const uniqueContacts = useMemo(() => {
    const m = new Map<string, Contact>();
    contacts.forEach((c) => { if (!m.has(c.id)) m.set(c.id, c); });
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, "cs"));
  }, [contacts]);
  const classes = useMemo(() => {
    const m = new Map<string, { name: string; ids: string[] }>();
    contacts.forEach((c) => {
      if (!c.class_id || c.is_teacher) return;
      const e = m.get(c.class_id) ?? { name: c.class_name ?? "Třída", ids: [] };
      e.ids.push(c.id); m.set(c.class_id, e);
    });
    return [...m.entries()];
  }, [contacts]);

  const toggle = (id: string) => setPicked((prev) => {
    const n = new Set(newOpen === "direct" ? [] : prev);
    if (prev.has(id) && newOpen !== "direct") n.delete(id); else n.add(id);
    return n;
  });

  const active = convs.find((c) => c.id === activeId);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto max-w-6xl px-4 pt-24 pb-8">
        <h1 className="text-3xl font-bold mb-4">Zprávy</h1>
        <div className="grid md:grid-cols-[300px_1fr] gap-4 h-[70vh]">
          <aside className="border border-border rounded-xl bg-card flex flex-col overflow-hidden">
            <div className="p-3 flex gap-2 border-b border-border">
              <Button size="sm" onClick={() => { setPicked(new Set()); setNewOpen("direct"); }}><Plus size={16} className="mr-1" />Nová zpráva</Button>
              {isTeacher && <Button size="sm" variant="outline" onClick={() => { setPicked(new Set()); setNewOpen("group"); }}><Users size={16} className="mr-1" />Nová skupina</Button>}
            </div>
            <div className="overflow-y-auto flex-1">
              {convs.length === 0 && <p className="p-4 text-sm text-muted-foreground">Zatím žádné konverzace.</p>}
              {[...convs].sort((a, b) => (lastMsgs[b.id]?.created_at ?? b.created_at).localeCompare(lastMsgs[a.id]?.created_at ?? a.created_at)).map((c) => (
                <button key={c.id} onClick={() => setParams({ c: c.id })}
                  className={`w-full text-left px-4 py-3 border-b border-border hover:bg-muted/40 ${c.id === activeId ? "bg-muted" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`truncate text-sm ${isUnread(c) ? "font-bold" : "font-medium"}`}>{convName(c)}</span>
                    {isUnread(c) && <span className="h-2 w-2 rounded-full bg-primary shrink-0" aria-label="Nepřečteno" />}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{lastMsgs[c.id]?.content || (lastMsgs[c.id] ? "Příloha" : "Bez zpráv")}</div>
                </button>
              ))}
            </div>
          </aside>
          <section className="border border-border rounded-xl bg-card flex flex-col overflow-hidden">
            {!active ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Vyberte konverzaci.</div>
            ) : (
              <>
                <div className="p-3 border-b border-border font-semibold">{convName(active)}</div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {msgs.map((m) => {
                    const mine = m.sender_id === uid;
                    return (
                      <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                          {!mine && <div className="text-xs font-semibold mb-0.5">{names[m.sender_id] ?? "Uživatel"}</div>}
                          {m.content && <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>}
                          {atts.filter((a) => a.message_id === m.id).map((a) => (
                            <button key={a.id} onClick={() => openAtt(a)} className="mt-1 flex items-center gap-1 text-xs underline">
                              <FileText size={14} />{a.file_name}
                            </button>
                          ))}
                          <div className="flex items-center gap-2 mt-1 text-[11px] opacity-70">
                            {new Date(m.created_at).toLocaleString("cs-CZ")}
                            {!mine && (
                              <button onClick={() => report(m)} className="flex items-center gap-0.5 hover:underline" aria-label="Nahlásit zprávu">
                                <Flag size={12} />Nahlásit
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={endRef} />
                </div>
                <div className="p-3 border-t border-border space-y-2">
                  {file && <div className="text-xs text-muted-foreground">Příloha: {file.name} <button className="underline" onClick={() => setFile(null)}>odebrat</button></div>}
                  <div className="flex gap-2 items-end">
                    <label className="cursor-pointer p-2 text-muted-foreground hover:text-primary" aria-label="Přidat přílohu">
                      <Paperclip size={18} />
                      <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                    </label>
                    <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Napište zprávu…"
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
                    <Button onClick={send} aria-label="Odeslat"><Send size={16} /></Button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </main>

      <Dialog open={!!newOpen} onOpenChange={(o) => !o && setNewOpen(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{newOpen === "group" ? "Nová skupina" : "Nová zpráva"}</DialogTitle></DialogHeader>
          {newOpen === "group" && (
            <>
              <Input placeholder="Název skupiny" value={groupTitle} onChange={(e) => setGroupTitle(e.target.value)} />
              {classes.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {classes.map(([id, c]) => (
                    <Button key={id} size="sm" variant="outline" onClick={() => setPicked((p) => new Set([...p, ...c.ids]))}>+ {c.name}</Button>
                  ))}
                </div>
              )}
            </>
          )}
          <div className="space-y-1 max-h-[45vh] overflow-y-auto">
            {uniqueContacts.length === 0 && <p className="text-sm text-muted-foreground">Nemáte zatím žádné kontakty.</p>}
            {uniqueContacts.map((c) => (
              <label key={c.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/40 cursor-pointer">
                <Checkbox checked={picked.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                <span className="text-sm">{c.name || "Uživatel"}</span>
                {c.is_teacher && <span className="text-xs text-muted-foreground">učitel</span>}
              </label>
            ))}
          </div>
          <Button onClick={create} disabled={picked.size === 0}>
            {newOpen === "group" ? `Vytvořit skupinu (${picked.size})` : "Otevřít konverzaci"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MessagesPage;
