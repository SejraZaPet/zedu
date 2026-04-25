import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { KeyRound, BookOpen, ArrowRight } from "lucide-react";

type Source = { kind: "enrollment" } | { kind: "class"; className: string };

interface DisplayTextbook {
  key: string;
  textbook_id: string;
  textbook_type: "global" | "teacher";
  title: string;
  subject: string;
  description: string;
  sources: Source[];
  /** route to open the textbook detail */
  href: string;
}

const StudentTextbooks = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [items, setItems] = useState<DisplayTextbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const [enrolling, setEnrolling] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      return;
    }
    const userId = session.user.id;

    // Set A — direct enrollments (teacher textbooks via code)
    const { data: enrollData } = await supabase
      .from("teacher_textbook_enrollments")
      .select("textbook_id, teacher_textbooks(id, title, subject, description)")
      .eq("student_id", userId)
      .order("enrolled_at", { ascending: false });

    // Set B — textbooks via class membership
    const { data: memberships } = await supabase
      .from("class_members")
      .select("class_id, classes(id, name)")
      .eq("user_id", userId);

    const classIds = (memberships ?? []).map((m: any) => m.class_id);
    const classNameById = new Map<string, string>(
      (memberships ?? []).map((m: any) => [m.class_id, m.classes?.name ?? "Třída"])
    );

    let classBooks: any[] = [];
    if (classIds.length > 0) {
      const { data } = await supabase
        .from("class_textbooks")
        .select("textbook_id, textbook_type, class_id")
        .in("class_id", classIds);
      classBooks = data ?? [];
    }

    const globalIds = [...new Set(classBooks.filter(b => b.textbook_type === "global").map(b => b.textbook_id))];
    const teacherIdsFromClasses = [...new Set(classBooks.filter(b => b.textbook_type === "teacher").map(b => b.textbook_id))];

    const [globalRes, teacherClassRes] = await Promise.all([
      globalIds.length > 0
        ? supabase.from("textbook_subjects").select("id, slug, label, abbreviation, description").in("id", globalIds)
        : Promise.resolve({ data: [] as any[] }),
      teacherIdsFromClasses.length > 0
        ? supabase.from("teacher_textbooks").select("id, title, subject, description").in("id", teacherIdsFromClasses)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const globalById = new Map<string, any>(((globalRes.data ?? []) as any[]).map(g => [g.id, g]));
    const teacherById = new Map<string, any>(((teacherClassRes.data ?? []) as any[]).map(t => [t.id, t]));

    // Merge into a single map keyed by type+id
    const merged = new Map<string, DisplayTextbook>();

    // Enrollments first
    for (const e of (enrollData ?? []) as any[]) {
      const tb = e.teacher_textbooks;
      if (!tb) continue;
      const key = `teacher-${tb.id}`;
      merged.set(key, {
        key,
        textbook_id: tb.id,
        textbook_type: "teacher",
        title: tb.title,
        subject: tb.subject || "",
        description: tb.description || "",
        sources: [{ kind: "enrollment" }],
        href: `/student/ucebnice/${tb.id}`,
      });
    }

    // Class-linked
    for (const cb of classBooks) {
      const className = classNameById.get(cb.class_id) ?? "Třída";
      if (cb.textbook_type === "teacher") {
        const tb = teacherById.get(cb.textbook_id);
        if (!tb) continue;
        const key = `teacher-${tb.id}`;
        const existing = merged.get(key);
        if (existing) {
          existing.sources.push({ kind: "class", className });
        } else {
          merged.set(key, {
            key,
            textbook_id: tb.id,
            textbook_type: "teacher",
            title: tb.title,
            subject: tb.subject || "",
            description: tb.description || "",
            sources: [{ kind: "class", className }],
            href: `/student/ucebnice/${tb.id}`,
          });
        }
      } else {
        const sub = globalById.get(cb.textbook_id);
        if (!sub) continue;
        const key = `global-${sub.id}`;
        const existing = merged.get(key);
        if (existing) {
          existing.sources.push({ kind: "class", className });
        } else {
          merged.set(key, {
            key,
            textbook_id: sub.id,
            textbook_type: "global",
            title: sub.label,
            subject: sub.abbreviation || "",
            description: sub.description || "",
            sources: [{ kind: "class", className }],
            href: `/ucebnice/${sub.slug}`,
          });
        }
      }
    }

    setItems(Array.from(merged.values()));
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleEnroll = async () => {
    if (!code.trim()) return;
    setEnrolling(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase.rpc("enroll_by_textbook_code", {
      _code: code.trim().toUpperCase(),
      _student_id: session.user.id,
    });

    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    } else if (!data) {
      toast({ title: "Kód nenalezen", description: "Zkontrolujte zadaný kód a zkuste to znovu.", variant: "destructive" });
    } else {
      toast({ title: "Zapsáno!", description: "Učebnice byla přidána do vašeho seznamu." });
      setCode("");
      setCodeOpen(false);
      fetchAll();
    }
    setEnrolling(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl" style={{ paddingTop: "calc(70px + 3rem)" }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading text-3xl font-bold">Moje učebnice</h1>
            <p className="text-muted-foreground mt-1">Učebnice z vašich tříd a vlastní zápisy.</p>
          </div>
          <Dialog open={codeOpen} onOpenChange={setCodeOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <KeyRound className="w-4 h-4" /> Přidat učebnici kódem
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Přidat učebnici pomocí kódu</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <p className="text-sm text-muted-foreground">Zadejte kód, který jste obdrželi od učitele.</p>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="např. GASTRO7"
                  className="font-mono text-center text-lg tracking-widest"
                  maxLength={10}
                />
                <Button onClick={handleEnroll} disabled={enrolling || !code.trim()} className="w-full">
                  {enrolling ? "Zapisuji..." : "Přidat učebnici"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Načítání...</p>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="font-heading text-xl font-semibold mb-2">Zatím nemáte žádné učebnice</h2>
            <p className="text-muted-foreground mb-4">Přidejte se do třídy nebo zadejte kód učebnice od učitele.</p>
            <Button onClick={() => setCodeOpen(true)} className="gap-2">
              <KeyRound className="w-4 h-4" /> Přidat učebnici kódem
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((it) => (
              <div key={it.key} className="bg-card border border-border rounded-xl p-6 hover:shadow-md transition-shadow flex flex-col">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Badge
                    variant="outline"
                    className={
                      it.textbook_type === "global"
                        ? "bg-blue-500/15 text-blue-500 border-blue-500/30"
                        : "bg-teal-500/15 text-teal-500 border-teal-500/30"
                    }
                  >
                    {it.textbook_type === "global" ? "Globální" : "Učitelská"}
                  </Badge>
                  {it.sources.map((s, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {s.kind === "enrollment" ? "Vlastní zápis" : `Z třídy ${s.className}`}
                    </Badge>
                  ))}
                </div>
                <h3 className="font-heading font-semibold text-lg mb-1">{it.title}</h3>
                {it.subject && <p className="text-sm text-muted-foreground mb-2">{it.subject}</p>}
                {it.description && <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{it.description}</p>}
                <Button
                  variant="outline"
                  className="w-full gap-2 mt-auto"
                  onClick={() => navigate(it.href)}
                >
                  Otevřít <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

export default StudentTextbooks;
