import { useState, useEffect, useMemo } from "react";
import { Pencil, Plus, Trash2, BookOpen, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { loadSchedule } from "@/lib/teacher-schedule-store";
import LessonFormDialog, {
  type LessonFormPeriod,
  type LessonFormResult,
} from "@/components/schedule/LessonFormDialog";

interface Slot {
  id: string;
  class_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  week_parity: "every" | "odd" | "even";
  room: string | null;
  subject_label: string | null;
  abbreviation: string | null;
  color: string | null;
  textbook_id: string | null;
  textbook_type: "teacher" | "global" | null;
  valid_from: string | null;
  valid_to: string | null;
}

interface Props {
  classId: string;
  className: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DAY_LABELS = ["", "Po", "Út", "St", "Čt", "Pá", "So", "Ne"];
const formatDay = (d: number) => DAY_LABELS[d] ?? "";
const formatTime = (t: string) => {
  if (!t) return "";
  const [h, m] = t.split(":");
  return `${parseInt(h, 10)}:${m}`;
};

const ClassScheduleDialog = ({ classId, className, open, onOpenChange }: Props) => {
  const { toast } = useToast();
  const { user } = useAuth();

  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Slot | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Slot | null>(null);

  // Periods come from the teacher's personal schedule (single source of truth)
  const periods: LessonFormPeriod[] = useMemo(() => {
    if (!open) return [];
    const sch = loadSchedule();
    return sch.periods
      .map((p) => {
        const t = sch.periodTimes[p];
        return t ? { period: p, start: t.start, end: t.end } : null;
      })
      .filter((x): x is LessonFormPeriod => x !== null);
  }, [open]);

  const fetchSlots = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("class_schedule_slots" as any)
      .select("*")
      .eq("class_id", classId)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    } else {
      setSlots((data as any) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      fetchSlots();
      setFormOpen(false);
      setEditing(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, classId]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (slot: Slot) => {
    setEditing(slot);
    setFormOpen(true);
  };

  const slotToPeriod = (slot: Slot): number => {
    const sStart = slot.start_time.slice(0, 5);
    const sEnd = slot.end_time.slice(0, 5);
    const match = periods.find((p) => p.start === sStart && p.end === sEnd);
    return match?.period ?? periods[0]?.period ?? 1;
  };

  const handleSave = async ({ value, slots: lessonSlots }: LessonFormResult) => {
    if (!user) return;
    if (!value.subject) {
      toast({ title: "Chyba", description: "Vyberte předmět.", variant: "destructive" });
      return;
    }
    if (lessonSlots.length === 0) {
      toast({ title: "Chyba", description: "Vyberte alespoň jeden den.", variant: "destructive" });
      return;
    }

    const basePayload = {
      class_id: classId,
      subject_label: value.subject,
      room: value.room,
      valid_from: value.validFrom,
      valid_to: value.validTo,
      week_parity: "every" as const,
    };

    if (editing) {
      // Edit → single slot update
      const s = lessonSlots[0];
      const { error } = await supabase
        .from("class_schedule_slots" as any)
        .update({
          ...basePayload,
          day_of_week: s.day + 1, // form uses 0=Mon, DB uses 1=Mon
          start_time: s.start,
          end_time: s.end,
        })
        .eq("id", editing.id);
      if (error) {
        toast({ title: "Chyba", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Uloženo", description: "Hodina byla aktualizována." });
    } else {
      // New → insert one row per selected day
      const rows = lessonSlots.map((s) => ({
        ...basePayload,
        day_of_week: s.day + 1,
        start_time: s.start,
        end_time: s.end,
        created_by: user.id,
      }));
      const { error } = await supabase.from("class_schedule_slots" as any).insert(rows);
      if (error) {
        toast({ title: "Chyba", description: error.message, variant: "destructive" });
        return;
      }
      toast({
        title: "Přidáno",
        description:
          rows.length > 1 ? `Hodina přidána do ${rows.length} dnů.` : "Hodina byla přidána.",
      });
    }
    setFormOpen(false);
    setEditing(null);
    fetchSlots();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from("class_schedule_slots" as any)
      .delete()
      .eq("id", deleteTarget.id);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Smazáno", description: "Hodina byla odstraněna." });
    setDeleteTarget(null);
    fetchSlots();
  };

  // Group slots by subject for overview
  const grouped = useMemo(() => {
    const map = new Map<string, { subject: string; slots: Slot[] }>();
    for (const s of slots) {
      const subject = s.subject_label || "Bez předmětu";
      if (!map.has(subject)) map.set(subject, { subject, slots: [] });
      map.get(subject)!.slots.push(s);
    }
    return Array.from(map.values()).sort((a, b) => a.subject.localeCompare(b.subject, "cs"));
  }, [slots]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-4 h-4" /> Rozvrh třídy {className}
            </DialogTitle>
            <DialogDescription>
              Hodiny přidané zde se automaticky propíší do vašeho osobního rozvrhu i kalendáře.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground py-4">Načítání...</p>
            ) : grouped.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Žádné hodiny. Přidejte první níže.
              </p>
            ) : (
              grouped.map((g) => (
                <div key={g.subject} className="border border-border rounded-lg p-3 bg-muted/20">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <Badge variant="default" className="font-medium">
                      {g.subject}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {g.slots.length}{" "}
                      {g.slots.length === 1 ? "hodina" : g.slots.length < 5 ? "hodiny" : "hodin"} týdně
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {g.slots.map((slot) => (
                      <div
                        key={slot.id}
                        className="flex items-center justify-between gap-2 bg-background border border-border/50 rounded-md px-2.5 py-1.5"
                      >
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <Badge variant="secondary" className="font-mono text-xs">
                            {formatDay(slot.day_of_week)}
                          </Badge>
                          <span className="text-sm font-medium tabular-nums">
                            {formatTime(slot.start_time)}–{formatTime(slot.end_time)}
                          </span>
                          {slot.room && (
                            <span className="text-xs text-muted-foreground">· {slot.room}</span>
                          )}
                          {(slot.valid_from || slot.valid_to) && (
                            <Badge variant="outline" className="text-[10px]">
                              {slot.valid_from ?? "…"} – {slot.valid_to ?? "…"}
                            </Badge>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEdit(slot)}
                            className="h-7 w-7 p-0"
                            title="Upravit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteTarget(slot)}
                            className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                            title="Smazat"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          <Button onClick={openCreate} variant="outline" className="w-full mt-2">
            <Plus className="w-4 h-4 mr-1" /> Přidat hodinu
          </Button>
        </DialogContent>
      </Dialog>

      <LessonFormDialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditing(null);
        }}
        isNew={!editing}
        initial={
          editing
            ? {
                day: editing.day_of_week - 1,
                period: slotToPeriod(editing),
                subject: editing.subject_label ?? "",
                classId,
                className,
                room: editing.room ?? "",
                validFrom: editing.valid_from ?? null,
                validTo: editing.valid_to ?? null,
              }
            : { classId, className }
        }
        periods={periods}
        onSave={handleSave}
        title={editing ? "Upravit hodinu" : "Nová hodina"}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smazat hodinu?</AlertDialogTitle>
            <AlertDialogDescription>
              Hodina bude trvale odstraněna. Tuto akci nelze vrátit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Smazat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ClassScheduleDialog;
