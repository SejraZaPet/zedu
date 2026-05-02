import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { CalendarIcon, Pencil, Plus, Trash2, BookOpen, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
import { useTeacherSubjects } from "@/hooks/useTeacherSubjects";

interface Slot {
  id: string;
  class_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  week_parity: "every" | "odd" | "even";
  room: string | null;
  subject_label: string | null;
  textbook_id: string | null;
  textbook_type: "teacher" | "global" | null;
  valid_from: string | null;
  valid_to: string | null;
}

interface TextbookOption {
  id: string;
  title: string;
  type: "teacher" | "global";
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

const CUSTOM_SUBJECT = "__custom__";
const NO_TEXTBOOK = "__none__";

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
  const { user } = useAuth();

  const [slots, setSlots] = useState<Slot[]>([]);
  const [textbooks, setTextbooks] = useState<TextbookOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Slot | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Slot | null>(null);

  // Form state
  const [subjectChoice, setSubjectChoice] = useState<string>(PREDEFINED_SUBJECTS[0]);
  const [customSubject, setCustomSubject] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("08:45");
  const [parity, setParity] = useState<"every" | "odd" | "even">("every");
  const [room, setRoom] = useState("");
  const [textbookSel, setTextbookSel] = useState<string>(NO_TEXTBOOK);
  const [validFrom, setValidFrom] = useState<Date | undefined>(undefined);
  const [validTo, setValidTo] = useState<Date | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const fetchTextbooks = async () => {
    if (!user) return;
    const [teacherRes, globalRes] = await Promise.all([
      supabase
        .from("teacher_textbooks")
        .select("id, title")
        .eq("teacher_id", user.id)
        .order("title"),
      supabase
        .from("textbook_subjects")
        .select("id, label")
        .eq("active", true)
        .order("sort_order"),
    ]);
    const opts: TextbookOption[] = [
      ...((teacherRes.data ?? []) as any[]).map((t) => ({
        id: t.id,
        title: t.title,
        type: "teacher" as const,
      })),
      ...((globalRes.data ?? []) as any[]).map((t) => ({
        id: t.id,
        title: t.label,
        type: "global" as const,
      })),
    ];
    setTextbooks(opts);
  };

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
      fetchTextbooks();
      setShowForm(false);
      setEditing(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, classId]);

  const resetForm = () => {
    setEditing(null);
    setSubjectChoice(PREDEFINED_SUBJECTS[0]);
    setCustomSubject("");
    setDayOfWeek("1");
    setStartTime("08:00");
    setEndTime("08:45");
    setParity("every");
    setRoom("");
    setTextbookSel(NO_TEXTBOOK);
    setValidFrom(undefined);
    setValidTo(undefined);
  };

  const openCreate = (preselectSubject?: string, preselectTextbookKey?: string) => {
    resetForm();
    if (preselectSubject) {
      if ((PREDEFINED_SUBJECTS as readonly string[]).includes(preselectSubject)) {
        setSubjectChoice(preselectSubject);
      } else {
        setSubjectChoice(CUSTOM_SUBJECT);
        setCustomSubject(preselectSubject);
      }
    }
    if (preselectTextbookKey) setTextbookSel(preselectTextbookKey);
    setShowForm(true);
  };

  const openEdit = (slot: Slot) => {
    setEditing(slot);
    const label = (slot.subject_label || "").trim();
    if ((PREDEFINED_SUBJECTS as readonly string[]).includes(label)) {
      setSubjectChoice(label);
      setCustomSubject("");
    } else {
      setSubjectChoice(CUSTOM_SUBJECT);
      setCustomSubject(label);
    }
    setDayOfWeek(String(slot.day_of_week));
    setStartTime(slot.start_time.slice(0, 5));
    setEndTime(slot.end_time.slice(0, 5));
    setParity(slot.week_parity);
    setRoom(slot.room || "");
    setTextbookSel(
      slot.textbook_id && slot.textbook_type
        ? `${slot.textbook_type}:${slot.textbook_id}`
        : NO_TEXTBOOK,
    );
    setValidFrom(slot.valid_from ? new Date(slot.valid_from) : undefined);
    setValidTo(slot.valid_to ? new Date(slot.valid_to) : undefined);
    setShowForm(true);
  };

  const resolvedSubject =
    subjectChoice === CUSTOM_SUBJECT ? customSubject.trim() : subjectChoice;

  const handleSave = async () => {
    if (!resolvedSubject) {
      toast({ title: "Chyba", description: "Vyberte nebo zadejte předmět.", variant: "destructive" });
      return;
    }
    if (endTime <= startTime) {
      toast({ title: "Chyba", description: "Konec musí být po začátku.", variant: "destructive" });
      return;
    }
    if (validFrom && validTo && validTo < validFrom) {
      toast({ title: "Chyba", description: "Platnost do musí být po platnosti od.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { data: { user: u } } = await supabase.auth.getUser();

    let textbookId: string | null = null;
    let textbookType: "teacher" | "global" | null = null;
    if (textbookSel !== NO_TEXTBOOK) {
      const [t, id] = textbookSel.split(":");
      textbookType = t as "teacher" | "global";
      textbookId = id;
    }

    const payload: any = {
      class_id: classId,
      day_of_week: parseInt(dayOfWeek, 10),
      start_time: startTime,
      end_time: endTime,
      week_parity: parity,
      subject_label: resolvedSubject,
      room: room.trim(),
      textbook_id: textbookId,
      textbook_type: textbookType,
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
      payload.created_by = u?.id ?? null;
      ({ error } = await supabase.from("class_schedule_slots" as any).insert(payload));
    }

    setSaving(false);

    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: editing ? "Uloženo" : "Přidáno", description: "Hodina byla uložena." });
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
    toast({ title: "Smazáno", description: "Hodina byla odstraněna." });
    setDeleteTarget(null);
    fetchSlots();
  };

  // Group slots by subject for overview
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { subject: string; textbookKey: string | null; textbookTitle: string | null; slots: Slot[] }
    >();
    for (const s of slots) {
      const subject = s.subject_label || "Bez předmětu";
      // Group key: subject + textbook (so different textbooks under same subject split visually)
      const tbKey = s.textbook_id && s.textbook_type ? `${s.textbook_type}:${s.textbook_id}` : null;
      const key = `${subject}::${tbKey ?? ""}`;
      if (!map.has(key)) {
        const tb = tbKey ? textbooks.find((t) => `${t.type}:${t.id}` === tbKey) : null;
        map.set(key, {
          subject,
          textbookKey: tbKey,
          textbookTitle: tb?.title ?? null,
          slots: [],
        });
      }
      map.get(key)!.slots.push(s);
    }
    return Array.from(map.values()).sort((a, b) => a.subject.localeCompare(b.subject, "cs"));
  }, [slots, textbooks]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rozvrh třídy {className}</DialogTitle>
            <DialogDescription>
              Přidávejte k třídě více předmětů a u každého libovolný počet hodin v týdnu. Hodiny se
              automaticky propíší do vašeho kalendáře i osobního rozvrhu.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {loading ? (
              <p className="text-sm text-muted-foreground py-4">Načítání...</p>
            ) : grouped.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Žádné hodiny. Přidejte první níže.
              </p>
            ) : (
              grouped.map((g) => (
                <div
                  key={`${g.subject}::${g.textbookKey ?? ""}`}
                  className="border border-border rounded-lg p-3 bg-muted/20"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <Badge variant="default" className="font-medium">
                        {g.subject}
                      </Badge>
                      {g.textbookTitle && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <BookOpen className="w-3 h-3" />
                          {g.textbookTitle}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {g.slots.length} {g.slots.length === 1 ? "hodina" : g.slots.length < 5 ? "hodiny" : "hodin"} týdně
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => openCreate(g.subject, g.textbookKey ?? undefined)}
                      title="Přidat další hodinu tohoto předmětu"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Hodina
                    </Button>
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
                          {slot.week_parity !== "every" && (
                            <Badge variant="outline" className="text-[10px] px-1.5">
                              {formatParity(slot.week_parity)}
                            </Badge>
                          )}
                          {slot.room && (
                            <span className="text-xs text-muted-foreground">· {slot.room}</span>
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

          {!showForm && (
            <Button onClick={() => openCreate()} variant="outline" className="w-full mt-2">
              <Plus className="w-4 h-4 mr-1" /> Přidat hodinu / předmět
            </Button>
          )}

          {showForm && (
            <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30 mt-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {editing ? "Upravit hodinu" : "Nová hodina"}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <Label>Předmět *</Label>
                  <Select value={subjectChoice} onValueChange={setSubjectChoice}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {PREDEFINED_SUBJECTS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                      <SelectItem value={CUSTOM_SUBJECT}>+ Vlastní název…</SelectItem>
                    </SelectContent>
                  </Select>
                  {subjectChoice === CUSTOM_SUBJECT && (
                    <Input
                      className="mt-2"
                      value={customSubject}
                      onChange={(e) => setCustomSubject(e.target.value)}
                      placeholder="Zadejte vlastní název předmětu"
                    />
                  )}
                </div>

                <div className="sm:col-span-2">
                  <Label className="flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" /> Učebnice (nepovinné)
                  </Label>
                  <Select value={textbookSel} onValueChange={setTextbookSel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value={NO_TEXTBOOK}>— Bez učebnice —</SelectItem>
                      {textbooks.filter((t) => t.type === "teacher").length > 0 && (
                        <>
                          <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                            Mé učebnice
                          </div>
                          {textbooks
                            .filter((t) => t.type === "teacher")
                            .map((t) => (
                              <SelectItem key={`teacher:${t.id}`} value={`teacher:${t.id}`}>
                                {t.title}
                              </SelectItem>
                            ))}
                        </>
                      )}
                      {textbooks.filter((t) => t.type === "global").length > 0 && (
                        <>
                          <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                            Globální
                          </div>
                          {textbooks
                            .filter((t) => t.type === "global")
                            .map((t) => (
                              <SelectItem key={`global:${t.id}`} value={`global:${t.id}`}>
                                {t.title}
                              </SelectItem>
                            ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

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

                <div className="sm:col-span-2">
                  <Label>Učebna</Label>
                  <Input
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    placeholder="např. Učebna 12"
                  />
                </div>

                <div>
                  <Label>Platnost od</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !validFrom && "text-muted-foreground",
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
                          !validTo && "text-muted-foreground",
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
