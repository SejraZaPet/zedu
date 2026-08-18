import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, MonitorPlay } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { blocksToSlides } from "@/lib/blocks-to-slides";

interface TargetLesson {
  id: string;
  title: string;
  blocks: any[];
  presentation_slides: any[] | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Slidy, které se přidají na konec prezentace vybrané lekce. */
  slides: any[];
  description?: string;
}

/**
 * Vybere vlastní lekci učitele a vloží na konec její prezentace předané slidy.
 */
export const InsertSlidesIntoPresentationDialog = ({
  open, onOpenChange, slides, description,
}: Props) => {
  const { toast } = useToast();
  const [lessons, setLessons] = useState<TargetLesson[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data, error } = await supabase
          .from("teacher_textbook_lessons")
          .select("id, title, blocks, presentation_slides, teacher_textbooks!inner(teacher_id)")
          .eq("teacher_textbooks.teacher_id", user.id)
          .order("created_at", { ascending: false })
          .limit(60);
        if (error) throw error;
        setLessons(
          ((data ?? []) as any[]).map((l) => ({
            id: l.id,
            title: l.title,
            blocks: Array.isArray(l.blocks) ? l.blocks : [],
            presentation_slides: Array.isArray(l.presentation_slides) ? l.presentation_slides : null,
          })),
        );
      } catch (e: any) {
        toast({
          title: "Nepodařilo se načíst vaše lekce",
          description: e?.message ?? String(e),
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const insertInto = async (lesson: TargetLesson) => {
    setSavingId(lesson.id);
    try {
      const base = lesson.presentation_slides?.length
        ? lesson.presentation_slides
        : blocksToSlides(lesson.blocks, lesson.title);
      const next = [...base, ...slides];
      const { error } = await supabase
        .from("teacher_textbook_lessons")
        .update({ presentation_slides: next } as any)
        .eq("id", lesson.id);
      if (error) throw error;
      toast({
        title: "Vloženo do prezentace",
        description: `${slides.length} ${slides.length === 1 ? "slide" : "slidů"} přidáno do lekce „${lesson.title}“.`,
      });
      onOpenChange(false);
    } catch (e: any) {
      toast({
        title: "Vložení se nepodařilo",
        description: e?.message ?? String(e),
        variant: "destructive",
      });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MonitorPlay className="w-4 h-4" /> Vložit do prezentace
          </DialogTitle>
          <DialogDescription>
            {description ?? "Vyberte lekci, do jejíž prezentace se slidy přidají na konec."}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : lessons.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            Zatím nemáte žádnou vlastní lekci. Vytvořte lekci ve své učebnici a zkuste to znovu.
          </p>
        ) : (
          <div className="max-h-[50vh] space-y-1 overflow-y-auto pr-1">
            {lessons.map((lesson) => (
              <Button
                key={lesson.id}
                variant="outline"
                className="w-full justify-between gap-2 text-left"
                disabled={!!savingId}
                onClick={() => insertInto(lesson)}
              >
                <span className="truncate">{lesson.title}</span>
                {savingId === lesson.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              </Button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default InsertSlidesIntoPresentationDialog;
