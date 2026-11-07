import { fetchRecipientsMap } from "@/lib/assignment-recipients";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { BookOpen, ClipboardList, Megaphone, MessageCircle, MessageSquare, Pin, Trash2, Pencil, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { assignmentKind, isPinned, KIND_LABELS, type AssignmentKind } from "@/lib/assignment-kind";
import { assignmentDescriptionToText } from "@/lib/assignment-description";
import {
  buildWallFeed, wallAnnouncements, commentsEnabled, canEditComment, canDeleteComment, threadFor,
  commentErrorMessage, WALL_PAGE, COMMENT_MAX, type WallComment,
} from "@/lib/class-wall";

export interface WallPost {
  id: string; title: string; description?: string | null; status?: string | null;
  created_at?: string | null; settings?: unknown; teacher_id?: string | null;
}
interface Props {
  items: WallPost[];
  teacher?: boolean;
  openPath: (a: WallPost) => string;
  onShowAllAnnouncements: () => void;
}

const db = supabase as any;
const ICON: Record<AssignmentKind, typeof ClipboardList> = { task: ClipboardList, material: BookOpen, announcement: Megaphone };
const shortName = (n?: string) => { const p = (n ?? "").trim().split(/\s+/).filter(Boolean); return p.length >= 2 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0] ?? ""; };
const fmt = (v?: string | null) => (v ? format(new Date(v), "d. M. yyyy HH:mm", { locale: cs }) : "");

