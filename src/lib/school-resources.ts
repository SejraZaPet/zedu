import { supabase } from "@/integrations/supabase/client";

export type ResourceType = "room" | "inventory";
export type ConditionStatus = "ok" | "repair" | "retired";
export type ReservationStatus = "confirmed" | "pending" | "rejected";

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  confirmed: "Potvrzeno",
  pending: "Čeká na schválení",
  rejected: "Zamítnuto",
};

export interface SchoolResource {
  id: string;
  school_id: string;
  type: ResourceType;
  name: string;
  description: string | null;
  building: string | null;
  floor: string | null;
  room_number: string | null;
  total_quantity: number;
  location_note: string | null;
  photo_url: string | null;
  condition_status: ConditionStatus;
  buffer_minutes: number;
  requires_approval: boolean;
  is_active: boolean;
}

export interface ResourceReservation {
  id: string;
  resource_id: string;
  reserved_by: string;
  date: string;
  time_from: string;
  time_to: string;
  quantity: number;
  purpose_note: string | null;
  schedule_entry_id: string | null;
  recurrence_group_id: string | null;
  returned_at: string | null;
  status: ReservationStatus;
  /** Doplněno joinem na profil vlastníka. */
  profiles?: { first_name: string | null; last_name: string | null; email?: string | null } | null;
}

export const CONDITION_LABELS: Record<ConditionStatus, string> = {
  ok: "V pořádku",
  repair: "V opravě",
  retired: "Vyřazeno",
};

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  room: "Místnost",
  inventory: "Inventář",
};

/** "08:00:00" → "08:00" */
export const hhmm = (t: string | null | undefined) => (t ?? "").slice(0, 5);

export const reserverLabel = (r: ResourceReservation) =>
  [r.profiles?.first_name, r.profiles?.last_name].filter(Boolean).join(" ").trim() ||
  "Neznámý učitel";

/**
 * Bezpečný adresář školy (jen jméno/příjmení/titul) — bez kontaktních údajů.
 * Profily kolegů nejsou čitelné přímo, proto se jména dotahují přes RPC.
 */
export async function fetchSchoolDirectory() {
  const { data, error } = await supabase.rpc("school_directory");
  if (error) return new Map<string, { first_name: string | null; last_name: string | null }>();
  return new Map(
    (data ?? []).map((p: any) => [p.id as string, { first_name: p.first_name, last_name: p.last_name }]),
  );
}

async function withReserverNames(rows: ResourceReservation[]): Promise<ResourceReservation[]> {
  if (rows.length === 0) return rows;
  const dir = await fetchSchoolDirectory();
  return rows.map((r) => ({ ...r, profiles: dir.get(r.reserved_by) ?? null }));
}

export const resourcePlaceLabel = (r: SchoolResource) => {
  if (r.type === "room") {
    return [r.building && `budova ${r.building}`, r.floor && `${r.floor}. patro`, r.room_number]
      .filter(Boolean)
      .join(" · ");
  }
  return r.location_note ?? "";
};

const RESOURCE_COLUMNS =
  "id, school_id, type, name, description, building, floor, room_number, total_quantity, location_note, photo_url, condition_status, buffer_minutes, requires_approval, is_active";

