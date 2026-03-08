import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import LessonBlockRenderer from "@/components/LessonBlockRenderer";
import { ArrowLeft, BookOpen } from "lucide-react";

interface Lesson {
  id: string;
  title: string;
  blocks: any[];
  sort_order: number;
  status: string;
}

const StudentTextbookDetail = () => {
  const { textbookId } = useParams<{ textbookId: string }>();
  const navigate = useNavigate();
  const [textbookTitle, setTextbookTitle] = useState("");
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

  useEffect(() => {
    const fetch = async () => {
      if (!textbookId) return;

      const { data: tb } = await supabase
        .from("teacher_textbooks")
        .select("title")
        .eq("id", textbookId)
        .single();
      if (tb) setTextbookTitle((tb as any).title);

      const { data } = await supabase
        .from("teacher_textbook_lessons")
        .select("*")
        .eq("textbook_id", textbookId)
        .eq("status", "published")
        .order("sort_order", { ascending: true });
      if (data) setLessons(data as Lesson[]);
      setLoading(false);
    };
    fetch();
  }, [textbookId]);

  if (selectedLesson) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SiteHeader />
        <main className="flex-1 container mx-auto px-4 py-12 max-w-3xl" style={{ paddingTop: "calc(70px + 3rem)" }}>
          <Button variant="ghost" size="sm" onClick={() => setSelectedLesson(null)} className="mb-4 gap-2">
            <ArrowLeft className="w-4 h-4" /> Zpět na lekce
          </Button>
          <h1 className="font-heading text-2xl font-bold mb-6">{selectedLesson.title}</h1>
          <div className="space-y-6">
            {(selectedLesson.blocks || []).map((block: any, idx: number) => (
              <LessonBlockRenderer key={idx} block={block} lessonId={selectedLesson.id} blockIndex={idx} />
            ))}
          </div>
          {(!selectedLesson.blocks || selectedLesson.blocks.length === 0) && (
            <p className="text-muted-foreground text-center py-8">Tato lekce zatím nemá žádný obsah.</p>
          )}
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl" style={{ paddingTop: "calc(70px + 3rem)" }}>
        <Button variant="ghost" size="sm" onClick={() => navigate("/student/ucebnice")} className="mb-4 gap-2">
          <ArrowLeft className="w-4 h-4" /> Zpět na učebnice
        </Button>

        <h1 className="font-heading text-2xl font-bold mb-6">{textbookTitle}</h1>

        {loading ? (
          <p className="text-muted-foreground">Načítání...</p>
        ) : lessons.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Zatím nejsou k dispozici žádné lekce.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {lessons.map((lesson) => (
              <button
                key={lesson.id}
                onClick={() => setSelectedLesson(lesson)}
                className="w-full bg-card border border-border rounded-lg p-4 flex items-center gap-4 hover:shadow-md transition-shadow text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{lesson.title}</h3>
                  <p className="text-xs text-muted-foreground">{(lesson.blocks || []).length} bloků</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

export default StudentTextbookDetail;
