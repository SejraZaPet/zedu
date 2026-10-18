import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { AlertTriangle } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { formatTime, type CalendarEvent } from "@/lib/calendar-utils";
import { resolvePragueTime, scheduleTimeConflicts, type EffectiveScheduleOccurrence } from "@/lib/schedule-exceptions";
import {
  findLinkedPlans, nextOccurrenceDate, ownedSource, saveException, type Expander,
} from "@/lib/schedule-exception-store";

interface Props {
  event: CalendarEvent | null;
  mode: "move" | "cancel" | "revert" | null;
  onClose: () => void;
  /** Effective events around the target (used only for the conflict warning). */
  events: CalendarEvent[];
  expand: Expander;
  onSaved: () => void;
}

/** One-off move / cancel / revert of a single owned timetable lesson (teacher-only). */
export default function ScheduleExceptionDialog({ event, mode, onClose, events, expand, onSaved }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const source = event && user ? ownedSource(event, user.id) : null;
  const durationMin = event ? Math.round((event.end.getTime() - event.start.getTime()) / 60000) : 45;
  const origStart = event ? event.originalStart ?? event.start : new Date();
  const [newDate, setNewDate] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [planAction, setPlanAction] = useState<"unassigned" | "next">("unassigned");
  const [planCount, setPlanCount] = useState(0);
  const [planIds, setPlanIds] = useState<string[]>([]);
  const [confirmConflict, setConfirmConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!event || !mode) return;
    setNewDate(format(event.start, "yyyy-MM-dd"));
    setNewStart(format(event.start, "HH:mm"));
    setNewEnd(format(event.end, "HH:mm"));
    setReason(""); setNote(""); setPlanAction("unassigned"); setConfirmConflict(false); setError(null);
    setPlanIds([]); setPlanCount(0);
    if (user && source && mode !== "revert") {
      findLinkedPlans(user.id, event, source.originalDate)
        .then((plans) => { setPlanIds(plans.map((p) => p.id)); setPlanCount(plans.length); })
        .catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id, mode]);

  const nextDate = useMemo(
    () => (source && mode === "cancel" ? nextOccurrenceDate(source, source.originalDate, expand) : null),
    [source?.slotId, source?.originalDate, mode, expand],
  );

  const conflicts = useMemo(() => {
    if (mode !== "move" || !source || !newDate || !newStart || !newEnd) return [];
    try {
      const start = resolvePragueTime(newDate, newStart);
      const end = resolvePragueTime(newDate, newEnd);
      if (end <= start) return [];
      const ids = new Set(events.map((e) => e.id));
      const sameDay = (e: CalendarEvent) => format(e.start, "yyyy-MM-dd") === newDate;
      const raw = expand(new Date(`${newDate}T00:00:00`), new Date(`${newDate}T23:59:59`)).filter((e) => !ids.has(e.id));
      const teaching = [...events.filter(sameDay), ...raw]
        .filter((e) => e.type === "lesson" && e.scheduleStatus !== "cancelled" && e.scheduleStatus !== "moved_from")
        .map((e) => ({ ...e, isTeachingOccurrence: true, source: ownedSource(e, user!.id) ?? { kind: "class_slot", ownerId: "", slotId: e.id, originalDate: "" } })) as EffectiveScheduleOccurrence[];
      return scheduleTimeConflicts({ start, end }, teaching, source);
    } catch {
      return [];
    }
  }, [mode, source, newDate, newStart, newEnd, events, user, expand]);

  useEffect(() => setConfirmConflict(false), [newDate, newStart, newEnd]);

  if (!event || !mode || !source) return null;

  const title = mode === "move" ? "Přesunout hodinu" : mode === "cancel" ? "Zrušit hodinu" : "Vrátit hodinu zpět";
  const origLabel = `${format(origStart, "EEEE d. M. yyyy", { locale: cs })}, ${formatTime(origStart)}`;

  function validateMove(): string | null {
    if (!newDate || !newStart || !newEnd) return "Vyplňte datum, začátek a konec.";
    try {
      const s = resolvePragueTime(newDate, newStart);
      const e = resolvePragueTime(newDate, newEnd);
      if (e <= s) return "Konec hodiny musí být po začátku.";
    } catch (err) {
      return err instanceof Error ? err.message : "Neplatný čas.";
    }
    if (conflicts.length && !confirmConflict) return "conflict";
    return null;
  }

  async function submit() {
    setError(null);
    if (mode === "move") {
      const v = validateMove();
      if (v === "conflict") { setError("Ve zvoleném čase už máte jinou hodinu. Potvrďte přesun, pokud chcete pokračovat."); return; }
      if (v) { setError(v); return; }
    }
    if (mode === "cancel" && planAction === "next" && !nextDate) {
      setError("Další hodina tohoto rozvrhu v nejbližších týdnech není."); return;
    }
    setSaving(true);
    try {
      await saveException({
        source: source!,
        action: mode === "move" ? "moved" : mode === "cancel" ? "cancelled" : "reverted",
        newDate: mode === "move" ? newDate : undefined,
        newStart: mode === "move" ? newStart : undefined,
        newEnd: mode === "move" ? newEnd : undefined,
        reason: reason.trim(),
        note: note.trim(),
        planIds: mode === "revert" ? [] : planIds,
        planAction: mode === "cancel" ? planAction : "unassigned",
        nextDate: mode === "cancel" && planAction === "next" ? nextDate : null,
      });
      toast({ title: mode === "move" ? "Hodina přesunuta" : mode === "cancel" ? "Hodina zrušena" : "Hodina vrácena do rozvrhu" });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Změnu se nepodařilo uložit.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {event.title}{event.className ? ` · ${event.className}` : ""} — {origLabel}. Změna platí jen pro tento jeden termín a uvidíte ji pouze Vy.
          </DialogDescription>
        </DialogHeader>

        {mode === "move" && (
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="sx-date">Nové datum</Label>
              <Input id="sx-date" type="date" className="h-11" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="sx-start">Začátek</Label>
                <Input id="sx-start" type="time" className="h-11" value={newStart} onChange={(e) => {
                  setNewStart(e.target.value);
                  const [h, m] = e.target.value.split(":").map(Number);
                  if (Number.isFinite(h) && Number.isFinite(m)) {
                    const t = h * 60 + m + durationMin;
                    if (t < 24 * 60) setNewEnd(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
                  }
                }} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="sx-end">Konec</Label>
                <Input id="sx-end" type="time" className="h-11" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
              </div>
            </div>
            {conflicts.length > 0 && (
              <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                <p className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4" /> Ve zvoleném čase už máte:</p>
                <ul className="mt-1 list-disc pl-5">
                  {conflicts.slice(0, 3).map((c) => <li key={c.id}>{c.title} {formatTime(c.start)}–{formatTime(c.end)}</li>)}
                </ul>
                <label className="mt-2 flex items-center gap-2">
                  <input type="checkbox" className="h-5 w-5" checked={confirmConflict} onChange={(e) => setConfirmConflict(e.target.checked)} />
                  Přesto přesunout
                </label>
              </div>
            )}
            {planCount > 0 && <p className="text-sm text-muted-foreground">Připojený plán hodiny se přesune s hodinou.</p>}
          </div>
        )}

        {mode === "cancel" && planCount > 0 && (
          <div className="grid gap-2">
            <Label>Připojený plán hodiny</Label>
            <RadioGroup value={planAction} onValueChange={(v) => setPlanAction(v as "unassigned" | "next")}>
              <label className="flex items-center gap-2 min-h-11"><RadioGroupItem value="unassigned" /> Nechat nepřiřazený</label>
              <label className="flex items-center gap-2 min-h-11">
                <RadioGroupItem value="next" disabled={!nextDate} />
                Použít v další hodině{nextDate ? ` (${format(new Date(`${nextDate}T00:00:00`), "d. M. yyyy")})` : " (není k dispozici)"}
              </label>
            </RadioGroup>
          </div>
        )}

        {mode !== "revert" ? (
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="sx-reason">Důvod</Label>
              <Input id="sx-reason" className="h-11" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Např. exkurze, nemoc" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sx-note">Soukromá poznámka (nepovinné)</Label>
              <Textarea id="sx-note" maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
        ) : (
          <p className="text-sm">Hodina se vrátí do původního termínu podle stálého rozvrhu.</p>
        )}

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <DialogFooter className="gap-2">
          <Button variant="outline" className="h-11" onClick={onClose} disabled={saving}>Zpět</Button>
          <Button className="h-11" onClick={submit} disabled={saving} variant={mode === "cancel" ? "destructive" : "default"}>
            {saving ? "Ukládám…" : mode === "move" ? "Přesunout" : mode === "cancel" ? "Zrušit hodinu" : "Vrátit zpět"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