export async function fetchResources(schoolId: string): Promise<SchoolResource[]> {
  const { data, error } = await supabase
    .from("school_resources" as any)
    .select(RESOURCE_COLUMNS)
    .eq("school_id", schoolId)
    .order("type", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as SchoolResource[];
}

const RESERVATION_COLUMNS =
  "id, resource_id, reserved_by, date, time_from, time_to, quantity, purpose_note, schedule_entry_id, recurrence_group_id, returned_at, status";

/** Rezervace jednoho zdroje v intervalu dat (včetně). */
export async function fetchReservations(
  resourceId: string,
  fromDate: string,
  toDate: string,
): Promise<ResourceReservation[]> {
  const { data, error } = await supabase
    .from("resource_reservations" as any)
    .select(RESERVATION_COLUMNS)
    .eq("resource_id", resourceId)
    .gte("date", fromDate)
    .lte("date", toDate)
    .order("date", { ascending: true })
    .order("time_from", { ascending: true });
  if (error) throw error;
  return withReserverNames((data ?? []) as unknown as ResourceReservation[]);
}

/** Všechny rezervace školy pro daný den (přehled „co je teď volné“). */
export async function fetchDayReservations(
  resourceIds: string[],
  date: string,
): Promise<ResourceReservation[]> {
  if (resourceIds.length === 0) return [];
  const { data, error } = await supabase
    .from("resource_reservations" as any)
    .select(RESERVATION_COLUMNS)
    .in("resource_id", resourceIds)
    .eq("date", date)
    .order("time_from", { ascending: true });
  if (error) throw error;
  return withReserverNames((data ?? []) as unknown as ResourceReservation[]);
}

export const overlaps = (aFrom: string, aTo: string, bFrom: string, bTo: string) =>
  aFrom < bTo && aTo > bFrom;

/** Kolik kusů inventáře je volných v daném čase. */
export function freeQuantity(
  resource: SchoolResource,
  reservations: ResourceReservation[],
  timeFrom: string,
  timeTo: string,
) {
  const used = reservations
    .filter((r) => !r.returned_at && r.status !== "rejected" && overlaps(timeFrom, timeTo, hhmm(r.time_from), hhmm(r.time_to)))
    .reduce((sum, r) => sum + r.quantity, 0);
  return Math.max(resource.total_quantity - used, 0);
}

export interface NewReservation {
  resource_id: string;
  reserved_by: string;
  date: string;
  time_from: string;
  time_to: string;
  quantity?: number;
  purpose_note?: string | null;
  schedule_entry_id?: string | null;
  recurrence_group_id?: string | null;
}

export async function createReservation(input: NewReservation) {
  const { error } = await supabase.from("resource_reservations" as any).insert({
    quantity: 1,
    ...input,
  } as any);
  if (error) throw error;
}

export async function deleteReservation(id: string) {
  const { error } = await supabase.from("resource_reservations" as any).delete().eq("id", id);
  if (error) throw error;
}

export async function deleteSeries(recurrenceGroupId: string, fromDate?: string) {
  let q = supabase
    .from("resource_reservations" as any)
    .delete()
    .eq("recurrence_group_id", recurrenceGroupId);
  if (fromDate) q = q.gte("date", fromDate);
  const { error } = await q;
  if (error) throw error;
}

/** Schválení / zamítnutí čekající rezervace (admin školy). */
export async function setReservationStatus(id: string, status: ReservationStatus) {
  const { error } = await supabase
    .from("resource_reservations" as any)
    .update({ status } as any)
    .eq("id", id);
  if (error) throw error;
}

/** Čekající žádosti o rezervaci napříč zadanými položkami. */
export async function fetchPendingReservations(
  resourceIds: string[],
): Promise<ResourceReservation[]> {
  if (resourceIds.length === 0) return [];
  const { data, error } = await supabase
    .from("resource_reservations" as any)
    .select(RESERVATION_COLUMNS)
    .in("resource_id", resourceIds)
    .eq("status", "pending")
    .order("date", { ascending: true })
    .order("time_from", { ascending: true });
  if (error) throw error;
  return withReserverNames((data ?? []) as unknown as ResourceReservation[]);
}

export async function markReturned(id: string) {
  const { error } = await supabase
    .from("resource_reservations" as any)
    .update({ returned_at: new Date().toISOString() } as any)
    .eq("id", id);
  if (error) throw error;
}

const iso = (d: Date) => {
  const t = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return t.toISOString().slice(0, 10);
};

/** ISO číslo týdne – pro paritu (sudý/lichý týden). */
function isoWeek(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Konec školního roku (30. 6.) vzhledem k datu. */
export function schoolYearEnd(from = new Date()) {
  const year = from.getMonth() >= 7 ? from.getFullYear() + 1 : from.getFullYear();
  return iso(new Date(year, 5, 30));
}

export interface SeriesInput {
  resourceId: string;
  reservedBy: string;
  /** 1 = pondělí … 7 = nedělě (jako class_schedule_slots.day_of_week) */
  dayOfWeek: number;
  timeFrom: string;
  timeTo: string;
  validFrom?: string | null;
  validTo?: string | null;
  weekParity?: "every" | "odd" | "even";
  purposeNote?: string | null;
  scheduleEntryId?: string | null;
}

export interface SeriesResult {
  recurrenceGroupId: string;
  created: number;
  conflicts: { date: string; message: string }[];
}

/** Vygeneruje opakované rezervace pro pravidelnou hodinu do konce školního roku. */
export async function createRecurringReservations(input: SeriesInput): Promise<SeriesResult> {
  const recurrenceGroupId = crypto.randomUUID();
  const start = input.validFrom ? new Date(input.validFrom + "T00:00:00") : new Date();
  const endStr = input.validTo || schoolYearEnd(start);
  const end = new Date(endStr + "T00:00:00");

  const dates: string[] = [];
  const cursor = new Date(start);
  // posun na první výskyt daného dne v týdnu
  const targetDow = input.dayOfWeek % 7; // JS: 0=nedělě
  while (cursor.getDay() !== targetDow) cursor.setDate(cursor.getDate() + 1);
  while (cursor <= end && dates.length < 60) {
    const parity = input.weekParity ?? "every";
    const week = isoWeek(cursor);
    const ok = parity === "every" || (parity === "odd" ? week % 2 === 1 : week % 2 === 0);
    if (ok) dates.push(iso(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }

  const conflicts: SeriesResult["conflicts"] = [];
  let created = 0;
  for (const date of dates) {
    try {
      await createReservation({
        resource_id: input.resourceId,
        reserved_by: input.reservedBy,
        date,
        time_from: input.timeFrom,
        time_to: input.timeTo,
        quantity: 1,
        purpose_note: input.purposeNote ?? null,
        schedule_entry_id: input.scheduleEntryId ?? null,
        recurrence_group_id: recurrenceGroupId,
      });
      created++;
    } catch (e: any) {
      conflicts.push({ date, message: e?.message ?? "Kolize rezervace" });
    }
  }
  return { recurrenceGroupId, created, conflicts };
}

/**
 * Atomicky přegeneruje sérii rezervací místnosti pro hodinu rozvrhu:
 * na serveru se nejdřív zruší budoucí rezervace staré série téže hodiny,
 * pak se zkontrolují kolize (bez vlastní série) a teprve pak vznikne nová série.
 * Při skutečné kolizi se celá operace vrátí zpět a vyhodí chybu.
 */
export async function reserveRoomSeries(input: SeriesInput): Promise<{
  recurrenceGroupId: string;
  created: number;
  requiresApproval: boolean;
}> {
  const { data, error } = await supabase.rpc("reserve_room_series" as any, {
    p_resource_id: input.resourceId,
    p_schedule_entry_id: input.scheduleEntryId ?? null,
    p_day_of_week: input.dayOfWeek,
    p_time_from: input.timeFrom,
    p_time_to: input.timeTo,
    p_valid_from: input.validFrom ?? null,
    p_valid_to: input.validTo ?? null,
    p_week_parity: input.weekParity ?? "every",
    p_purpose_note: input.purposeNote ?? null,
  } as any);
  if (error) throw error;
  const res = (data ?? {}) as any;
  return {
    recurrenceGroupId: res.recurrence_group_id,
    created: res.created ?? 0,
    requiresApproval: !!res.requires_approval,
  };
}

/** Zruší budoucí rezervace navázané na hodinu rozvrhu (např. při odebrání místnosti). */
export async function deleteFutureReservationsForEntry(scheduleEntryId: string) {
  const today = iso(new Date());
  const { error } = await supabase
    .from("resource_reservations" as any)
    .delete()
    .eq("schedule_entry_id", scheduleEntryId)
    .gte("date", today);
  if (error) throw error;
}

/** Nahraje fotku položky do bucketu `school-logos` (cesta začíná ID školy kvůli RLS). */
export async function uploadResourcePhoto(schoolId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${schoolId}/resources/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("school-logos").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from("school-logos").getPublicUrl(path).data.publicUrl;
}

export interface ResourceNowStatus {
  resource: SchoolResource;
  /** Aktuálně běžící rezervace. */
  active: ResourceReservation[];
  /** U inventáře počet volných kusů, u místností 1/0. */
  free: number;
}

/** Přehled „co je teď volné“ napříč položkami školy. */
export async function fetchNowStatus(resources: SchoolResource[]): Promise<ResourceNowStatus[]> {
  const today = iso(new Date());
  const now = new Date().toTimeString().slice(0, 5);
  const all = await fetchDayReservations(
    resources.map((r) => r.id),
    today,
  );
  return resources.map((resource) => {
    const mine = all.filter((r) => r.resource_id === resource.id);
    const active = mine.filter(
      (r) => !r.returned_at && hhmm(r.time_from) <= now && now < hhmm(r.time_to),
    );
    const free =
      resource.type === "inventory"
        ? freeQuantity(resource, mine, now, now === "23:59" ? "23:59" : addMinute(now))
        : active.length > 0
          ? 0
          : 1;
    return { resource, active, free };
  });
}

const addMinute = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  const total = Math.min(h * 60 + m + 1, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

/** Kolizní hlídání v UI: k času „do“ se u místností přičítá ochranná pauza. */
export const withBuffer = (timeTo: string, bufferMinutes: number) => {
  if (!bufferMinutes) return timeTo;
  const [h, m] = timeTo.split(":").map(Number);
  const total = Math.min(h * 60 + m + bufferMinutes, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};
