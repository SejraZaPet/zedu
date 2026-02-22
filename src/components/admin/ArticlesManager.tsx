import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, X, Save } from "lucide-react";

interface Article {
  id: string;
  title: string;
  category: string;
  published_date: string;
  excerpt: string;
  content: string;
}

const ArticlesManager = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [editing, setEditing] = useState<Article | null>(null);
  const [isNew, setIsNew] = useState(false);

  const fetchArticles = async () => {
    const { data } = await supabase.from("articles").select("*").order("published_date", { ascending: false });
    if (data) setArticles(data);
  };

  useEffect(() => { fetchArticles(); }, []);

  const handleSave = async () => {
    if (!editing) return;
    const payload = {
      title: editing.title,
      category: editing.category,
      published_date: editing.published_date,
      excerpt: editing.excerpt,
      content: editing.content,
    };
    if (isNew) {
      await supabase.from("articles").insert(payload);
    } else {
      await supabase.from("articles").update(payload).eq("id", editing.id);
    }
    setEditing(null);
    setIsNew(false);
    fetchArticles();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Opravdu smazat tento článek?")) return;
    await supabase.from("articles").delete().eq("id", id);
    fetchArticles();
  };

  const startNew = () => {
    setEditing({ id: "", title: "", category: "", published_date: new Date().toISOString().split("T")[0], excerpt: "", content: "" });
    setIsNew(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-heading text-xl">Články</h2>
        <Button size="sm" onClick={startNew}><Plus className="w-4 h-4 mr-1" /> Přidat</Button>
      </div>

      {editing && (
        <div className="border border-border rounded-lg p-4 mb-6 bg-card space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Název</Label>
              <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Kategorie</Label>
              <Input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className="mt-1" />
            </div>
          </div>
          <div>
            <Label>Datum publikace</Label>
            <Input type="date" value={editing.published_date} onChange={(e) => setEditing({ ...editing, published_date: e.target.value })} className="mt-1 w-48" />
          </div>
          <div>
            <Label>Krátký popis</Label>
            <Input value={editing.excerpt} onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label>Obsah</Label>
            <Textarea value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} rows={6} className="mt-1" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave}><Save className="w-4 h-4 mr-1" /> Uložit</Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(null); setIsNew(false); }}><X className="w-4 h-4 mr-1" /> Zrušit</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {articles.map((article) => (
          <div key={article.id} className="flex items-center justify-between border border-border rounded-lg p-3 bg-card">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate">{article.title}</p>
              <p className="text-xs text-muted-foreground">{article.category} • {article.published_date}</p>
            </div>
            <div className="flex gap-1 ml-3">
              <Button size="icon" variant="ghost" onClick={() => { setEditing(article); setIsNew(false); }}><Pencil className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => handleDelete(article.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
        {articles.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Zatím žádné články.</p>}
      </div>
    </div>
  );
};

export default ArticlesManager;
