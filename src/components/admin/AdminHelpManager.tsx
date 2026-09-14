import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus, Pencil, Trash2, Search, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import MarkdownImageToolbar from "@/components/admin/MarkdownImageToolbar";
import MarkdownContent from "@/components/MarkdownContent";
import { slugify } from "@/lib/slugify";

interface HelpArticle {
  id: string;
  title: string;
  slug: string;
  category: string;
  content: string;
  cover_image_url: string | null;
  sort_order: number;
  audience: string;
  is_published: boolean;
}

const AUDIENCES = [
  { value: "all", label: "Všichni" },
  { value: "teacher", label: "Učitel" },
  { value: "student", label: "Žák" },
  { value: "parent", label: "Rodič" },
];

const emptyForm: Partial<HelpArticle> = {
  title: "", slug: "", category: "Začínáme", content: "",
  cover_image_url: "", sort_order: 0, audience: "all", is_published: false,
};

const AdminHelpManager = () => {
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<HelpArticle>>(emptyForm);
  const [preview, setPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("help_articles")
      .select("*")
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true });
    if (error) toast.error("Nepodařilo se načíst články");
    setArticles((data || []) as HelpArticle[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  const openNew = () => { setForm({ ...emptyForm, sort_order: articles.length + 1 }); setPreview(false); setOpen(true); };
  const openEdit = (a: HelpArticle) => { setForm({ ...a, cover_image_url: a.cover_image_url || "" }); setPreview(false); setOpen(true); };

  const save = async () => {
    if (!form.title?.trim()) { toast.error("Zadejte název"); return; }
    const payload = {
      title: form.title.trim(),
      slug: (form.slug?.trim() || slugify(form.title)),
      category: form.category?.trim() || "Obecné",
      content: form.content || "",
      cover_image_url: form.cover_image_url?.trim() || null,
      sort_order: form.sort_order ?? 0,
      audience: form.audience || "all",
      is_published: !!form.is_published,
    };
    const { error } = form.id
      ? await supabase.from("help_articles").update(payload).eq("id", form.id)
      : await supabase.from("help_articles").insert(payload);
    if (error) { toast.error("Chyba při ukládání: " + error.message); return; }
    toast.success(form.id ? "Článek uložen" : "Článek vytvořen");
    setOpen(false);
    fetchArticles();
  };

  const remove = async (id: string) => {
    if (!confirm("Opravdu smazat tento článek?")) return;
    const { error } = await supabase.from("help_articles").delete().eq("id", id);
    if (error) { toast.error("Chyba při mazání"); return; }
    toast.success("Článek smazán");
    fetchArticles();
  };

  const togglePublish = async (a: HelpArticle) => {
    const { error } = await supabase.from("help_articles").update({ is_published: !a.is_published }).eq("id", a.id);
    if (error) { toast.error("Chyba"); return; }
    fetchArticles();
  };

  const filtered = articles.filter(
    (a) => !search || a.title.toLowerCase().includes(search.toLowerCase()) || a.category.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-xl font-heading font-semibold">Nápověda – články</h2>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Nový článek</Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Hledat článek…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <p className="text-muted-foreground">Načítání…</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">Žádné články.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => (
            <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{a.title}</span>
                  <Badge variant="outline" className="text-xs">{a.category}</Badge>
                  <Badge variant="secondary" className="text-xs">
                    {AUDIENCES.find((x) => x.value === a.audience)?.label || a.audience}
                  </Badge>
                  <Badge variant={a.is_published ? "default" : "outline"} className="text-xs">
                    {a.is_published ? "Publikováno" : "Koncept"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">/napoveda/{a.slug}</p>
              </div>
              <Button size="sm" variant="ghost" asChild>
                <a href={`/napoveda/${a.slug}`} target="_blank" rel="noreferrer" aria-label="Otevřít"><ExternalLink className="w-4 h-4" /></a>
              </Button>
              <Button size="sm" variant="ghost" onClick={() => togglePublish(a)}>
                {a.is_published ? "Skrýt" : "Publikovat"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => openEdit(a)}><Pencil className="w-4 h-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => remove(a.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          ))}
        </div>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
          <SheetHeader><SheetTitle>{form.id ? "Upravit článek" : "Nový článek"}</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Název</Label>
                <Input
                  value={form.title || ""}
                  onChange={(e) => setForm((f) => ({
                    ...f,
                    title: e.target.value,
                    slug: f.id ? f.slug : slugify(e.target.value),
                  }))}
                />
              </div>
              <div>
                <Label>Slug (URL)</Label>
                <Input value={form.slug || ""} onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))} />
              </div>
              <div>
                <Label>Kategorie</Label>
                <Input value={form.category || ""} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Začínáme, Učebnice…" />
              </div>
              <div>
                <Label>Cílová skupina</Label>
                <Select value={form.audience || "all"} onValueChange={(v) => setForm((f) => ({ ...f, audience: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AUDIENCES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Pořadí</Label>
                <Input type="number" value={form.sort_order ?? 0} onChange={(e) => setForm((f) => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch checked={!!form.is_published} onCheckedChange={(v) => setForm((f) => ({ ...f, is_published: v }))} />
                <Label className="cursor-pointer">Publikováno</Label>
              </div>
            </div>

            <div>
              <Label>Obrázek na obálce (URL, volitelné)</Label>
              <Input value={form.cover_image_url || ""} onChange={(e) => setForm((f) => ({ ...f, cover_image_url: e.target.value }))} />
            </div>

            <div>
              <Label className="mb-2 block">Obsah (markdown – ## nadpis, - odrážka, **tučně**, ![obrázek](url))</Label>
              <MarkdownImageToolbar
                textareaRef={textareaRef}
                value={form.content || ""}
                onChange={(next) => setForm((f) => ({ ...f, content: next }))}
                folder={`napoveda/${form.slug || "obecne"}`}
                showPreviewToggle
                previewOn={preview}
                onTogglePreview={() => setPreview((p) => !p)}
              />
              <div className={preview ? "grid lg:grid-cols-2 gap-4" : ""}>
                <Textarea
                  ref={textareaRef}
                  rows={18}
                  value={form.content || ""}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  className="font-mono text-sm"
                />
                {preview && (
                  <div className="rounded-lg border border-border p-4 overflow-y-auto max-h-[480px]">
                    <MarkdownContent content={form.content || ""} />
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setOpen(false)}>Zrušit</Button>
              <Button onClick={save}>Uložit</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default AdminHelpManager;
