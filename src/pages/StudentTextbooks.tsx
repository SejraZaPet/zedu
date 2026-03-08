import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { KeyRound, BookOpen, ArrowRight } from "lucide-react";

interface EnrolledTextbook {
  id: string;
  textbook_id: string;
  enrolled_at: string;
  teacher_textbooks: {
    id: string;
    title: string;
    description: string;
    subject: string;
    access_code: string;
  } | null;
}

const StudentTextbooks = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [enrollments, setEnrollments] = useState<EnrolledTextbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const [enrolling, setEnrolling] = useState(false);

  const fetchEnrollments = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data } = await supabase
      .from("teacher_textbook_enrollments")
      .select("id, textbook_id, enrolled_at, teacher_textbooks(id, title, description, subject, access_code)")
      .eq("student_id", session.user.id)
      .order("enrolled_at", { ascending: false });

    if (data) setEnrollments(data as unknown as EnrolledTextbook[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchEnrollments();
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
      fetchEnrollments();
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
            <p className="text-muted-foreground mt-1">Učebnice od vašich učitelů.</p>
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
        ) : enrollments.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="font-heading text-xl font-semibold mb-2">Zatím nemáte žádné učebnice</h2>
            <p className="text-muted-foreground mb-4">Požádejte učitele o kód a přidejte si učebnici.</p>
            <Button onClick={() => setCodeOpen(true)} className="gap-2">
              <KeyRound className="w-4 h-4" /> Přidat učebnici kódem
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {enrollments.map((e) => {
              const tb = e.teacher_textbooks;
              if (!tb) return null;
              return (
                <div key={e.id} className="bg-card border border-border rounded-xl p-6 hover:shadow-md transition-shadow">
                  <h3 className="font-heading font-semibold text-lg mb-1">{tb.title}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{tb.subject || "Bez předmětu"}</p>
                  {tb.description && <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{tb.description}</p>}
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => navigate(`/student/ucebnice/${tb.id}`)}
                  >
                    Otevřít <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

export default StudentTextbooks;
