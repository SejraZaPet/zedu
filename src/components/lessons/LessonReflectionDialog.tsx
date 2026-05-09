import { useEffect, useState } from "react";
import { Star, Loader2, MessageSquarePlus } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { findReflection } from "@/lib/lesson-reflections";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Lesson context */
  subject?: string | null;
  classId?: string | null;
  /** ISO date YYYY-MM-DD */
  date: string;
  /** Optional human label for the lesson (subject + time) */
  lessonLabel?: string;
  lessonPlanId?: string | null;
  /** "quick" hides rating + structured fields, only quick_notes */
  mode?: "full" | "quick";
  /** Called after successful save with the new/updated row id. */
  onSaved?: () => void;
}

export default function LessonReflectionDialog({
  open,
  onOpenChange,
  subject,
  classId,
  date,
  lessonLabel,
  lessonPlanId,
  mode = "full",
  onSaved,
}: Props) {
  const { user } = useAuth();
  const [existingId, setExistingId] = useState<string | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [whatWorked, setWhatWorked] = useState("");
  const [whatToChange, setWhatToChange] = useState("");
  const [quickNotes, setQuickNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    setLoading(true);
    setExistingId(null);
    setRating(0);
    setWhatWorked("");
    setWhatToChange("");
    setQuickNotes("");
    (async () => {
      const r = await findReflection({
        teacherId: user.id,
        subject: subject ?? null,
        classId: classId ?? null,
        date,
      });
      if (cancelled) return;
      if (r) {
        setExistingId(r.id);
        setRating(r.rating || 0);
        setWhatWorked(r.what_worked || "");
        setWhatToChange(r.what_to_change || "");
        setQuickNotes(r.quick_notes || "");
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, user, subject, classId, date]);

  async function handleSave() {
    if (!user) return;
    if (mode === "full" && rating === 0 && !whatWorked.trim() && !whatToChange.trim() && !quickNotes.trim()) {
      toast({ title: "Vyplňte alespoň jedno pole", variant: "destructive" });
      return;
    }
    if (mode === "quick" && !quickNotes.trim()) {
      toast({ title: "Napište poznámku", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload: any = {
      teacher_id: user.id,
      lesson_plan_id: lessonPlanId ?? null,
      subject: subject || null,
      class_id: classId || null,
      reflection_date: date,
      rating: rating > 0 ? rating : null,
      what_worked: whatWorked.trim() || null,
      what_to_change: whatToChange.trim() || null,
      quick_notes: quickNotes.trim() || null,
    };
    let error: any = null;
    if (existingId) {
      const res = await (supabase as any)
        .from("lesson_reflections")
        .update(payload)
        .eq("id", existingId);
      error = res.error;
    } else {
      const res = await (supabase as any)
        .from("lesson_reflections")
        .insert(payload);
      error = res.error;
    }
    setSaving(false);
    if (error) {
      toast({ title: "Uložení se nezdařilo", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: existingId ? "Reflexe upravena" : "Reflexe uložena" });
    onSaved?.();
    onOpenChange(false);
  }

  const dateLabel = (() => {
    try {
      return format(new Date(date), "EEEE d. MMMM yyyy", { locale: cs });
    } catch {
      return date;
    }
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "quick" ? (
              <>
                <MessageSquarePlus className="h-4 w-4 text-primary" />
                Rychlá poznámka
              </>
            ) : (
              <>Reflexe hodiny</>
            )}
          </DialogTitle>
          <DialogDescription>
            {lessonLabel ? `${lessonLabel} · ` : ""}
            {dateLabel}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-1">
            {mode === "full" && (
              <>
                <div>
                  <Label className="text-sm">Hodnocení hodiny</Label>
                  <div className="flex items-center gap-1 mt-1.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setRating(rating === n ? 0 : n)}
                        className="p-1 rounded hover:bg-muted transition-colors"
                        aria-label={`${n} z 5`}
                      >
                        <Star
                          className={cn(
                            "h-6 w-6 transition-colors",
                            n <= rating
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground/40",
                          )}
                        />
                      </button>
                    ))}
                    {rating > 0 && (
                      <span className="ml-2 text-sm text-muted-foreground">{rating}/5</span>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="what-worked" className="text-sm">
                    Co fungovalo
                  </Label>
                  <Textarea
                    id="what-worked"
                    rows={3}
                    value={whatWorked}
                    onChange={(e) => setWhatWorked(e.target.value)}
                    placeholder="Aktivity, momenty, postupy, které měly úspěch…"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="what-to-change" className="text-sm">
                    Co změnit příště
                  </Label>
                  <Textarea
                    id="what-to-change"
                    rows={3}
                    value={whatToChange}
                    onChange={(e) => setWhatToChange(e.target.value)}
                    placeholder="Co příště zkusit jinak nebo upravit…"
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="quick-notes" className="text-sm">
                {mode === "quick" ? "Poznámka" : "Rychlá poznámka"}
              </Label>
              <Textarea
                id="quick-notes"
                rows={mode === "quick" ? 5 : 2}
                value={quickNotes}
                onChange={(e) => setQuickNotes(e.target.value)}
                placeholder={
                  mode === "quick"
                    ? "Zachyťte myšlenku během hodiny…"
                    : "Drobné postřehy, jména žáků, situace…"
                }
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Zrušit
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {existingId ? "Uložit změny" : "Uložit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
