import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useSubjects } from "@/hooks/useSubjects";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import {
  Plus, BookOpen, Users, ArrowLeft, Pencil, Trash2, Copy, Eye
} from "lucide-react";

interface Textbook {
  id: string;
  title: string;
  description: string;
  subject: string;
  access_code: string;
  visibility: string;
  created_at: string;
}

interface Enrollment {
  id: string;
  student_id: string;
  enrolled_at: string;
  profiles: { first_name: string; last_name: string; email: string } | null;
}

function generateCode(length = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const TeacherTextbooks = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: subjects } = useSubjects(true);
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");

  // Detail view
  const [selectedTextbook, setSelectedTextbook] = useState<Textbook | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);

  const fetchTextbooks = async () => {
    const { data } = await supabase
      .from("teacher_textbooks")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setTextbooks(data as Textbook[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchTextbooks();
  }, []);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setSaving(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase.from("teacher_textbooks").insert({
      title: title.trim(),
      description: description.trim(),
      subject: subject.trim(),
      teacher_id: session.user.id,
      access_code: generateCode(),
    } as any);

    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Vytvořeno", description: "Učebnice byla vytvořena." });
      setTitle("");
      setDescription("");
      setSubject("");
      setCreateOpen(false);
      fetchTextbooks();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Opravdu smazat tuto učebnici?")) return;
    const { error } = await supabase.from("teacher_textbooks").delete().eq("id", id);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Smazáno" });
      if (selectedTextbook?.id === id) setSelectedTextbook(null);
      fetchTextbooks();
    }
  };

  const openDetail = async (tb: Textbook) => {
    setSelectedTextbook(tb);
    const { data } = await supabase
      .from("teacher_textbook_enrollments")
      .select("id, student_id, enrolled_at, profiles(first_name, last_name, email)")
      .eq("textbook_id", tb.id)
      .order("enrolled_at", { ascending: false });
    if (data) setEnrollments(data as unknown as Enrollment[]);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Zkopírováno", description: `Kód ${code} zkopírován do schránky.` });
  };

  if (selectedTextbook) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SiteHeader />
        <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl" style={{ paddingTop: "calc(70px + 3rem)" }}>
          <Button variant="ghost" size="sm" onClick={() => setSelectedTextbook(null)} className="mb-4 gap-2">
            <ArrowLeft className="w-4 h-4" /> Zpět na učebnice
          </Button>

          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="font-heading text-2xl font-bold">{selectedTextbook.title}</h1>
              <p className="text-muted-foreground text-sm mt-1">{selectedTextbook.subject}</p>
              {selectedTextbook.description && (
                <p className="text-sm mt-2">{selectedTextbook.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-card border border-border rounded-lg px-3 py-2 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Kód:</span>
                <span className="font-mono font-bold text-primary">{selectedTextbook.access_code}</span>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => copyCode(selectedTextbook.access_code)}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Lessons */}
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading text-lg font-semibold flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" /> Lekce
                </h2>
                <Button size="sm" onClick={() => navigate(`/ucitel/ucebnice/${selectedTextbook.id}/lekce`)}>
                  <Plus className="w-4 h-4 mr-1" /> Spravovat
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Přejděte do správy lekcí pro přidání a úpravu obsahu.
              </p>
            </div>

            {/* Enrolled students */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="font-heading text-lg font-semibold flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-primary" /> Zapsaní studenti ({enrollments.length})
              </h2>
              {enrollments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Zatím žádní studenti. Sdílejte kód učebnice.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {enrollments.map((e) => (
                    <div key={e.id} className="flex items-center justify-between text-sm border-b border-border pb-2">
                      <span>{e.profiles?.first_name} {e.profiles?.last_name}</span>
                      <span className="text-muted-foreground text-xs">{e.profiles?.email}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl" style={{ paddingTop: "calc(70px + 3rem)" }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading text-3xl font-bold">Moje učebnice</h1>
            <p className="text-muted-foreground mt-1">Vytvářejte a spravujte digitální učebnice pro vaše studenty.</p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> Vytvořit učebnici
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nová učebnice</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label>Název učebnice</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" placeholder="např. Gastronomie pro 1. ročník" />
                </div>
                <div>
                  <Label>Předmět</Label>
                  {subjects && subjects.length > 0 ? (
                    <Select value={subject} onValueChange={setSubject}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Vyberte předmět" /></SelectTrigger>
                      <SelectContent>
                        {subjects.map((s) => (
                          <SelectItem key={s.id} value={s.label}>
                            {s.label} {s.abbreviation ? `(${s.abbreviation})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">Nejsou dostupné žádné předměty. Nejprve je vytvořte v administraci.</p>
                  )}
                </div>
                <div>
                  <Label>Popis</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" placeholder="Krátký popis učebnice..." rows={3} />
                </div>
                <Button onClick={handleCreate} disabled={saving || !title.trim()} className="w-full">
                  {saving ? "Vytvářím..." : "Vytvořit učebnici"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Načítání...</p>
        ) : textbooks.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="font-heading text-xl font-semibold mb-2">Zatím nemáte žádné učebnice</h2>
            <p className="text-muted-foreground mb-4">Vytvořte svou první digitální učebnici a sdílejte ji se studenty.</p>
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Vytvořit první učebnici
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {textbooks.map((tb) => (
              <div key={tb.id} className="bg-card border border-border rounded-xl p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-heading font-semibold text-lg truncate">{tb.title}</h3>
                    <p className="text-sm text-muted-foreground">{tb.subject || "Bez předmětu"}</p>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleDelete(tb.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                {tb.description && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{tb.description}</p>}
                <div className="flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-1 bg-primary/10 rounded-md px-2 py-1">
                    <span className="text-xs text-muted-foreground">Kód:</span>
                    <span className="font-mono text-sm font-bold text-primary">{tb.access_code}</span>
                    <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => copyCode(tb.access_code)}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openDetail(tb)} className="gap-1">
                    <Eye className="w-4 h-4" /> Detail
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

export default TeacherTextbooks;
