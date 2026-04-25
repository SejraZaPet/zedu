import { useState, useEffect } from "react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { CalendarIcon, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

interface Slot {
  id: string;
  class_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  week_parity: "every" | "odd" | "even";
  room: string | null;
  subject_label: string | null;
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
const DAY_OPTIONS = [
  { value: "1", label: "Pondělí" },
  { value: "2", label: "Úterý" },
  { value: "3", label: "Středa" },
  { value: "4", label: "Čtvrtek" },
  { value: "5", label: "Pátek" },
  { value: "6", label: "Sobota" },
  { value: "7", label: "Neděle" },
];

const formatDay = (d: number) => DAY_LABELS[d] ?? "";
const formatParity = (p: string) =>
  p === "odd" ? "lichý týden" : p === "even" ? "sudý týden" : "každý týden";
const formatTime = (t: string) => {
  if (!t) return "";
  const [h, m] = t.split(":");
  return `${parseInt(h, 10)}:${m}`;
};

const ClassScheduleDialog = ({ classId, className, open, onOpenChange }: Props) => {
  const { toast } = useToast();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Slot | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Slot | null>(null);

  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("08:45");
  const [parity, setParity] = useState<"every" | "odd" | "even">("every");
  const [subject, setSubject] = useState("");
  const [room, setRoom] = useState("");
  const [validFrom, setValidFrom] = useState<Date | undefined>(undefined);
  const [validTo, setValidTo] = useState<Date | undefined>(undefined);
  const [saving, setSaving] = useState(false);

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
      setShowForm(false);
      setEditing(null);
    }
  }, [open, classId]);

  const resetForm = () => {
    setEditing(null);
    setDayOfWeek("1");
    setStartTime("08:00");
    setEndTime("08:45");
    setParity("every");
    setSubject("");
    setRoom("");
    setValidFrom(undefined);
    setValidTo(undefined);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (slot: Slot) => {
    setEditing(slot);
    setDayOfWeek(String(slot.day_of_week));
    setStartTime(slot.start_time.slice(0, 5));
    setEndTime(slot.end_time.slice(0, 5));
    setParity(slot.week_parity);
    setSubject(slot.subject_label || "");
    setRoom(slot.room || "");
    setValidFrom(slot.valid_from ? new Date(slot.valid_from) : undefined);
    setValidTo(slot.valid_to ? new Date(slot.valid_to) : undefined);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (endTime <= startTime) {
      toast({ title: "Chyba", description: "Konec musí být po začátku.", variant: "destructive" });
      return;
    }
    if (validFrom && validTo && validTo < validFrom) {
      toast({ title: "Chyba", description: "Platnost do musí být po platnosti od.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    const payload: any = {
      class_id: classId,
      day_of_week: parseInt(dayOfWeek, 10),
      start_time: startTime,
      end_time: endTime,
      week_parity: parity,
      subject_label: subject.trim(),
      room: room.trim(),
      valid_from: validFrom ? format(validFrom, "yyyy-MM-dd") : null,
      valid_to: validTo ? format(validTo, "yyyy-MM-dd") : null,
    };

    let error;
    if (editing) {
      ({ error } = await supabase
        .from("class_schedule_slots" as any)
        .update(payload)
        .eq("id", editing.id));
    } else {
      payload.created_by = user?.id ?? null;
      ({ error } = await supabase.from("class_schedule_slots" as any).insert(payload));
    }

    setSaving(false);

    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: editing ? "Uloženo" : "Přidáno", description: "Slot rozvrhu byl uložen." });
    setShowForm(false);
    resetForm();
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
    toast({ title: "Smazáno", description: "Slot byl odstraněn." });
    setDeleteTarget(null);
    fetchSlots();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rozvrh třídy {className}</DialogTitle>
            <DialogDescription>
              Nastav, kdy se třída schází. Žáci uvidí sloty ve svém kalendáři.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {loading ? (
              <p className="text-sm text-muted-foreground py-4">Načítání...</p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Žádné sloty. Přidejte první níže.
              </p>
            ) : (
              slots.map((slot) => (
                <div
                  key={slot.id}
                  className="flex items-center justify-between gap-2 border border-border rounded-lg p-3"
                >
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <Badge variant="secondary" className="font-mono">
                      {formatDay(slot.day_of_week)}
                    </Badge>
                    <span className="text-sm font-medium">
                      {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {formatParity(slot.week_parity)}
                    </Badge>
                    {(slot.subject_label || slot.room) && (
                      <span className="text-xs text-muted-foreground truncate">
                        {slot.subject_label}
                        {slot.subject_label && slot.room ? " · " : ""}
                        {slot.room}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(slot)}
                      className="h-8 px-2"
                      title="Upravit"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleteTarget(slot)}
                      className="h-8 px-2 text-destructive hover:bg-destructive/10"
                      title="Smazat"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {!showForm && (
            <Button onClick={openCreate} variant="outline" className="w-full">
              <Plus className="w-4 h-4 mr-1" /> Přidat slot
            </Button>
          )}

          {showForm && (
            <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
              <h3 className="text-sm font-semibold">
                {editing ? "Upravit slot" : "Nový slot"}
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Den v týdnu</Label>
                  <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAY_OPTIONS.map((d) => (
                        <SelectItem key={d.value} value={d.value}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Týden</Label>
                  <Select value={parity} onValueChange={(v: any) => setParity(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="every">Každý týden</SelectItem>
                      <SelectItem value="odd">Lichý týden</SelectItem>
                      <SelectItem value="even">Sudý týden</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Začátek</Label>
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Konec</Label>
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label>Předmět</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="např. Matematika"
                />
              </div>

              <div>
                <Label>Učebna</Label>
                <Input
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  placeholder="např. Učebna 12"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Platnost od</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !validFrom && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {validFrom ? format(validFrom, "d. M. yyyy", { locale: cs }) : "—"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={validFrom}
                        onSelect={setValidFrom}
                        locale={cs}
                        className={cn("p-3 pointer-events-auto")}
                      />
                      {validFrom && (
                        <div className="p-2 border-t">
                          <Button variant="ghost" size="sm" onClick={() => setValidFrom(undefined)} className="w-full">
                            Vymazat
                          </Button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>Platnost do</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !validTo && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {validTo ? format(validTo, "d. M. yyyy", { locale: cs }) : "—"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={validTo}
                        onSelect={setValidTo}
                        locale={cs}
                        className={cn("p-3 pointer-events-auto")}
                      />
                      {validTo && (
                        <div className="p-2 border-t">
                          <Button variant="ghost" size="sm" onClick={() => setValidTo(undefined)} className="w-full">
                            Vymazat
                          </Button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                >
                  Zrušit
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Ukládání..." : "Uložit"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smazat slot?</AlertDialogTitle>
            <AlertDialogDescription>
              Slot bude trvale odstraněn. Tuto akci nelze vrátit.
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
