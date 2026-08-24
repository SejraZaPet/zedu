import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Pencil, Trash2, Save, X, BookOpen } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface StaffArticle {
  id: string;
  title: string;
  content: string;
  category: string | null;
  updated_at: string;
}

/** Minimalistický renderer podmnožiny markdownu: ##/### nadpisy, odrážky, **tučné**, odstavce. */
const renderInline = (text: string) => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
};

const MarkdownView = ({ content }: { content: string }) => {
  const blocks: JSX.Element[] = [];
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  let listBuffer: string[] = [];
  let paraBuffer: string[] = [];

  const flushList = () => {
    if (!listBuffer.length) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="list-disc pl-6 space-y-1 text-muted-foreground mb-4">
        {listBuffer.map((li, i) => <li key={i}>{renderInline(li)}</li>)}
      </ul>,
    );
    listBuffer = [];
  };
  const flushPara = () => {
    if (!paraBuffer.length) return;
    blocks.push(
      <p key={`p-${blocks.length}`} className="text-base leading-relaxed text-muted-foreground mb-4">
        {renderInline(paraBuffer.join(" "))}
      </p>,
    );
    paraBuffer = [];
  };

  lines.forEach((raw) => {
    const line = raw.trim();
    if (!line) { flushList(); flushPara(); return; }
    if (line.startsWith("### ")) {
      flushList(); flushPara();
      blocks.push(<h3 key={`h3-${blocks.length}`} className="font-heading text-lg mt-6 mb-2 text-foreground">{renderInline(line.slice(4))}</h3>);
      return;
    }
    if (line.startsWith("## ")) {
      flushList(); flushPara();
      blocks.push(<h2 key={`h2-${blocks.length}`} className="font-heading text-xl mt-8 mb-3 text-foreground">{renderInline(line.slice(3))}</h2>);
      return;
    }
    if (line.startsWith("# ")) {
      flushList(); flushPara();
      blocks.push(<h2 key={`h1-${blocks.length}`} className="font-heading text-2xl mt-8 mb-3 text-foreground">{renderInline(line.slice(2))}</h2>);
      return;
    }
    if (/^[-*]\s+/.test(line)) { flushPara(); listBuffer.push(line.replace(/^[-*]\s+/, "")); return; }
    flushList();
    paraBuffer.push(line);
  });
  flushList();
  flushPara();

  return <div className="max-w-none">{blocks}</div>;
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("cs-CZ", { day: "2-digit", month: "2-digit", year: "numeric" });

const StaffKnowledgeManager = () => {
  const { isAdmin } = useStaffPermissions();
  const [articles, setArticles] = useState<StaffArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<StaffArticle> | null>(null);
  const [isNew, setIsNew] = useState(false);

  const fetchArticles = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("staff_knowledge_articles")
      .select("id, title, content, category, updated_at")
      .order("category", { ascending: true })
      .order("title", { ascending: true });
    setArticles((data as StaffArticle[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchArticles(); }, []);

  const openArticle = useMemo(
    () => articles.find((a) => a.id === openId) ?? null,
    [articles, openId],
  );

  const save = async () => {
    if (!editing?.title?.trim()) {
      toast({ title: "Zadejte název článku", variant: "destructive" });
      return;
    }
    const payload = {
      title: editing.title.trim(),
      content: editing.content ?? "",
      category: editing.category?.trim() || null,
    };
    const { error } = isNew
      ? await supabase.from("staff_knowledge_articles").insert(payload)
      : await supabase.from("staff_knowledge_articles").update(payload).eq("id", editing.id!);
    if (error) {
      toast({ title: "Uložení se nepovedlo", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: isNew ? "Článek vytvořen" : "Článek uložen" });
    setEditing(null);
    setIsNew(false);
    fetchArticles();
  };

  const remove = async (id: string) => {
    if (!confirm("Opravdu smazat tento článek?")) return;
    const { error } = await supabase.from("staff_knowledge_articles").delete().eq("id", id);
    if (error) {
      toast({ title: "Smazání se nepovedlo", description: error.message, variant: "destructive" });
      return;
    }
    setOpenId(null);
    fetchArticles();
  };

  // Editor (jen admin)
  if (editing && isAdmin) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => { setEditing(null); setIsNew(false); }}>
            <ArrowLeft className="w-4 h-4 mr-1" />Zpět
          </Button>
          <span className="text-sm text-muted-foreground">{isNew ? "Nový článek" : "Úprava článku"}</span>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <Label>Název</Label>
              <Input className="mt-1" value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </div>
            <div>
              <Label>Kategorie</Label>
              <Input className="mt-1" placeholder="např. CRM" value={editing.category ?? ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Obsah (markdown: ## nadpis, - odrážka, **tučně**)</Label>
            <Textarea className="mt-1 font-mono text-sm min-h-[320px]" value={editing.content ?? ""} onChange={(e) => setEditing({ ...editing, content: e.target.value })} />
          </div>
          <div className="flex gap-2 pt-2 border-t border-border">
            <Button size="sm" onClick={save}><Save className="w-4 h-4 mr-1" />Uložit</Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(null); setIsNew(false); }}><X className="w-4 h-4 mr-1" />Zrušit</Button>
          </div>
        </div>
      </div>
    );
  }

  // Čtecí pohled
  if (openArticle) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setOpenId(null)}>
            <ArrowLeft className="w-4 h-4 mr-1" />Zpět na seznam
          </Button>
          {isAdmin && (
            <div className="ml-auto flex gap-1">
              <Button size="sm" variant="outline" onClick={() => { setEditing(openArticle); setIsNew(false); }}>
                <Pencil className="w-4 h-4 mr-1" />Upravit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => remove(openArticle.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          )}
        </div>
        <article className="border border-border rounded-lg p-6 bg-card">
          <div className="flex items-center gap-2 mb-1">
            {openArticle.category && <Badge variant="secondary" className="text-xs">{openArticle.category}</Badge>}
            <span className="text-xs text-muted-foreground">Upraveno {fmtDate(openArticle.updated_at)}</span>
          </div>
          <h1 className="font-heading text-2xl mb-4">{openArticle.title}</h1>
          <MarkdownView content={openArticle.content} />
        </article>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-heading text-xl">Interní akademie</h2>
        {isAdmin && (
          <Button size="sm" onClick={() => { setEditing({ title: "", content: "", category: "" }); setIsNew(true); }}>
            <Plus className="w-4 h-4 mr-1" />Nový článek
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-6">Návody a dokumenty pro tým Bezli.</p>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Načítání…</p>
      ) : articles.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Zatím žádné interní návody.</p>
      ) : (
        <div className="space-y-2">
          {articles.map((a) => (
            <div key={a.id} className="flex items-center gap-3 border border-border rounded-lg p-3 bg-card">
              <BookOpen className="w-4 h-4 text-muted-foreground shrink-0" />
              <button className="min-w-0 flex-1 text-left" onClick={() => setOpenId(a.id)}>
                <p className="font-medium text-sm truncate hover:text-primary transition-colors">{a.title}</p>
                <p className="text-xs text-muted-foreground">
                  {a.category ? `${a.category} · ` : ""}upraveno {fmtDate(a.updated_at)}
                </p>
              </button>
              {isAdmin && (
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(a); setIsNew(false); }}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(a.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StaffKnowledgeManager;
