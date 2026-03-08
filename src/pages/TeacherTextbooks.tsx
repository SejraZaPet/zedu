import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useSubjects } from "@/hooks/useSubjects";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import {
  BookOpen, Users, ArrowLeft, Copy, Eye, FolderOpen, ChevronRight,
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

interface GradeGroup {
  grade: number;
  label: string;
  topics: { id: string; title: string; lessonCount: number }[];
}

const TeacherTextbooks = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: subjects } = useSubjects(true);
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [loading, setLoading] = useState(true);

  // Detail view
  const [selectedTextbook, setSelectedTextbook] = useState<Textbook | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [gradeGroups, setGradeGroups] = useState<GradeGroup[]>([]);

  const fetchTextbooks = async () => {
    const { data } = await supabase
      .from("teacher_textbooks")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setTextbooks(data as Textbook[]);
    setLoading(false);
  };

  useEffect(() => { fetchTextbooks(); }, []);

  const openDetail = useCallback(async (tb: Textbook) => {
    setSelectedTextbook(tb);

    // Load enrollments
    const { data: enrollData } = await supabase
      .from("teacher_textbook_enrollments")
      .select("id, student_id, enrolled_at, profiles(first_name, last_name, email)")
      .eq("textbook_id", tb.id)
      .order("enrolled_at", { ascending: false });
    if (enrollData) setEnrollments(enrollData as unknown as Enrollment[]);

    // Load grade structure from global tables
    const matchedSubject = subjects?.find(s => s.slug === tb.subject);
    if (!matchedSubject) { setGradeGroups([]); return; }

    const { data: topics } = await supabase
      .from("textbook_topics")
      .select("*")
      .eq("subject", tb.subject)
      .order("sort_order");

    const topicIds = (topics ?? []).map((t: any) => t.id);
    let lessonCountMap: Record<string, number> = {};
    if (topicIds.length > 0) {
      const { data: tbLessons } = await supabase
        .from("textbook_lessons")
        .select("topic_id")
        .in("topic_id", topicIds);
      for (const l of (tbLessons ?? []) as any[]) {
        lessonCountMap[l.topic_id] = (lessonCountMap[l.topic_id] ?? 0) + 1;
      }
    }

    const groups: GradeGroup[] = matchedSubject.grades.map(g => ({
      grade: g.grade_number,
      label: g.label,
      topics: (topics ?? [])
        .filter((t: any) => t.grade === g.grade_number)
        .map((t: any) => ({
          id: t.id,
          title: t.title,
          lessonCount: lessonCountMap[t.id] ?? 0,
        })),
    }));
    setGradeGroups(groups);
  }, [subjects]);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Zkopírováno", description: `Kód ${code} zkopírován do schránky.` });
  };

  if (selectedTextbook) {
    const matchedSubject = subjects?.find(s => s.slug === selectedTextbook.subject);
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
              {matchedSubject && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: matchedSubject.color }} />
                  <span className="text-muted-foreground text-sm">{matchedSubject.label}</span>
                </div>
              )}
              {selectedTextbook.description && <p className="text-sm mt-2">{selectedTextbook.description}</p>}
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
            {/* Structure */}
            <div className="bg-card border border-border rounded-xl p-6 md:col-span-2">
              <h2 className="font-heading text-lg font-semibold flex items-center gap-2 mb-4">
                <BookOpen className="w-5 h-5 text-primary" /> Struktura učebnice
              </h2>
              {gradeGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground">Žádná struktura. Přidejte témata a lekce v administraci.</p>
              ) : (
                <div className="space-y-3">
                  {gradeGroups.map((group) => (
                    <div key={group.grade} className="border border-border rounded-lg overflow-hidden">
                      <div className="bg-muted/30 px-4 py-2 border-b border-border">
                        <h4 className="text-sm font-semibold">{group.label}</h4>
                      </div>
                      <div className="p-2 space-y-1">
                        {group.topics.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2 text-center">Žádná témata</p>
                        ) : group.topics.map((topic) => (
                          <div key={topic.id} className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/20">
                            <FolderOpen className="w-4 h-4 text-primary" />
                            <span className="text-sm flex-1">{topic.title}</span>
                            <Badge variant="secondary" className="text-[10px]">{topic.lessonCount} lekcí</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Button size="sm" className="mt-4" onClick={() => navigate(`/ucitel/ucebnice/${selectedTextbook.id}/lekce`)}>
                Spravovat lekce
              </Button>
            </div>

            {/* Enrolled students */}
            <div className="bg-card border border-border rounded-xl p-6 md:col-span-2">
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
            <p className="text-muted-foreground mt-1">Učebnice se automaticky vytvářejí při přidání předmětu.</p>
          </div>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Načítání...</p>
        ) : textbooks.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="font-heading text-xl font-semibold mb-2">Zatím nemáte žádné učebnice</h2>
            <p className="text-muted-foreground mb-4">Učebnice se vytvoří automaticky, když přidáte nový předmět v administraci.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {textbooks.map((tb) => {
              const matchedSubject = subjects?.find(s => s.slug === tb.subject);
              return (
                <div key={tb.id} className="bg-card border border-border rounded-xl p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {matchedSubject && (
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: matchedSubject.color }} />
                        )}
                        <h3 className="font-heading font-semibold text-lg truncate">{tb.title}</h3>
                      </div>
                      {matchedSubject && (
                        <div className="flex gap-1 mt-1">
                          {matchedSubject.grades.map(g => (
                            <Badge key={g.id} variant="secondary" className="text-[10px] px-1.5 py-0">{g.label}</Badge>
                          ))}
                        </div>
                      )}
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
              );
            })}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

export default TeacherTextbooks;