export default function ClassWall({ items, teacher, openPath, onShowAllAnnouncements }: Props) {
  const { user } = useAuth();
  const uid = user?.id;
  const navigate = useNavigate();
  const [local, setLocal] = useState<Record<string, unknown>>({}); // settings po přepnutí komentářů
  const withLocal = useMemo(() => items.map((i) => (local[i.id] ? { ...i, settings: local[i.id] } : i)), [items, local]);
  const feed = useMemo(() => buildWallFeed(withLocal), [withLocal]);
  const announcements = useMemo(() => wallAnnouncements(withLocal, 3), [withLocal]);
  const [limit, setLimit] = useState(WALL_PAGE);
  const page = feed.slice(0, limit);
  const [comments, setComments] = useState<WallComment[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState<{ post: WallPost; text: string } | null>(null);

  const ids = useMemo(() => page.filter((p) => commentsEnabled(p.settings)).map((p) => p.id), [page]);
  const idsKey = ids.join(",");
  const load = useCallback(async () => {
    if (!ids.length) { setComments([]); return; }
    const { data } = await db.from("assignment_comments")
      .select("id, assignment_id, author_id, body, created_at, deleted_at")
      .in("assignment_id", ids).order("created_at");
    setComments(data ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);
  useEffect(() => { load(); }, [load]);
  const [recipients, setRecipients] = useState<Record<string, string[]>>({});
  const pageKey = page.map((p) => p.id).join(",");
  useEffect(() => {
    if (!teacher || !pageKey) return;
    fetchRecipientsMap(pageKey.split(",")).then(setRecipients).catch(() => {});
  }, [teacher, pageKey]);
  useEffect(() => {
    if (!uid) return;
    db.rpc("messenger_contacts").then(({ data }: { data: { id: string; name: string }[] | null }) => {
      const m: Record<string, string> = {};
      (data ?? []).forEach((c) => { if (c.name) m[c.id] = shortName(c.name); });
      setNames(m);
    });
  }, [uid]);

  const authorLabel = (c: WallComment, post: WallPost) =>
    c.author_id === uid ? "Vy" : c.author_id === post.teacher_id ? (names[c.author_id] ? `${names[c.author_id]} (učitel)` : "Učitel") : names[c.author_id] || "Spolužák";

  const add = async (postId: string) => {
    const body = (drafts[postId] ?? "").trim();
    if (!body || !uid) return;
    setBusy(true);
    const { error } = await db.from("assignment_comments").insert({ assignment_id: postId, author_id: uid, body });
    setBusy(false);
    if (error) { toast.error(commentErrorMessage(error.message)); return; }
    setDrafts((d) => ({ ...d, [postId]: "" }));
    load();
  };
  const saveEdit = async () => {
    if (!editing) return;
    const body = editing.body.trim();
    if (!body) return;
    setBusy(true);
    const { error } = await db.from("assignment_comments").update({ body }).eq("id", editing.id);
    setBusy(false);
    if (error) { toast.error(commentErrorMessage(error.message)); return; }
    setEditing(null); load();
  };
  const remove = async (c: WallComment) => {
    const own = c.author_id === uid;
    if (!window.confirm(own ? "Smazat váš komentář?" : "Skrýt tento komentář? Žáci uvidí „Komentář odstranil učitel“.")) return;
    const { error } = own
      ? await db.from("assignment_comments").delete().eq("id", c.id)
      : await db.from("assignment_comments").update({ deleted_at: new Date().toISOString() }).eq("id", c.id);
    if (error) toast.error(commentErrorMessage(error.message)); else load();
  };
  const toggleComments = async (post: WallPost, on: boolean) => {
    const next = { ...((post.settings as Record<string, unknown>) ?? {}), commentsEnabled: on };
    const { error } = await db.from("assignments").update({ settings: next }).eq("id", post.id);
    if (error) { toast.error("Nastavení komentářů se nepodařilo uložit."); return; }
    setLocal((l) => ({ ...l, [post.id]: next }));
  };

  const sendAsk = async () => {
    if (!ask || !uid || !ask.post.teacher_id) return;
    const text = ask.text.trim();
    if (!text) return;
    setBusy(true);
    try {
      const teacherId = ask.post.teacher_id;
      const { data: contacts } = await db.rpc("messenger_contacts");
      if (!(contacts ?? []).some((c: { id: string }) => c.id === teacherId)) throw new Error("Učiteli teď nejde napsat přes Zprávy.");
      const { data: mine } = await db.from("conversation_participants").select("conversation_id").eq("user_id", uid);
      const convIds = (mine ?? []).map((p: { conversation_id: string }) => p.conversation_id);
      let convId: string | null = null;
      if (convIds.length) {
        const { data: direct } = await db.from("conversations").select("id").eq("type", "direct").in("id", convIds);
        const directIds = (direct ?? []).map((d: { id: string }) => d.id);
        if (directIds.length) {
          const { data: hit } = await db.from("conversation_participants").select("conversation_id").eq("user_id", teacherId).in("conversation_id", directIds).limit(1);
          convId = hit?.[0]?.conversation_id ?? null;
        }
      }
      if (!convId) {
        const { data: c, error } = await db.from("conversations").insert({ type: "direct", title: null, created_by: uid }).select().single();
        if (error) throw new Error("Konverzaci se nepodařilo založit.");
        await db.from("conversation_participants").insert({ conversation_id: c.id, user_id: uid });
        const { error: pe } = await db.from("conversation_participants").insert({ conversation_id: c.id, user_id: teacherId });
        if (pe) throw new Error("Učitele se nepodařilo přidat do konverzace.");
        convId = c.id;
      }
      const { error: me } = await db.from("messages").insert({ conversation_id: convId, sender_id: uid, content: text });
      if (me) throw new Error("Zprávu se nepodařilo odeslat.");
      setAsk(null);
      navigate(`/zpravy?c=${convId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Zprávu se nepodařilo odeslat.");
    } finally { setBusy(false); }
  };

  return (
    <section className="min-w-0 space-y-4" data-testid="class-wall">
      <Card className="min-w-0 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-primary to-accent" aria-hidden />
        <div className="space-y-2 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-semibold"><Megaphone className="h-4 w-4 text-primary" aria-hidden />Oznámení</h2>
            <Button variant="link" className="min-h-11 px-0" onClick={onShowAllAnnouncements}>Všechna oznámení</Button>
          </div>
          {announcements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Zatím žádná oznámení.</p>
          ) : (
            <ul className="space-y-2">
              {announcements.map((a) => (
                <li key={a.id} className="rounded-md bg-muted/50 p-3">
                  <p className="break-words text-sm font-medium">{isPinned(a.settings) && <Pin className="mr-1 inline h-3.5 w-3.5 text-primary" aria-label="Připnuto" />}{a.title}</p>
                  {a.description && <p className="line-clamp-3 break-words text-sm text-muted-foreground">{assignmentDescriptionToText(a.description)}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <h2 className="font-semibold">Zeď</h2>
      {page.length === 0 ? (
        <p className="text-sm text-muted-foreground">Zatím tu nic není.</p>
      ) : (
        <ul className="space-y-3">
          {page.map((post) => {
            const kind = assignmentKind(post.settings);
            const Icon = ICON[kind];
            const enabled = commentsEnabled(post.settings);
            const { shown, hidden } = threadFor(comments, post.id, expanded.has(post.id));
            const moderator = !!teacher;
            return (
              <li key={post.id}>
                <Card className="min-w-0 space-y-3 p-4" data-testid={`wall-post-${post.id}`}>
                  <div className="flex flex-wrap items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground"><Icon className="h-4 w-4" aria-hidden /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">{KIND_LABELS[kind]} · {fmt(post.created_at)}</p>
                      <p className="break-words font-medium">{post.title}</p>
                      {teacher && (recipients[post.id]?.length ?? 0) > 0 && <p className="text-xs text-muted-foreground">Jen vybraní žáci ({recipients[post.id].length})</p>}
                      {post.description && <p className="line-clamp-3 break-words text-sm text-muted-foreground">{assignmentDescriptionToText(post.description)}</p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" className="min-h-11 sm:min-h-9" onClick={() => navigate(openPath(post))}>Otevřít <ExternalLink className="ml-1 h-3 w-3" /></Button>
                    {teacher && (
                      <label className="flex min-h-11 items-center gap-2 text-sm">
                        <Switch checked={enabled} onCheckedChange={(v) => toggleComments(post, v)} aria-label="Povolit komentáře" />
                        Povolit komentáře
                      </label>
                    )}
                    {!teacher && !enabled && kind === "task" && post.teacher_id && (
                      <Button size="sm" variant="ghost" className="min-h-11 sm:min-h-9" onClick={() => setAsk({ post, text: `Dotaz k úkolu „${post.title}“: ` })}>
                        <MessageCircle className="mr-1 h-4 w-4" />Zeptat se učitele
                      </Button>
                    )}
                  </div>

                  {enabled && (
                    <div className="space-y-2 border-t border-border pt-3">
                      {hidden > 0 && (
                        <Button variant="link" size="sm" className="min-h-11 px-0" onClick={() => setExpanded((s) => new Set(s).add(post.id))}>Zobrazit další komentáře ({hidden})</Button>
                      )}
                      {shown.map((c) => (
                        <div key={c.id} className="min-w-0 rounded-md bg-muted/40 p-2 text-sm">
                          {c.deleted_at ? (
                            <p className="italic text-muted-foreground">Komentář odstranil učitel</p>
                          ) : editing?.id === c.id ? (
                            <div className="space-y-2">
                              <Textarea value={editing.body} maxLength={COMMENT_MAX} onChange={(e) => setEditing({ id: c.id, body: e.target.value })} aria-label="Upravit komentář" />
                              <div className="flex gap-2">
                                <Button size="sm" className="min-h-11 sm:min-h-9" disabled={busy} onClick={saveEdit}>Uložit</Button>
                                <Button size="sm" variant="ghost" className="min-h-11 sm:min-h-9" onClick={() => setEditing(null)}>Zrušit</Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="text-xs text-muted-foreground">{authorLabel(c, post)} · {fmt(c.created_at)}</p>
                              <p className="whitespace-pre-wrap break-words">{c.body}</p>
                              <div className="flex flex-wrap gap-1">
                                {canEditComment(c, comments, uid) && (
                                  <Button size="sm" variant="ghost" className="min-h-11 sm:min-h-8" onClick={() => setEditing({ id: c.id, body: c.body })}><Pencil className="mr-1 h-3 w-3" />Upravit</Button>
                                )}
                                {canDeleteComment(c, uid, moderator) && (
                                  <Button size="sm" variant="ghost" className="min-h-11 sm:min-h-8" onClick={() => remove(c)}><Trash2 className="mr-1 h-3 w-3" />{c.author_id === uid ? "Smazat" : "Skrýt"}</Button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                        <Textarea rows={2} maxLength={COMMENT_MAX} placeholder="Napsat komentář…" aria-label={`Komentář k „${post.title}“`}
                          value={drafts[post.id] ?? ""} onChange={(e) => setDrafts((d) => ({ ...d, [post.id]: e.target.value }))} className="min-w-0 flex-1" />
                        <Button className="min-h-11" disabled={busy || !(drafts[post.id] ?? "").trim()} onClick={() => add(post.id)}>
                          <MessageSquare className="mr-1 h-4 w-4" />Odeslat
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      {feed.length > limit && (
        <Button variant="outline" className="min-h-11 w-full" onClick={() => setLimit((l) => l + WALL_PAGE)}>Zobrazit další</Button>
      )}

      <Dialog open={!!ask} onOpenChange={(o) => !o && setAsk(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Zeptat se učitele</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Zpráva se pošle soukromě jen učiteli do Zpráv.</p>
          <Textarea rows={4} value={ask?.text ?? ""} onChange={(e) => setAsk((a) => (a ? { ...a, text: e.target.value } : a))} aria-label="Zpráva učiteli" />
          <DialogFooter>
            <Button variant="ghost" className="min-h-11" onClick={() => setAsk(null)}>Zrušit</Button>
            <Button className="min-h-11" disabled={busy || !ask?.text.trim()} onClick={sendAsk}>Odeslat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
