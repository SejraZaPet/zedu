import { useCallback, useEffect, useMemo, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useAuth } from "@/contexts/AuthContext";
import { useMySchool } from "@/hooks/useMySchool";
import { useSchoolResources } from "@/hooks/useSchoolResources";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarDays, ChevronLeft, ChevronRight, DoorOpen, Package, Search, Trash2, Undo2, AlertTriangle } from "lucide-react";
import {
  CONDITION_LABELS,
  deleteReservation,
  deleteSeries,
  fetchReservations,
  freeQuantity,
  hhmm,
  markReturned,
  resourcePlaceLabel,
  reserverLabel,
  withBuffer,
  type ResourceReservation,
  type SchoolResource,
} from "@/lib/school-resources";

const ALL = "__all__";
const DAYS = ["Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek"];
const HOURS = [
  "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00",
];

const iso = (d: Date) => {
  const t = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return t.toISOString().slice(0, 10);
};

/** Pondělí týdne, ve kterém leží datum. */
const mondayOf = (d: Date) => {
  const out = new Date(d);
  const dow = out.getDay() || 7;
  out.setDate(out.getDate() - (dow - 1));
  out.setHours(0, 0, 0, 0);
  return out;
};

const addDays = (d: Date, n: number) => {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
};

const fmtDay = (d: Date) => `${d.getDate()}. ${d.getMonth() + 1}.`;

interface ScheduleSlotLite {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject_label: string | null;
  classes?: { name: string | null } | null;
}

