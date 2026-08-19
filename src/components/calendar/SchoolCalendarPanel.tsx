import { BetaBadge } from "@/components/common/BetaBadge";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { CalendarPlus, MapPin, Pencil, Trash2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolColleagues, colleagueLabel } from "@/hooks/useMySchool";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SchoolEvent {
  id: string;
  school_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  all_day: boolean;
  color: string | null;
  location: string | null;
  created_by: string;
}

interface Props {
  schoolId: string;
  schoolName?: string | null;
}

const toLocalInput = (iso: string) => format(new Date(iso), "yyyy-MM-dd'T'HH:mm");

/** Sdílený kalendář školy – vidí všichni učitelé stejné školy. */
const SchoolCalendarPanel = ({ schoolId, schoolName }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { colleagues } = useSchoolColleagues(schoolId);
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [attendees, setAttendees] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolEvent | null>(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [location, setLocation] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [invited, setInvited] = useState<string[]>([]);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    colleagues.forEach((c) => m.set(c.id, colleagueLabel(c)));
    if (user) m.set(user.id, "Já");
    return m;
  }, [colleagues, user]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("school_calendar_events")
      .select("id, school_id, title, description, start_time, end_time, all_day, color, location, created_by")
      .eq("school_id", schoolId)
      .order("start_time", { ascending: true });
    const rows = (data ?? []) as SchoolEvent[];
    setEvents(rows);
    if (rows.length) {
      const { data: att } = await supabase
        .from("school_calendar_event_attendees")
        .select("event_id, teacher_id")
        .in("event_id", rows.map((r) => r.id));
      const map: Record<string, string[]> = {};
      ((att ?? []) as { event_id: string; teacher_id: string }[]).forEach((a) => {
        map[a.event_id] = [...(map[a.event_id] ?? []), a.teacher_id];
      });
      setAttendees(map);
    } else {
      setAttendees({});
    }
    setLoading(false);
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openNew = () => {
    setEditing(null);
    setTitle("");
    setDescription("");
    const now = new Date();
    now.setMinutes(0, 0, 0);
    setStart(format(now, "yyyy-MM-dd'T'HH:mm"));
    setEnd(format(new Date(now.getTime() + 60 * 60000), "yyyy-MM-dd'T'HH:mm"));
    setLocation("");
    setAllDay(false);
    setInvited([]);
    setDialogOpen(true);
  };

  const openEdit = (e: SchoolEvent) => {
    setEditing(e);
    setTitle(e.title);
    setDescription(e.description ?? "");
    setStart(toLocalInput(e.start_time));
    setEnd(toLocalInput(e.end_time));
    setLocation(e.location ?? "");
    setAllDay(e.all_day);
    setInvited(attendees[e.id] ?? []);
    setDialogOpen(true);
  };

  const save = async () => {
    if (!user) return;
    if (!title.trim() || !start || !end) {
      toast({ title: "Doplňte název a čas", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      school_id: schoolId,
      title: title.trim(),
      description: description.trim() || null,
      start_time: new Date(start).toISOString(),
      end_time: new Date(end).toISOString(),
      all_day: allDay,
      location: location.trim() || null,
      created_by: user.id,
    };

    let eventId = editing?.id ?? null;
    if (editing) {
      const { error } = await supabase
        .from("school_calendar_events")
        .update(payload)
        .eq("id", editing.id);
      if (error) {
        setSaving(false);
        toast({ title: "Uložení se nepodařilo", description: error.message, variant: "destructive" });
        return;
      }
      await supabase.from("school_calendar_event_attendees").delete().eq("event_id", editing.id);
    } else {
      const { data, error } = await supabase
        .from("school_calendar_events")
        .insert(payload)
        .select("id")
        .single();
      if (error || !data) {
        setSaving(false);
        toast({ title: "Uložení se nepodařilo", description: error?.message, variant: "destructive" });
        return;
      }
      eventId = (data as { id: string }).id;
    }

    if (eventId && invited.length) {
      await supabase
        .from("school_calendar_event_attendees")
        .insert(invited.map((teacher_id) => ({ event_id: eventId as string, teacher_id })));
    }

    setSaving(false);
    setDialogOpen(false);
    toast({ title: editing ? "Událost upravena" : "Událost přidána do školního kalendáře" });
    void load();
  };

  const remove = async (e: SchoolEvent) => {
    const { error } = await supabase.from("school_calendar_events").delete().eq("id", e.id);
    if (error) {
      toast({ title: "Smazání se nepodařilo", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Událost smazána" });
    void load();
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-heading text-lg font-semibold">Školní kalendář</h2>
          <p className="text-sm text-muted-foreground">
            Sdílené události {schoolName ? `školy ${schoolName}` : "vaší školy"} – vidí je všichni kolegové.
          </p>
        </div>
        <Button size="sm" onClick={openNew}>
          <CalendarPlus className="mr-2 h-4 w-4" /> Nová školní událost
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Načítání…</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ve školním kalendáři zatím nic není.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {events.map((e) => {
            const mine = e.created_by === user?.id;
            return (
              <li key={e.id} className="flex flex-wrap items-start gap-3 px-3 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{e.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.all_day
                      ? format(new Date(e.start_time), "d. M. yyyy", { locale: cs })
                      : `${format(new Date(e.start_time), "d. M. yyyy HH:mm", { locale: cs })} – ${format(new Date(e.end_time), "HH:mm")}`}
                  </p>
                  {e.location && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {e.location}
                    </p>
                  )}
                  {e.description && <p className="mt-1 text-xs text-muted-foreground">{e.description}</p>}
                  {!!attendees[e.id]?.length && (
                    <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      {attendees[e.id].map((id) => (
                        <Badge key={id} variant="secondary" className="text-[11px]">
                          {nameById.get(id) ?? "Kolega"}
                        </Badge>
                      ))}
                    </p>
                  )}
                </div>
                {mine && (
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" aria-label="Upravit" onClick={() => openEdit(e)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label="Smazat" onClick={() => void remove(e)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Upravit školní událost" : "Nová školní událost"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="sce-title">Název</Label>
              <Input id="sce-title" value={title} onChange={(ev) => setTitle(ev.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="sce-start">Začátek</Label>
                <Input id="sce-start" type="datetime-local" value={start} onChange={(ev) => setStart(ev.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sce-end">Konec</Label>
                <Input id="sce-end" type="datetime-local" value={end} onChange={(ev) => setEnd(ev.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="sce-allday" checked={allDay} onCheckedChange={(v) => setAllDay(!!v)} />
              <Label htmlFor="sce-allday">Celodenní</Label>
            </div>
            <div className="space-y-1">
              <Label htmlFor="sce-loc">Místo</Label>
              <Input id="sce-loc" value={location} onChange={(ev) => setLocation(ev.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sce-desc">Popis</Label>
              <Textarea id="sce-desc" value={description} onChange={(ev) => setDescription(ev.target.value)} rows={3} />
            </div>
            {colleagues.length > 0 && (
              <div className="space-y-1">
                <Label>Pozvat kolegy</Label>
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                  {colleagues.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={invited.includes(c.id)}
                        onCheckedChange={(v) =>
                          setInvited((prev) => (v ? [...prev, c.id] : prev.filter((x) => x !== c.id)))
                        }
                      />
                      {colleagueLabel(c)}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Zrušit</Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Ukládám…" : "Uložit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default SchoolCalendarPanel;
