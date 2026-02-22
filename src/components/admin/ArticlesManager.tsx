import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RichTextEditor from "@/components/admin/RichTextEditor";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, X, Save, Search, ArrowLeft } from "lucide-react";

interface Article {
  id: string;
  title: string;
  category: string;
  published_date: string;
  excerpt: string;
  content: string;
  status: string;
}

const CATEGORIES = ["Didaktika", "Gastronomie", "Výživa"];

const ArticlesManager = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [editing, setEditing] = useState<Article | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchArticles = async () => {
    setLoading(true);
    let query = supabase.from("articles").select("*").order("published_date", { ascending: false });
    if (filterCategory !== "all") query = query.eq("category", filterCategory);
    if (filterStatus !== "all") query = query.eq("status", filterStatus);
    const { data } = await query;
    let results = (data as Article[]) ?? [];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      results = results.filter((a) => a.title.toLowerCase().includes(q));
    }
    setArticles(results);
    setLoading(false);
  };

  useEffect(() => { fetchArticles(); }, [filterCategory, filterStatus, searchQuery]);

  const handleSave = async () => {
    if (!editing) return;
    const payload = {
      title: editing.title,
      category: editing.category,
      published_date: editing.published_date,
      excerpt: editing.excerpt,
      content: editing.content,
      status: editing.status,
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
    setEditing({
      id: "", title: "", category: CATEGORIES[0],
      published_date: new Date().toISOString().split("T")[0],
      excerpt: "", content: "", status: "draft",
    });
    setIsNew(true);
  };

  const hasFilters = filterCategory !== "all" || filterStatus !== "all" || searchQuery.trim() !== "";

  // Editor view
  if (editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => { setEditing(null); setIsNew(false); }}>
            <ArrowLeft className="w-4 h-4 mr-1" />Zpět
          </Button>
          <span className="text-sm text-muted-foreground">{isNew ? "Nový článek" : "Úprava článku"}</span>
        </div>

        <div className="border border-border rounded-lg p-4 bg-card space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Název</Label>
              <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Kategorie</Label>
              <Select value={editing.category} onValueChange={(v) => setEditing({ ...editing, category: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Stav</Label>
              <Select value={editing.status} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Koncept</SelectItem>
                  <SelectItem value="published">Publikováno</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Datum publikace</Label>
            <Input type="date" value={editing.published_date} onChange={(e) => setEditing({ ...editing, published_date: e.target.value })} className="mt-1 w-48" />
          </div>
          <div>
            <Label>Perex</Label>
            <Input value={editing.excerpt} onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label>Obsah</Label>
            <div className="mt-1">
              <RichTextEditor
                content={editing.content}
                onChange={(html) => setEditing({ ...editing, content: html })}
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2 border-t border-border">
            <Button size="sm" onClick={handleSave}><Save className="w-4 h-4 mr-1" />Uložit</Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(null); setIsNew(false); }}><X className="w-4 h-4 mr-1" />Zrušit</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-xl">Ke kávě</h2>
        <div className="flex gap-2">
          {hasFilters && (
            <Button size="sm" variant="ghost" onClick={() => { setFilterCategory("all"); setFilterStatus("all"); setSearchQuery(""); }}>
              <X className="w-4 h-4 mr-1" />Zrušit filtry
            </Button>
          )}
          <Button size="sm" onClick={startNew}><Plus className="w-4 h-4 mr-1" />Přidat</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <div>
          <Label className="text-xs">Kategorie</Label>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Stav</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny</SelectItem>
              <SelectItem value="draft">Koncept</SelectItem>
              <SelectItem value="published">Publikováno</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Hledat</Label>
          <div className="relative mt-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Název článku…" className="pl-8" />
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Načítání…</p>
      ) : articles.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          {hasFilters ? "Žádné články pro zvolený filtr." : "Zatím žádné články."}
        </p>
      ) : (
        <div className="space-y-2">
          {articles.map((article) => (
            <div key={article.id} className="flex items-center gap-3 border border-border rounded-lg p-3 bg-card">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{article.title}</p>
                <p className="text-xs text-muted-foreground">{article.category} · {article.published_date}</p>
              </div>
              <Badge variant={article.status === "published" ? "default" : "secondary"} className="text-xs shrink-0">
                {article.status === "published" ? "Publikováno" : "Koncept"}
              </Badge>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" onClick={() => { setEditing(article); setIsNew(false); }}><Pencil className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => handleDelete(article.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ArticlesManager;