export default function TeacherReservations() {
  const { user, role, realRole } = useAuth();
  const isManager = realRole === "admin" || role === "admin" || role === "school_admin";
  const { schoolId, loading: schoolLoading } = useMySchool();
  const { resources, loading: resLoading } = useSchoolResources(schoolId);

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>(ALL);
  const [buildingFilter, setBuildingFilter] = useState<string>(ALL);
  const [floorFilter, setFloorFilter] = useState<string>(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()));
  const [reservations, setReservations] = useState<ResourceReservation[]>([]);
  const [loadingRes, setLoadingRes] = useState(false);

  const [mySlots, setMySlots] = useState<ScheduleSlotLite[]>([]);

  // dialog
  const [open, setOpen] = useState(false);
  const [fDate, setFDate] = useState("");
  const [fFrom, setFFrom] = useState("08:00");
  const [fTo, setFTo] = useState("08:45");
  const [fQty, setFQty] = useState("1");
  const [fNote, setFNote] = useState("");
  const [fSlot, setFSlot] = useState<string>(ALL);
  const [saving, setSaving] = useState(false);
  const [pendingCancel, setPendingCancel] = useState<ResourceReservation | null>(null);

  const selected = useMemo(
    () => resources.find((r) => r.id === selectedId) ?? null,
    [resources, selectedId],
  );

  const buildings = useMemo(
    () => Array.from(new Set(resources.map((r) => r.building).filter(Boolean) as string[])).sort(),
    [resources],
  );
  const floors = useMemo(
    () => Array.from(new Set(resources.map((r) => r.floor).filter(Boolean) as string[])).sort(),
    [resources],
  );

  const visible = useMemo(
    () =>
      resources.filter(
        (r) =>
          r.is_active &&
          (typeFilter === ALL || r.type === typeFilter) &&
          (buildingFilter === ALL || r.building === buildingFilter) &&
          (floorFilter === ALL || r.floor === floorFilter) &&
          (!query.trim() || r.name.toLowerCase().includes(query.trim().toLowerCase())),
      ),
    [resources, typeFilter, buildingFilter, floorFilter, query],
  );

  useEffect(() => {
    if (!selectedId && visible.length > 0) setSelectedId(visible[0].id);
  }, [visible, selectedId]);

  const weekDays = useMemo(() => DAYS.map((_, i) => addDays(weekStart, i)), [weekStart]);

  const loadReservations = useCallback(async () => {
    if (!selectedId) {
      setReservations([]);
      return;
    }
    setLoadingRes(true);
    try {
      setReservations(
        await fetchReservations(selectedId, iso(weekDays[0]), iso(weekDays[weekDays.length - 1])),
      );
    } catch (e: any) {
      toast({ title: "Chyba", description: e.message, variant: "destructive" });
    } finally {
      setLoadingRes(false);
    }
  }, [selectedId, weekDays]);

  useEffect(() => {
    void loadReservations();
  }, [loadReservations]);

  // vlastní hodiny z rozvrhu (pro provázání rezervace s hodinou)
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("class_schedule_slots" as any)
        .select("id, day_of_week, start_time, end_time, subject_label, classes:class_id(name)")
        .eq("created_by", user.id)
        .order("day_of_week", { ascending: true });
      setMySlots((data ?? []) as unknown as ScheduleSlotLite[]);
    })();
  }, [user]);

  const dayReservations = (d: Date) =>
    reservations.filter((r) => r.date === iso(d)).sort((a, b) => a.time_from.localeCompare(b.time_from));

  const openDialog = (d: Date, hour?: string) => {
    setFDate(iso(d));
    if (hour) {
      setFFrom(hour);
      const [h] = hour.split(":");
      setFTo(`${String(Number(h)).padStart(2, "0")}:45`);
    }
    setFQty("1");
    setFNote("");
    setFSlot(ALL);
    setOpen(true);
  };

  const applySlot = (slotId: string) => {
    setFSlot(slotId);
    const slot = mySlots.find((s) => s.id === slotId);
    if (!slot) return;
    setFFrom(hhmm(slot.start_time));
    setFTo(hhmm(slot.end_time));
    // datum posuň na odpovídající den v zobrazeném týdnu
    const idx = Math.min(Math.max(slot.day_of_week - 1, 0), 4);
    setFDate(iso(addDays(weekStart, idx)));
    if (!fNote.trim()) {
      setFNote([slot.subject_label, slot.classes?.name].filter(Boolean).join(" – "));
    }
  };

  const submit = async () => {
    if (!selected || !user) return;
    if (selected.type === "inventory" && selected.condition_status !== "ok") {
      toast({
        title: "Položku nelze rezervovat",
        description: `Stav položky: ${CONDITION_LABELS[selected.condition_status]}.`,
        variant: "destructive",
      });
      return;
    }
    if (!fDate || !fFrom || !fTo) {
      toast({ title: "Doplňte datum a čas.", variant: "destructive" });
      return;
    }
    if (fTo <= fFrom) {
      toast({ title: "Čas „do“ musí být pozdější než „od“.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("resource_reservations" as any).insert({
      resource_id: selected.id,
      reserved_by: user.id,
      date: fDate,
      time_from: fFrom,
      time_to: fTo,
      quantity: selected.type === "inventory" ? Math.max(Number(fQty) || 1, 1) : 1,
      purpose_note: fNote.trim() || null,
      schedule_entry_id: fSlot === ALL ? null : fSlot,
    } as any);
    setSaving(false);
    if (error) {
      toast({ title: "Rezervaci nelze uložit", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Rezervováno" });
    setOpen(false);
    void loadReservations();
  };

  const canManage = (r: ResourceReservation) => r.reserved_by === user?.id || isManager;

  const doCancel = async (r: ResourceReservation, whole: boolean) => {
    try {
      if (whole && r.recurrence_group_id) {
        await deleteSeries(r.recurrence_group_id, r.date);
      } else {
        await deleteReservation(r.id);
      }
      toast({ title: whole ? "Série zrušena" : "Rezervace zrušena" });
      setPendingCancel(null);
      void loadReservations();
    } catch (e: any) {
      toast({ title: "Chyba", description: e.message, variant: "destructive" });
    }
  };

  const doReturn = async (r: ResourceReservation) => {
    try {
      await markReturned(r.id);
      toast({ title: "Označeno jako vráceno" });
      void loadReservations();
    } catch (e: any) {
      toast({ title: "Chyba", description: e.message, variant: "destructive" });
    }
  };

  if (schoolLoading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="container mx-auto max-w-6xl px-4 py-10">
          <p className="text-muted-foreground">Načítání…</p>
        </main>
      </div>
    );
  }

  if (!schoolId) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="container mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="font-heading text-2xl">Rezervace</h1>
          <p className="mt-3 text-muted-foreground">
            Rezervace místností a inventáře jsou dostupné pouze pro učitele zapojené pod licencí
            školy.
          </p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto max-w-6xl px-4 py-8">
        <header className="mb-6">
          <h1 className="font-heading text-2xl">Rezervace místností a inventáře</h1>
          <p className="text-sm text-muted-foreground">
            Vyberte položku vlevo a klikněte do kalendáře na volný čas.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* výběr položky */}
          <Card className="h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Položky</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Hledat…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Vše</SelectItem>
                    <SelectItem value="room">Místnosti</SelectItem>
                    <SelectItem value="inventory">Inventář</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={buildingFilter} onValueChange={setBuildingFilter}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Budova" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Budova</SelectItem>
                    {buildings.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={floorFilter} onValueChange={setFloorFilter}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Patro" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Patro</SelectItem>
                    {floors.map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="max-h-[520px] space-y-1.5 overflow-y-auto">
                {resLoading && <p className="text-sm text-muted-foreground">Načítání…</p>}
                {!resLoading && visible.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Žádné položky. Správce školy je může přidat v sekci Škola.
                  </p>
                )}
                {visible.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className={`w-full rounded-md border p-2.5 text-left transition-colors ${
                      selectedId === r.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {r.photo_url ? (
                        <img src={r.photo_url} alt="" className="h-8 w-8 rounded object-cover" loading="lazy" />
                      ) : r.type === "room" ? (
                        <DoorOpen className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Package className="h-4 w-4 text-muted-foreground" />
                      )}
                      {r.name}
                    </div>
                    <p className="text-xs text-muted-foreground">{resourcePlaceLabel(r) || "—"}</p>
                    {r.type === "inventory" && (
                      <p className="mt-1 text-xs">
                        <Badge variant="secondary">{r.total_quantity} ks celkem</Badge>
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* kalendář */}
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
              <CardTitle className="text-base">
                {selected ? selected.name : "Vyberte položku"}
                {selected?.type === "inventory" && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {CONDITION_LABELS[selected.condition_status]}
                  </span>
                )}
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" onClick={() => setWeekStart(addDays(weekStart, -7))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-[150px] text-center text-sm text-muted-foreground">
                  {fmtDay(weekDays[0])} – {fmtDay(weekDays[4])}
                </span>
                <Button size="icon" variant="ghost" onClick={() => setWeekStart(addDays(weekStart, 7))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => setWeekStart(mondayOf(new Date()))}>
                  <CalendarDays className="mr-1 h-4 w-4" /> Dnes
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {selected && (selected.photo_url || selected.buffer_minutes > 0 || (selected.type === "inventory" && selected.condition_status !== "ok")) && (
                <div className="mb-3 flex items-start gap-3 rounded-md border border-border p-2.5">
                  {selected.photo_url && (
                    <img
                      src={selected.photo_url}
                      alt={selected.name}
                      className="h-16 w-16 rounded object-cover"
                      loading="lazy"
                    />
                  )}
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {resourcePlaceLabel(selected) && <p>{resourcePlaceLabel(selected)}</p>}
                    {selected.buffer_minutes > 0 && (
                      <p>Mezi rezervacemi je ochranná pauza {selected.buffer_minutes} min.</p>
                    )}
                    {selected.type === "inventory" && selected.condition_status !== "ok" && (
                      <p className="flex items-center gap-1 text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {CONDITION_LABELS[selected.condition_status]} – položku nelze rezervovat.
                      </p>
                    )}
                  </div>
                </div>
              )}
              {!selected ? (
                <p className="text-sm text-muted-foreground">Nejprve vyberte položku vlevo.</p>
              ) : (
                <div className="overflow-x-auto">
                  <div className="grid min-w-[720px] grid-cols-5 gap-2">
                    {weekDays.map((d, i) => {
                      const items = dayReservations(d);
                      return (
                        <div key={i} className="rounded-md border border-border">
                          <div className="border-b border-border bg-muted/40 px-2 py-1.5 text-xs font-medium">
                            {DAYS[i]} {fmtDay(d)}
                            {selected.type === "inventory" && (
                              <span className="ml-1 text-muted-foreground">
                                ({freeQuantity(selected, items, "07:00", "18:00")} z{" "}
                                {selected.total_quantity} volných)
                              </span>
                            )}
                          </div>
                          <div className="space-y-1 p-1.5">
                            {items.map((r) => (
                              <div
                                key={r.id}
                                className="rounded border border-primary/30 bg-primary/5 p-1.5 text-xs"
                              >
                                <div className="font-medium">
                                  {hhmm(r.time_from)}–{hhmm(r.time_to)}
                                  {selected.type === "inventory" && ` · ${r.quantity} ks`}
                                </div>
                                <div className="text-muted-foreground">{reserverLabel(r)}</div>
                                {r.purpose_note && <div className="truncate">{r.purpose_note}</div>}
                                {r.returned_at && (
                                  <Badge variant="secondary" className="mt-1">Vráceno</Badge>
                                )}
                                {canManage(r) && (
                                  <div className="mt-1 flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 px-1.5 text-xs"
                                      onClick={() => setPendingCancel(r)}
                                    >
                                      <Trash2 className="mr-1 h-3 w-3" /> Zrušit
                                    </Button>
                                    {selected.type === "inventory" && !r.returned_at && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 px-1.5 text-xs"
                                        onClick={() => doReturn(r)}
                                      >
                                        <Undo2 className="mr-1 h-3 w-3" /> Vráceno
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                            <div className="grid grid-cols-2 gap-1 pt-1">
                              {HOURS.map((h) => {
                                const busy =
                                  selected.type === "room" &&
                                  items.some(
                                    (r) =>
                                      hhmm(r.time_from) <= h &&
                                      h < withBuffer(hhmm(r.time_to), selected.buffer_minutes),
                                  );
                                return (
                                  <button
                                    key={h}
                                    disabled={busy}
                                    onClick={() => openDialog(d, h)}
                                    className={`rounded px-1 py-0.5 text-[11px] transition-colors ${
                                      busy
                                        ? "cursor-not-allowed bg-muted text-muted-foreground/60"
                                        : "bg-accent/50 hover:bg-accent"
                                    }`}
                                  >
                                    {h}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {loadingRes && (
                    <p className="mt-2 text-xs text-muted-foreground">Načítání rezervací…</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <SiteFooter />

      {/* dialog nové rezervace */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nová rezervace</DialogTitle>
            <DialogDescription>{selected?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Provázat s hodinou z rozvrhu (volitelné)</Label>
              <Select value={fSlot} onValueChange={applySlot}>
                <SelectTrigger><SelectValue placeholder="Bez hodiny" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Bez hodiny</SelectItem>
                  {mySlots.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {DAYS[Math.min(Math.max(s.day_of_week - 1, 0), 4)]} {hhmm(s.start_time)} ·{" "}
                      {[s.subject_label, s.classes?.name].filter(Boolean).join(" – ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-3 sm:col-span-1">
                <Label>Datum</Label>
                <Input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} />
              </div>
              <div>
                <Label>Od</Label>
                <Input type="time" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
              </div>
              <div>
                <Label>Do</Label>
                <Input type="time" value={fTo} onChange={(e) => setFTo(e.target.value)} />
              </div>
            </div>
            {selected?.type === "inventory" && (
              <div>
                <Label>Počet kusů (celkem {selected.total_quantity})</Label>
                <Input
                  type="number"
                  min={1}
                  max={selected.total_quantity}
                  value={fQty}
                  onChange={(e) => setFQty(e.target.value)}
                />
              </div>
            )}
            <div>
              <Label>Účel / poznámka</Label>
              <Textarea rows={2} value={fNote} onChange={(e) => setFNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Zrušit</Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Ukládám…" : "Rezervovat"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* zrušení rezervace / série */}
      <Dialog open={!!pendingCancel} onOpenChange={(o) => !o && setPendingCancel(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Zrušit rezervaci</DialogTitle>
            <DialogDescription>
              {pendingCancel?.recurrence_group_id
                ? "Tato rezervace je součástí pravidelné série."
                : "Opravdu chcete rezervaci zrušit?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="ghost" onClick={() => setPendingCancel(null)}>Ponechat</Button>
            <Button
              variant="destructive"
              onClick={() => pendingCancel && doCancel(pendingCancel, false)}
            >
              {pendingCancel?.recurrence_group_id ? "Zrušit jen tuto hodinu" : "Zrušit rezervaci"}
            </Button>
            {pendingCancel?.recurrence_group_id && (
              <Button
                variant="destructive"
                onClick={() => pendingCancel && doCancel(pendingCancel, true)}
              >
                Zrušit celou sérii
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
