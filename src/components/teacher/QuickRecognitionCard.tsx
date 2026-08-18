import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sparkles, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BEHAVIOR_CATEGORIES, type BehaviorCategory } from "@/lib/behavior-categories";

interface Student {
  user_id: string;
  first_name: string;
  last_name: string;
}

interface Props {
  /** Třída, ke které pochvala patří (u skupiny předmětu může chybět). */
  classId?: string | null;
  teacherId: string;
  students: Student[];
  /** Volitelné navázání pochvaly na konkrétní Výuku (předmět + třída/skupina). */
  subjectId?: string | null;
  groupId?: string | null;
  /** Vlastní popisek pod nadpisem karty. */
  description?: string;
}

const initials = (f: string, l: string) =>
  `${(f || "").charAt(0)}${(l || "").charAt(0)}`.toUpperCase() || "?";

const QuickRecognitionCard = ({
  classId,
  teacherId,
  students,
  subjectId,
  groupId,
  description,
}: Props) => {
  const { toast } = useToast();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const award = async (student: Student, category: BehaviorCategory, label: string) => {
    setPendingId(student.user_id);
    const { error } = await supabase.from("behavior_points" as any).insert({
      student_id: student.user_id,
      teacher_id: teacherId,
      class_id: classId ?? null,
      subject_id: subjectId ?? null,
      group_id: groupId ?? null,
      category,
    });
    setPendingId(null);
    setOpenId(null);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: `✨ ${student.first_name} ${student.last_name}`.trim(),
      description: label,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          Rychlé uznání
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {description ??
            "Klikněte na žáka a vyberte kategorii. Pouze pozitivní uznání — oddělené od herních bodů."}
        </p>
      </CardHeader>
      <CardContent>
        {students.length === 0 ? (
          <p className="text-sm text-muted-foreground">Zatím žádní žáci ve třídě.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {students.map((s) => (
              <Popover
                key={s.user_id}
                open={openId === s.user_id}
                onOpenChange={(o) => setOpenId(o ? s.user_id : null)}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={pendingId === s.user_id}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-lg border border-border hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors disabled:opacity-50"
                  >
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center text-sm font-semibold">
                      {initials(s.first_name, s.last_name)}
                    </div>
                    <span className="text-xs text-center leading-tight truncate max-w-full">
                      {s.first_name}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="center">
                  <p className="text-xs text-muted-foreground px-2 py-1">
                    Uznání pro {s.first_name}
                  </p>
                  <div className="space-y-1">
                    {BEHAVIOR_CATEGORIES.map((c) => {
                      const Icon = c.icon;
                      return (
                        <Button
                          key={c.key}
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start gap-2 h-9"
                          disabled={pendingId === s.user_id}
                          onClick={() => award(s, c.key, c.label)}
                        >
                          <Icon className="w-4 h-4 text-amber-500" />
                          <span className="text-sm">{c.label}</span>
                        </Button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            ))}
          </div>
        )}
        <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Star className="w-3 h-3 text-amber-500" />
          Jen pozitivní — žádné trestné body.
        </div>
      </CardContent>
    </Card>
  );
};

export default QuickRecognitionCard;
