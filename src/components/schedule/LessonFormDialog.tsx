import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import {
  CalendarIcon,
  Check,
  Clock,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useTeacherSubjects } from "@/hooks/useTeacherSubjects";
import { useTeacherClasses } from "@/hooks/useTeacherClasses";
import {
  SUBJECT_COLORS,
  colorForSubject,
  type PeriodTime,
} from "@/lib/teacher-schedule-store";

const DAYS = ["Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek"];
const DAYS_SHORT = ["Po", "Út", "St", "Čt", "Pá"];

const NO_CLASS = "__none__";
const CUSTOM_SUBJECT = "__custom__";

export interface LessonFormPeriod {
  period: number;
  start: string;
  end: string;
}

/** A single lesson "slot" produced by the form (one per selected day). */
export interface LessonFormSlot {
  day: number; // 0=Mon..4=Fri
  period: number;
  start: string;
  end: string;
}

export interface LessonFormValue {
  /** Subject display name (always non-empty when valid). */
  subject: string;
  abbreviation: string;
  color: string;
  classId: string | null;
  className: string;
  room: string;
  validFrom: string | null; // YYYY-MM-DD
  validTo: string | null;
  weekParity: "every" | "odd" | "even";
  mirrorBoth?: boolean;
}

export interface LessonFormResult {
  value: LessonFormValue;
  slots: LessonFormSlot[];
}

export interface LessonFormInitial extends Partial<LessonFormValue> {
  /** When editing → exactly one entry. When new → optional default day. */
  day?: number;
  period?: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isNew: boolean;
  initial: LessonFormInitial | null;
  /** Available periods (with start/end times) the user can pick. */
  periods: LessonFormPeriod[];
  /** Save handler – returns result. */
  onSave: (result: LessonFormResult) => Promise<void> | void;
  /** Optional delete handler for edit mode. */
  onDelete?: () => Promise<void> | void;
  /** Show "mirror to both weeks" switch (only for personal odd/even mode). */
  showMirrorSwitch?: boolean;
  /** Title prefix shown in the header. */
  title?: string;
}

/**
 * Unified "Nová hodina" dialog used both by Teacher Schedule and Class Schedule.
 *
 * Features:
 *  - Multi-day picker (new mode); each selected day gets its own period.
 *  - Subject selector backed by `useTeacherSubjects` (auto-prefills abbreviation).
 *  - Class selector backed by `useTeacherClasses` (no free text).
 *  - Color picker, room, validFrom/validTo dates.
 */
