import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SiteHeader from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, BookOpen, Trash2, ArrowUp, ArrowDown, Eye, Upload, ArrowLeft, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";

interface Book {
  id: string;
  student_id: string;
  title: string;
  subject: string | null;
  cover_image_url: string | null;
  published: boolean;
  created_at: string;
  updated_at: string;
}

interface Page {
  id: string;
  book_id: string;
  sort_order: number;
  text: string | null;
  image_url: string | null;
}

const BUCKET = "student-portfolio";

async function uploadImage(studentId: string, file: File): Promise<string | null> {
  const ext = file.name.split(".").pop() || "png";
  const path = `${studentId}/books/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type,
  });
  if (error) {
    toast.error("Nahrání obrázku selhalo: " + error.message);
    return null;
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export default function StudentBooks() {
  const { user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [openBook, setOpenBook] = useState<Book | null>(null);
  const [newBookOpen, setNewBookOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSubject, setNewSubject] = useState("");

  const loadBooks = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("student_books" as any)
      .select("*")
      .eq("student_id", user.id)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setBooks(((data ?? []) as unknown) as Book[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadBooks(); }, [loadBooks]);

  async function createBook() {
    if (!user || !newTitle.trim()) return;
    const { data, error } = await supabase
      .from("student_books" as any)
      .insert({ student_id: user.id, title: newTitle.trim(), subject: newSubject.trim() || null })
      .select("*")
      .single();
    if (error) { toast.error(error.message); return; }
    setNewBookOpen(false);
    setNewTitle("");
    setNewSubject("");
    await loadBooks();
    setOpenBook(data as unknown as Book);
  }

  async function deleteBook(b: Book) {
    if (!confirm(`Smazat knihu „${b.title}"?`)) return;
    const { error } = await supabase.from("student_books" as any).delete().eq("id", b.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Kniha smazána");
    loadBooks();
  }

  if (openBook) {
    return (
      <BookEditor
        book={openBook}
        onBack={() => { setOpenBook(null); loadBooks(); }}
        onChanged={(updated) => setOpenBook(updated)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 pb-8" style={{ paddingTop: "calc(70px + 2rem)" }}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <BookOpen className="w-7 h-7" /> Moje knihy
            </h1>
            <p className="text-muted-foreground mt-1">
              Vytvoř si vlastní multimediální knihu — stránku po stránce.
            </p>
          </div>
          <Button onClick={() => setNewBookOpen(true)} className="self-start sm:self-auto shrink-0">
            <Plus className="w-4 h-4 mr-1" /> Nová kniha
          </Button>
        </div>


        {loading ? (
          <p className="text-muted-foreground">Načítání…</p>
        ) : books.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Ještě nemáš žádnou knihu. Klikni na <b>Nová kniha</b> a začni tvořit.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {books.map((b) => (
              <Card key={b.id} className="cursor-pointer hover:shadow-md transition" onClick={() => setOpenBook(b)}>
                <div className="aspect-[4/3] bg-muted rounded-t-lg overflow-hidden flex items-center justify-center">
                  {b.cover_image_url ? (
                    <img src={b.cover_image_url} alt={b.title} className="w-full h-full object-cover" />
                  ) : (
                    <BookOpen className="w-12 h-12 text-muted-foreground" />
                  )}
                </div>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    {b.title}
                    {b.published && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                  </CardTitle>
                  {b.subject && <p className="text-xs text-muted-foreground">{b.subject}</p>}
                </CardHeader>
                <CardContent className="pt-0 flex justify-between text-xs text-muted-foreground">
                  <span>{b.published ? "Publikováno" : "Rozpracováno"}</span>
                  <button
                    className="text-destructive hover:underline flex items-center gap-1"
                    onClick={(e) => { e.stopPropagation(); deleteBook(b); }}
                  >
                    <Trash2 className="w-3 h-3" /> Smazat
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={newBookOpen} onOpenChange={setNewBookOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nová kniha</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Název *</label>
                <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Např. Moje cesta po Evropě" />
              </div>
              <div>
                <label className="text-sm font-medium">Předmět (volitelně)</label>
                <Input value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="Zeměpis" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewBookOpen(false)}>Zrušit</Button>
              <Button onClick={createBook} disabled={!newTitle.trim()}>Vytvořit</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

/* -------------------- Editor -------------------- */

function BookEditor({
  book,
  onBack,
  onChanged,
}: {
  book: Book;
  onBack: () => void;
  onChanged: (b: Book) => void;
}) {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState(book.title);
  const [subject, setSubject] = useState(book.subject ?? "");
  const [readMode, setReadMode] = useState(false);
  const [readIndex, setReadIndex] = useState(0);
  const [publishing, setPublishing] = useState(false);

  const loadPages = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("student_book_pages" as any)
      .select("*")
      .eq("book_id", book.id)
      .order("sort_order", { ascending: true });
    if (error) toast.error(error.message);
    setPages(((data ?? []) as unknown) as Page[]);
    setLoading(false);
  }, [book.id]);

  useEffect(() => { loadPages(); }, [loadPages]);

  async function saveMeta() {
    const { data, error } = await supabase
      .from("student_books" as any)
      .update({ title: title.trim() || book.title, subject: subject.trim() || null })
      .eq("id", book.id)
      .select("*")
      .single();
    if (error) { toast.error(error.message); return; }
    toast.success("Uloženo");
    onChanged(data as unknown as Book);
  }

  async function addPage() {
    const nextOrder = pages.length > 0 ? Math.max(...pages.map((p) => p.sort_order)) + 1 : 0;
    const { data, error } = await supabase
      .from("student_book_pages" as any)
      .insert({ book_id: book.id, sort_order: nextOrder, text: "" })
      .select("*")
      .single();
    if (error) { toast.error(error.message); return; }
    setPages((prev) => [...prev, data as unknown as Page]);
  }

  async function updatePage(p: Page, patch: Partial<Page>) {
    setPages((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from("student_book_pages" as any).update(patch).eq("id", p.id);
    if (error) toast.error(error.message);
  }

  async function deletePage(p: Page) {
    if (!confirm("Smazat stránku?")) return;
    const { error } = await supabase.from("student_book_pages" as any).delete().eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    setPages((prev) => prev.filter((x) => x.id !== p.id));
  }

  async function movePage(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= pages.length) return;
    const a = pages[idx], b = pages[j];
    const newPages = [...pages];
    newPages[idx] = { ...a, sort_order: b.sort_order };
    newPages[j] = { ...b, sort_order: a.sort_order };
    setPages(newPages);
    await Promise.all([
      supabase.from("student_book_pages" as any).update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("student_book_pages" as any).update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
  }

  async function handleImageUpload(p: Page, file: File) {
    const url = await uploadImage(book.student_id, file);
    if (url) updatePage(p, { image_url: url });
  }

  async function handleCoverUpload(file: File) {
    const url = await uploadImage(book.student_id, file);
    if (!url) return;
    const { data, error } = await supabase
      .from("student_books" as any)
      .update({ cover_image_url: url })
      .eq("id", book.id)
      .select("*")
      .single();
    if (error) { toast.error(error.message); return; }
    onChanged(data as unknown as Book);
  }

  async function publish() {
    if (pages.length === 0) { toast.error("Nejprve přidej alespoň jednu stránku."); return; }
    setPublishing(true);
    const { data, error } = await supabase
      .from("student_books" as any)
      .update({ published: true })
      .eq("id", book.id)
      .select("*")
      .single();
    setPublishing(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Kniha publikována a přidána do portfolia 🎉");
    onChanged(data as unknown as Book);
  }

  if (readMode) {
    const p = pages[readIndex];
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="container mx-auto px-4 py-8 max-w-3xl">
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" onClick={() => setReadMode(false)}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Zpět do editoru
            </Button>
            <span className="text-sm text-muted-foreground">
              Stránka {readIndex + 1} / {pages.length}
            </span>
          </div>
          <Card className="min-h-[60vh]">
            <CardContent className="p-8">
              {!p ? (
                <p className="text-muted-foreground">Kniha nemá žádné stránky.</p>
              ) : (
                <>
                  {p.image_url && (
                    <img src={p.image_url} alt="" className="w-full max-h-[50vh] object-contain rounded mb-4" />
                  )}
                  {p.text && <p className="whitespace-pre-wrap leading-relaxed">{p.text}</p>}
                </>
              )}
            </CardContent>
          </Card>
          <div className="flex justify-between mt-4">
            <Button variant="outline" onClick={() => setReadIndex((i) => Math.max(0, i - 1))} disabled={readIndex === 0}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Předchozí
            </Button>
            <Button variant="outline" onClick={() => setReadIndex((i) => Math.min(pages.length - 1, i + 1))} disabled={readIndex >= pages.length - 1}>
              Další <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Zpět
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setReadIndex(0); setReadMode(true); }} disabled={pages.length === 0}>
              <Eye className="w-4 h-4 mr-1" /> Náhled
            </Button>
            {!book.published && (
              <Button onClick={publish} disabled={publishing}>
                <CheckCircle2 className="w-4 h-4 mr-1" /> Publikovat
              </Button>
            )}
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader><CardTitle>Nastavení knihy</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Název</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveMeta} />
              </div>
              <div>
                <label className="text-sm font-medium">Předmět</label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} onBlur={saveMeta} placeholder="volitelné" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Obálka</label>
              <div className="flex items-center gap-3">
                {book.cover_image_url && (
                  <img src={book.cover_image_url} alt="cover" className="w-24 h-24 object-cover rounded border" />
                )}
                <label className="inline-flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer hover:bg-accent text-sm">
                  <Upload className="w-4 h-4" /> Nahrát obrázek
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f); }}
                  />
                </label>
              </div>
            </div>
            {book.published && (
              <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-2">
                Tato kniha je publikovaná — vidí ji tvůj učitel i rodič a je v portfoliu.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">Stránky ({pages.length})</h2>
          <Button size="sm" onClick={addPage}>
            <Plus className="w-4 h-4 mr-1" /> Přidat stránku
          </Button>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Načítání…</p>
        ) : pages.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">Zatím žádné stránky.</CardContent></Card>
        ) : (
          <div className="space-y-4">
            {pages.map((p, idx) => (
              <Card key={p.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base">Stránka {idx + 1}</CardTitle>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => movePage(idx, -1)} disabled={idx === 0}>
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => movePage(idx, 1)} disabled={idx === pages.length - 1}>
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => deletePage(p)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    value={p.text ?? ""}
                    onChange={(e) => setPages((prev) => prev.map((x) => x.id === p.id ? { ...x, text: e.target.value } : x))}
                    onBlur={(e) => updatePage(p, { text: e.target.value })}
                    placeholder="Napiš text stránky…"
                    rows={5}
                  />
                  <div>
                    {p.image_url ? (
                      <div className="space-y-2">
                        <img src={p.image_url} alt="" className="max-h-64 rounded border" />
                        <Button size="sm" variant="outline" onClick={() => updatePage(p, { image_url: null })}>
                          Odebrat obrázek
                        </Button>
                      </div>
                    ) : (
                      <label className="inline-flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer hover:bg-accent text-sm">
                        <Upload className="w-4 h-4" /> Přidat obrázek
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(p, f); }}
                        />
                      </label>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
