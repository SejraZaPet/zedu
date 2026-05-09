import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Award, Trophy, FileText, Lightbulb, Paperclip, MessageSquare,
  Trash2, ExternalLink, Filter,
} from "lucide-react";
import {
  PortfolioItem, PortfolioComment, TYPE_LABEL, getAttachmentSignedUrl,
} from "@/lib/portfolio";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  items: PortfolioItem[];
  /** Whether the current viewer can delete manual items (i.e. it's the student themselves). */
  canDelete?: boolean;
  /** If true, viewer is a teacher and can post comments. */
  canComment?: boolean;
  onItemDeleted?: (id: string) => void;
}

const ICONS: Record<string, any> = {
  worksheet_result: FileText,
  project: Paperclip,
  reflection: Lightbulb,
  upload: Paperclip,
  achievement: Trophy,
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" });
}

export default function PortfolioTimeline({
  items, canDelete, canComment, onItemDeleted,
}: Props) {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("all");

  const subjects = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => i.subject && set.add(i.subject));
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const now = Date.now();
    return items.filter((i) => {
      if (typeFilter !== "all" && i.type !== typeFilter) return false;
      if (subjectFilter !== "all" && (i.subject ?? "") !== subjectFilter) return false;
      if (periodFilter !== "all") {
        const ageDays = (now - new Date(i.created_at).getTime()) / 86_400_000;
        if (periodFilter === "30" && ageDays > 30) return false;
        if (periodFilter === "90" && ageDays > 90) return false;
        if (periodFilter === "365" && ageDays > 365) return false;
      }
      return true;
    });
  }, [items, typeFilter, subjectFilter, periodFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Typ" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Všechny typy</SelectItem>
            {Object.entries(TYPE_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Předmět" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Všechny předměty</SelectItem>
            {subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Období" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vše</SelectItem>
            <SelectItem value="30">Posledních 30 dní</SelectItem>
            <SelectItem value="90">Posledních 90 dní</SelectItem>
            <SelectItem value="365">Poslední rok</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-sm text-muted-foreground">
          {filtered.length} z {items.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          Zatím tu nic není.
        </CardContent></Card>
      ) : (
        <ol className="relative border-l border-border ml-3 space-y-4">
          {filtered.map((item) => (
            <PortfolioCard
              key={item.id}
              item={item}
              canDelete={!!canDelete && !item.synthetic}
              canComment={!!canComment}
              onDeleted={onItemDeleted}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function PortfolioCard({
  item, canDelete, canComment, onDeleted,
}: {
  item: PortfolioItem;
  canDelete: boolean;
  canComment: boolean;
  onDeleted?: (id: string) => void;
}) {
  const Icon = ICONS[item.type] || Award;
  const [comments, setComments] = useState<PortfolioComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [busy, setBusy] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (item.synthetic) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("student_portfolio_comments")
        .select("*")
        .eq("item_id", item.id)
        .order("created_at", { ascending: true });
      if (!cancelled) setComments((data ?? []) as PortfolioComment[]);
    })();
    return () => { cancelled = true; };
  }, [item.id, item.synthetic]);

  useEffect(() => {
    let cancelled = false;
    if (item.attachment_url) {
      getAttachmentSignedUrl(item.attachment_url).then((u) => {
        if (!cancelled) setSignedUrl(u);
      });
    }
    return () => { cancelled = true; };
  }, [item.attachment_url]);

  const remove = async () => {
    if (!confirm("Opravdu smazat tuto položku?")) return;
    setBusy(true);
    const { error } = await supabase
      .from("student_portfolio_items")
      .delete()
      .eq("id", item.id);
    setBusy(false);
    if (error) { toast.error("Smazání se nezdařilo"); return; }
    if (item.attachment_url) {
      await supabase.storage.from("student-portfolio").remove([item.attachment_url]);
    }
    onDeleted?.(item.id);
    toast.success("Smazáno");
  };

  const postComment = async () => {
    if (!commentText.trim() || !user) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("student_portfolio_comments")
      .insert({ item_id: item.id, author_id: user.id, body: commentText.trim() })
      .select()
      .single();
    setBusy(false);
    if (error) { toast.error("Komentář se nepodařilo přidat"); return; }
    setComments((c) => [...c, data as PortfolioComment]);
    setCommentText("");
  };

  return (
    <li className="ml-4">
      <span className="absolute -left-[9px] mt-3 w-4 h-4 rounded-full bg-primary border-2 border-background" />
      <Card>
        <CardContent className="py-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold truncate">{item.title}</h3>
                  <Badge variant="outline" className="text-[10px]">{TYPE_LABEL[item.type] || item.type}</Badge>
                  {item.subject && <Badge variant="secondary" className="text-[10px]">{item.subject}</Badge>}
                  {item.synthetic && <Badge variant="outline" className="text-[10px]">Automaticky</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{formatDate(item.created_at)}</p>
                {item.description && (
                  <p className="text-sm text-foreground mt-2 whitespace-pre-wrap">{item.description}</p>
                )}
                {item.type === "worksheet_result" && item.content_json?.score != null && (
                  <p className="text-sm mt-2">
                    Skóre: <span className="font-semibold">{item.content_json.score}{item.content_json.max_score ? ` / ${item.content_json.max_score}` : ""}</span>
                  </p>
                )}
                {signedUrl && (
                  <a
                    href={signedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Otevřít přílohu
                  </a>
                )}
              </div>
            </div>
            {canDelete && (
              <Button size="icon" variant="ghost" onClick={remove} disabled={busy} aria-label="Smazat">
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>

          {!item.synthetic && (comments.length > 0 || canComment) && (
            <div className="border-t border-border pt-3 space-y-2">
              {comments.map((c) => (
                <div key={c.id} className="text-sm bg-muted/40 rounded p-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <MessageSquare className="w-3 h-3" />
                    {formatDate(c.created_at)}
                  </div>
                  <p className="whitespace-pre-wrap">{c.body}</p>
                </div>
              ))}
              {canComment && (
                <div className="flex gap-2">
                  <Input
                    placeholder="Přidat komentář…"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") postComment(); }}
                  />
                  <Button size="sm" onClick={postComment} disabled={busy || !commentText.trim()}>
                    Odeslat
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </li>
  );
}

// Re-export Textarea so consumers don't need extra import (kept for tree-shaking elsewhere)
export { Textarea };