export default function LessonFormDialog({
  open,
  onOpenChange,
  isNew,
  initial,
  periods,
  onSave,
  onDelete,
  showMirrorSwitch,
  title,
}: Props) {
  const { subjects } = useTeacherSubjects();
  const { classes } = useTeacherClasses();

  const defaultPeriod = useMemo(
    () => initial?.period ?? periods[0]?.period ?? 1,
    [initial?.period, periods],
  );

  // ----- Form state -----
  const [subjectChoice, setSubjectChoice] = useState<string>("");
  const [customSubject, setCustomSubject] = useState("");
  const [abbreviation, setAbbreviation] = useState("");
  const [color, setColor] = useState<string>(SUBJECT_COLORS[0].value);
  const [classSel, setClassSel] = useState<string>(NO_CLASS);
  const [room, setRoom] = useState("");
  const [validFrom, setValidFrom] = useState<Date | undefined>();
  const [validTo, setValidTo] = useState<Date | undefined>();
  const [mirrorBoth, setMirrorBoth] = useState(false);
  const [weekParity, setWeekParity] = useState<"every" | "odd" | "even">("every");

  // Slots: list of {day, period} pairs. Multiple entries per day are allowed
  // so a teacher can place the same subject in two different periods on the
  // same day (e.g. two Math lessons on Thursday).
  const [slotPairs, setSlotPairs] = useState<Array<{ day: number; period: number }>>([]);

  // Reset when opening
  useEffect(() => {
    if (!open) return;
    const subj = (initial?.subject ?? "").trim();
    const known = subjects.find((s) => s.label.toLowerCase() === subj.toLowerCase());
    if (subj && known) {
      setSubjectChoice(known.label);
      setCustomSubject("");
    } else if (subj) {
      setSubjectChoice(CUSTOM_SUBJECT);
      setCustomSubject(subj);
    } else {
      setSubjectChoice("");
      setCustomSubject("");
    }
    setAbbreviation(initial?.abbreviation ?? "");
    setColor(initial?.color ?? colorForSubject(subj));
    setClassSel(initial?.classId ?? NO_CLASS);
    setRoom(initial?.room ?? "");
    setValidFrom(initial?.validFrom ? new Date(initial.validFrom) : undefined);
    setValidTo(initial?.validTo ? new Date(initial.validTo) : undefined);
    setMirrorBoth(!!initial?.mirrorBoth);
    setWeekParity(initial?.weekParity ?? "every");

    const startDay = initial?.day ?? 0;
    setSlotPairs([{ day: startDay, period: initial?.period ?? defaultPeriod }]);
  }, [open, isNew, initial, subjects, defaultPeriod]);

  const selectedDays = useMemo(
    () => Array.from(new Set(slotPairs.map((s) => s.day))).sort(),
    [slotPairs],
  );

  // When subject changes via select → auto-fill abbreviation/color from registry
  useEffect(() => {
    if (subjectChoice === CUSTOM_SUBJECT || !subjectChoice) return;
    const found = subjects.find((s) => s.label === subjectChoice);
    if (!found) return;
    if (found.abbreviation) setAbbreviation(found.abbreviation.toUpperCase());
    else setAbbreviation((cur) => cur || found.label.slice(0, 3).toUpperCase());
    if (found.color) setColor(found.color);
  }, [subjectChoice, subjects]);

  // When custom subject text changes → derive abbreviation suggestion if empty
  useEffect(() => {
    if (subjectChoice !== CUSTOM_SUBJECT) return;
    if (!abbreviation && customSubject.trim()) {
      setAbbreviation(customSubject.trim().slice(0, 3).toUpperCase());
    }
  }, [customSubject, subjectChoice, abbreviation]);

  const resolvedSubject =
    subjectChoice === CUSTOM_SUBJECT ? customSubject.trim() : subjectChoice.trim();

  const periodById = useMemo(() => {
    const m = new Map<number, LessonFormPeriod>();
    for (const p of periods) m.set(p.period, p);
    return m;
  }, [periods]);

  function toggleDay(d: number) {
    setSlotPairs((prev) => {
      const has = prev.some((s) => s.day === d);
      if (has) return prev.filter((s) => s.day !== d);
      return [...prev, { day: d, period: defaultPeriod }].sort(
        (a, b) => a.day - b.day || a.period - b.period,
      );
    });
  }

  function updateSlotPeriod(index: number, period: number) {
    setSlotPairs((prev) => prev.map((s, i) => (i === index ? { ...s, period } : s)));
  }

  function addSlotForDay(day: number) {
    setSlotPairs((prev) => {
      const usedPeriods = new Set(prev.filter((s) => s.day === day).map((s) => s.period));
      const nextPeriod =
        periods.find((p) => !usedPeriods.has(p.period))?.period ?? defaultPeriod;
      return [...prev, { day, period: nextPeriod }].sort(
        (a, b) => a.day - b.day || a.period - b.period,
      );
    });
  }

  function removeSlotAt(index: number) {
    setSlotPairs((prev) => prev.filter((_, i) => i !== index));
  }

  function buildSlots(): LessonFormSlot[] {
    return slotPairs
      .map(({ day, period }) => {
        const t = periodById.get(period);
        if (!t) return null;
        return { day, period, start: t.start, end: t.end };
      })
      .filter((x): x is LessonFormSlot => x !== null);
  }

  async function handleSave() {
    if (!resolvedSubject) return;
    const slots = buildSlots();
    if (slots.length === 0) return;

    const selectedClass = classes.find((c) => c.id === classSel);
    const value: LessonFormValue = {
      subject: resolvedSubject,
      abbreviation: (abbreviation || resolvedSubject.slice(0, 3)).toUpperCase().slice(0, 5),
      color: color || colorForSubject(resolvedSubject),
      classId: classSel === NO_CLASS ? null : classSel,
      className: selectedClass?.name ?? "",
      room: room.trim(),
      validFrom: validFrom ? format(validFrom, "yyyy-MM-dd") : null,
      validTo: validTo ? format(validTo, "yyyy-MM-dd") : null,
      mirrorBoth,
      weekParity,
    };
    await onSave({ value, slots });
  }

  const validationError =
    !resolvedSubject
      ? "Vyberte předmět."
      : selectedDays.length === 0
        ? "Vyberte alespoň jeden den."
        : validFrom && validTo && validTo < validFrom
          ? "Platnost do musí být po platnosti od."
          : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-4 h-4" />
            {title ?? (isNew ? "Nová hodina" : "Upravit hodinu")}
          </DialogTitle>
          <DialogDescription>
            {isNew
              ? "Hodinu lze přidat do více dní najednou. U každého dne nastavte vlastní číslo hodiny."
              : "Uprav detaily hodiny – můžete také přidat tento předmět do dalších dní."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* ----- Day(s) ----- */}
          <div className="space-y-2">
            <Label>Dny v týdnu *</Label>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((d, i) => {
                const active = selectedDays.includes(i);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={`px-3 py-1.5 text-xs rounded-md border transition-colors flex items-center gap-1 ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card border-border hover:bg-muted"
                    }`}
                  >
                    {active && <Check className="w-3 h-3" />}
                    {d}
                  </button>
                );
              })}
            </div>

            {slotPairs.length > 0 && (
              <div className="space-y-1.5 rounded-md border border-border bg-muted/30 p-2.5">
                <Label className="text-xs text-muted-foreground">
                  Číslo hodiny pro každý den (lze přidat i víc hodin do jednoho dne)
                </Label>
                <div className="space-y-1.5">
                  {selectedDays.map((d) => {
                    const indices = slotPairs
                      .map((s, i) => ({ s, i }))
                      .filter((x) => x.s.day === d);
                    return (
                      <div key={d} className="space-y-1">
                        {indices.map(({ s, i }, k) => (
                          <div key={`${d}-${i}`} className="flex items-center gap-2">
                            <span className="text-xs font-medium w-16 shrink-0">
                              {k === 0 ? DAYS[d] : ""}
                            </span>
                            <Select
                              value={String(s.period)}
                              onValueChange={(v) => updateSlotPeriod(i, parseInt(v, 10))}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {periods.map((p) => (
                                  <SelectItem key={p.period} value={String(p.period)}>
                                    {p.period}. hod · {p.start}–{p.end}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {indices.length > 1 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeSlotAt(i)}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                title="Odebrat tuto hodinu"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        ))}
                        <div className="pl-[72px]">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => addSlotForDay(d)}
                            className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            <Plus className="w-3 h-3 mr-1" /> Přidat další hodinu v tento den
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ----- Subject ----- */}
          <div className="space-y-1.5">
            <Label>Předmět *</Label>
            <Select value={subjectChoice} onValueChange={setSubjectChoice}>
              <SelectTrigger>
                <SelectValue placeholder="Vyberte předmět" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {subjects.length === 0 && (
                  <div className="px-2 py-1 text-xs text-muted-foreground">
                    Žádné předměty. Přidejte učebnici nebo předmět v nastavení.
                  </div>
                )}
                {subjects.map((s) => (
                  <SelectItem key={`${s.source}-${s.label}`} value={s.label}>
                    {s.abbreviation ? `${s.abbreviation} · ${s.label}` : s.label}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM_SUBJECT}>+ Vlastní název…</SelectItem>
              </SelectContent>
            </Select>
            {subjectChoice === CUSTOM_SUBJECT && (
              <Input
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                placeholder="Zadejte vlastní název předmětu"
              />
            )}
          </div>

          {/* ----- Abbreviation + Class ----- */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Zkratka</Label>
              <Input
                value={abbreviation}
                onChange={(e) => setAbbreviation(e.target.value.toUpperCase().slice(0, 5))}
                placeholder="MAT"
                maxLength={5}
              />
              <p className="text-[10px] text-muted-foreground">
                Předvyplňuje se z předmětu.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                <Users className="w-3 h-3" /> Třída
              </Label>
              <Select value={classSel} onValueChange={setClassSel}>
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CLASS}>— Bez třídy —</SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {classes.length === 0 && (
                <p className="text-[10px] text-muted-foreground">
                  Zatím nemáte žádné třídy.
                </p>
              )}
            </div>
          </div>

          {/* ----- Room ----- */}
          <div className="space-y-1.5">
            <Label>Místnost</Label>
            <Input
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="Např. 204"
            />
          </div>

          {/* ----- Validity ----- */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setValidFrom(undefined)}
                        className="w-full"
                      >
                        Vymazat
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setValidTo(undefined)}
                        className="w-full"
                      >
                        Vymazat
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Hodina se zobrazuje v rozvrhu i kalendáři pouze v daném období. Bez data platí trvale.
          </p>

          {/* ----- Color ----- */}
          <div className="space-y-1.5">
            <Label>Barva</Label>
            <div className="flex flex-wrap gap-2">
              {SUBJECT_COLORS.map((c) => {
                const active = color === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${
                      active ? "border-foreground scale-110" : "border-border hover:scale-105"
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                    aria-label={c.label}
                  >
                    {active && <Check className="w-4 h-4 text-white" />}
                  </button>
                );
              })}
              <input
                type="color"
                value={color || "#6EC6D9"}
                onChange={(e) => setColor(e.target.value)}
                className="w-8 h-8 rounded-full border border-border cursor-pointer p-0 bg-transparent"
                title="Vlastní barva"
                aria-label="Vlastní barva"
              />
            </div>
          </div>

          {showMirrorSwitch && (
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 p-3">
              <div className="space-y-0.5 pr-3">
                <div className="text-sm font-medium">Propsat do obou týdnů</div>
                <div className="text-xs text-muted-foreground">
                  Tato hodina se zobrazí v lichém i sudém týdnu zároveň.
                </div>
              </div>
              <Switch checked={mirrorBoth} onCheckedChange={setMirrorBoth} />
            </div>
          )}

          {validationError && (
            <p className="text-xs text-destructive">{validationError}</p>
          )}
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
          {!isNew && onDelete ? (
            <Button variant="outline" onClick={onDelete} className="text-destructive">
              <Trash2 className="w-4 h-4 mr-2" /> Smazat
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Zrušit
            </Button>
            <Button onClick={handleSave} disabled={!!validationError}>
              {slotPairs.length > 1
                ? `Uložit ${slotPairs.length} hodin`
                : "Uložit"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
