import { useEffect, useState } from "react";
import { addDays, endOfDay, format, startOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRightLeft, Ban, Undo2 } from "lucide-react";
import type { CalendarEvent } from "@/lib/calendar-utils";
import { resolvePragueTime } from "@/lib/schedule-exceptions";
import { hydrateScheduleFromRemote } from "@/lib/teacher-schedule-store";
import { projectScheduleChanges, readScheduleChanges, readPlanOccurrenceLinks, projectPlanInput } from "@/lib/schedule-exception-store";

interface Props { event: CalendarEvent; onSaved: () => void }

export default function ScheduleExceptionControls({ event, onSaved }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<"moved" | "cancelled" | null>(null);
  const [date, setDate] = useState(format(event.start, "yyyy-MM-dd"));
  const [start, setStart] = useState(format(event.start, "HH:mm"));
  const [end, setEnd] = useState(format(event.end, "HH:mm"));
  const [reason, setReason] = useState(event.publicReason ?? "");
  const [note, setNote] = useState("");
  const [share, setShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [plans, setPlans] = useState<{ id: string; title: string; selected: boolean }[]>([]);
  const [planAction, setPlanAction] = useState("unassigned");
  const [nextDate, setNextDate] = useState("");
  const [nextDates, setNextDates] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [warning, setWarning] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [revision, setRevision] = useState(event.exceptionRevision ?? 0);
  const source = event.source;

  useEffect(() => {
    if (!source || !user || source.ownerId !== user.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: previous, error: previousError } = await supabase.from("schedule_exceptions").select("*")
          .eq("owner_id", user.id).eq("source_kind", source.kind).eq("source_id", source.slotId).eq("original_date", source.originalDate).maybeSingle();
        if (previousError) throw previousError;
        if (!cancelled) setRevision(previous?.revision ?? 0);
        if (previous) {
          const { data } = await supabase.from("schedule_exception_notes").select("note").eq("exception_id", previous.id).maybeSingle();
          if (!cancelled) setNote(data?.note ?? "");
        }
        const { data, error } = await supabase.from("lesson_plans").select("id,title,subject,input_data,class_id,group_id").eq("teacher_id", user.id);
        if (error) throw error;
        const originStart = format(event.originalStart ?? event.start, "HH:mm");
        const matches = (data ?? []).filter((plan) => {
          const input = plan.input_data as Record<string, any>;
          const anchors = [...(input.linkedSlots ?? []), { date: input.linkedDate, time: input.linkedTime,
            subject: plan.subject, classId: plan.class_id, groupId: plan.group_id }];
          return anchors.some((anchor) => anchor.date === source.originalDate && anchor.time?.split("-")[0] === originStart &&
            (anchor.classId ?? plan.class_id ?? undefined) === event.classId && (anchor.groupId ?? plan.group_id ?? undefined) === event.groupId &&
            (anchor.subject ?? plan.subject).trim().toLowerCase() === (event.subject ?? "").trim().toLowerCase());
        });
        // Ambiguous legacy anchors require explicit selection; never auto-pick.
        if (!cancelled) { setPlans(matches.map((plan) => ({ id: plan.id, title: plan.title, selected: false }))); setLoaded(true); }
      } catch {
        if (!cancelled) toast({ title: "Podklady změny se nepodařilo načíst", description: "Zavřete detail a zkuste jej otevřít znovu.", variant: "destructive" });
      }
    })();
    return () => { cancelled = true; };
  }, [event, user, source, toast]);

  if (!source || !user || source.ownerId !== user.id) return null;

  async function loadNextDates() {
    if (!source || !user) return;
    setBusy(true);
    try {
      const from = startOfDay(new Date(`${source.originalDate}T12:00:00`));
      const to = endOfDay(addDays(from, 56));
      const [slots, changes, personal] = await Promise.all([
        supabase.from("class_schedule_slots").select("*,classes(name),subjects(name,color,abbreviation),subject_groups(name)"),
        readScheduleChanges(from, to), hydrateScheduleFromRemote(user.id),
      ]);
      if (slots.error) throw slots.error;
      const effective = projectScheduleChanges(slots.data as any ?? [], from, to, changes, { data: personal, ownerId: user.id });
      const dates = effective.filter((entry) => entry.isTeachingOccurrence !== false && !entry.scheduleStatus &&
        entry.source?.kind === source.kind && entry.source.slotId === source.slotId && entry.source.originalDate > source.originalDate)
        .map((entry) => entry.source?.originalDate).filter((value): value is string => !!value);
      const planRows = await supabase.from("lesson_plans").select("id,input_data").eq("teacher_id", user.id);
      if (planRows.error) throw planRows.error;
      const links = await readPlanOccurrenceLinks((planRows.data ?? []).map((plan) => plan.id));
      const occupied = new Set((planRows.data ?? []).flatMap((plan) => {
        const input = projectPlanInput(plan.input_data as any, links.filter((link) => link.plan_id === plan.id));
        return [...(input.linkedSlots ?? []), { date: input.linkedDate }].map((anchor: any) => anchor.date);
      }));
      setNextDates([...new Set(dates)].filter((value) => !occupied.has(value)));
      setPlanAction("next");
    } catch (error) {
      toast({ title: "Další hodiny se nepodařilo načíst", description: error instanceof Error ? error.message : "Zkuste to znovu.", variant: "destructive" });
    } finally { setBusy(false); }
  }

  async function save(action: "moved" | "cancelled" | "reverted") {
    if (!source || !user) return;
    setBusy(true);
    try {
      if (action === "moved") {
        const a = resolvePragueTime(date, start); const b = resolvePragueTime(date, end);
        if (b <= a) throw new Error("Konec hodiny musí být po začátku.");
        if (!confirmed) {
          const from = startOfDay(a); const to = endOfDay(a);
          const [slots, changes, personal] = await Promise.all([
            supabase.from("class_schedule_slots").select("*,classes(name),subjects(name,color,abbreviation),subject_groups(name)"),
            readScheduleChanges(from, to), hydrateScheduleFromRemote(user.id),
          ]);
          if (slots.error) throw slots.error;
          const overlap = projectScheduleChanges(slots.data as any ?? [], from, to, changes, { data: personal, ownerId: user.id })
            .filter((entry) => entry.isTeachingOccurrence !== false && !(entry.source?.kind === source.kind && entry.source.slotId === source.slotId && entry.source.originalDate === source.originalDate) && a < entry.end && b > entry.start);
          if (overlap.length) { setWarning("Nový čas se překrývá s další dostupnou hodinou. Chcete přesun přesto uložit?"); return; }
        }
      }
      const { error } = await supabase.rpc("save_schedule_exception", {
        _kind: source.kind, _source_id: source.slotId, _original_date: source.originalDate,
        _action: action, _new_date: action === "moved" ? date : null as any,
        _new_start: action === "moved" ? start : null as any, _new_end: action === "moved" ? end : null as any,
        _reason: reason, _note: note, _share: share, _expected_revision: revision, _request_id: crypto.randomUUID(),
        _plan_ids: plans.filter((plan) => plan.selected).map((plan) => plan.id), _plan_action: planAction,
        _next_date: nextDate || null as any,
      });
      if (error) throw new Error(error.message);
      toast({ title: action === "reverted" ? "Původní hodina obnovena" : action === "cancelled" ? "Hodina zrušena" : "Hodina přesunuta" });
      window.dispatchEvent(new Event("schedule-exceptions-changed"));
      onSaved();
    } catch (error) {
      toast({ title: "Změnu se nepodařilo uložit", description: error instanceof Error ? error.message : "Zkuste to znovu.", variant: "destructive" });
    } finally { setBusy(false); }
  }

  return <div className="border-t border-border pt-3 space-y-3">
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={busy || !loaded} onClick={() => setMode("moved")}><ArrowRightLeft className="h-4 w-4 mr-2" />Přesunout</Button>
      <Button variant="outline" disabled={busy || !loaded} onClick={() => setMode("cancelled")}><Ban className="h-4 w-4 mr-2" />Zrušit hodinu</Button>
      {event.exceptionId && <Button variant="outline" disabled={busy || !loaded} onClick={() => save("reverted")}><Undo2 className="h-4 w-4 mr-2" />Vrátit změnu</Button>}
    </div>
    {mode && <div className="space-y-3">
      {mode === "moved" && <>
        <div><Label htmlFor="exception-date">Nové datum</Label><Input id="exception-date" type="date" value={date} onChange={(e) => { setDate(e.target.value); setConfirmed(false); setWarning(""); }} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="exception-start">Začátek</Label><Input id="exception-start" type="time" value={start} onChange={(e) => { setStart(e.target.value); setConfirmed(false); setWarning(""); }} /></div>
          <div><Label htmlFor="exception-end">Konec</Label><Input id="exception-end" type="time" value={end} onChange={(e) => { setEnd(e.target.value); setConfirmed(false); setWarning(""); }} /></div>
        </div>
      </>}
      <div><Label htmlFor="exception-reason">Důvod pro žáky</Label><Input id="exception-reason" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
      <div><Label htmlFor="exception-note">Soukromá poznámka</Label><Textarea id="exception-note" maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} /></div>
      {source.kind === "personal" && event.classId && <div className="flex items-center gap-2"><Checkbox id="exception-share" checked={share} onCheckedChange={(v) => setShare(v === true)} /><Label htmlFor="exception-share">Zobrazit třídě</Label></div>}
      {plans.length > 0 && <div className="space-y-2">
        <Label>Připojené plány</Label>
        {plans.map((plan) => <div className="flex items-center gap-2" key={plan.id}><Checkbox id={`plan-${plan.id}`} checked={plan.selected} onCheckedChange={(v) => setPlans((current) => current.map((p) => p.id === plan.id ? { ...p, selected: v === true } : p))} /><Label htmlFor={`plan-${plan.id}`}>{plan.title}</Label></div>)}
        {mode === "cancelled" && <><Select value={planAction} onValueChange={(value) => value === "next" ? void loadNextDates() : setPlanAction(value)}><SelectTrigger aria-label="Plán po zrušení"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unassigned">Nepřiřazený</SelectItem><SelectItem value="next">Použít v další hodině</SelectItem></SelectContent></Select>
          {planAction === "next" && <Select value={nextDate} onValueChange={setNextDate}><SelectTrigger aria-label="Další hodina"><SelectValue placeholder={nextDates.length ? "Vyberte další hodinu" : "Žádná volná další hodina"} /></SelectTrigger><SelectContent>{nextDates.map((value) => <SelectItem key={value} value={value}>{format(new Date(`${value}T12:00:00`), "d. M. yyyy")}</SelectItem>)}</SelectContent></Select>}
        </>}
      </div>}
      {warning && <div role="alert" className="text-sm text-destructive space-y-2"><p>{warning}</p><div className="flex gap-2 items-center"><Checkbox id="exception-conflict" checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} /><Label htmlFor="exception-conflict">Přesunout i přes překryv</Label></div></div>}
      <div className="flex gap-2"><Button disabled={busy || (warning !== "" && !confirmed) || (mode === "cancelled" && planAction === "next" && !nextDate)} onClick={() => save(mode)}>{busy ? "Ukládání…" : "Uložit změnu"}</Button><Button variant="ghost" onClick={() => setMode(null)} disabled={busy}>Zpět</Button></div>
    </div>}
  </div>;
}