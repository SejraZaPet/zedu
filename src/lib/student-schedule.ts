import { supabase } from "@/integrations/supabase/client";

export interface StudentClassSlot {
  id: string;
  class_id: string | null;
  group_id?: string | null;
  subject_id?: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  week_parity: "every" | "odd" | "even";
  valid_from?: string | null;
  valid_to?: string | null;
  subject_label: string | null;
  abbreviation: string | null;
  color: string | null;
  room: string | null;
  textbook_id: string | null;
  created_by?: string | null;
  classes?: { name: string } | null;
  subject_groups?: { name?: string | null } | null;
  subjects?: {
    name?: string | null;
    color?: string | null;
    abbreviation?: string | null;
    archived?: boolean | null;
  } | null;
}

export interface StudentScheduleData {
  slots: StudentClassSlot[];
  classIds: string[];
  groupIds: string[];
  classNames: string[];
}

const minutes = (value: string): number => {
  const [hours, mins] = value.split(":").map((part) => parseInt(part, 10) || 0);
  return hours * 60 + mins;
};

/**
 * Jediná cesta pro žákovy třídní/skupinové sloty. Čte jen vlastní členství;
 * RLS stále rozhoduje o vrácených řádcích a žádná data se nemění.
 */
export async function fetchStudentScheduleData(userId: string): Promise<StudentScheduleData> {
  const [{ data: members }, { data: groupMembers }] = await Promise.all([
    supabase.from("class_members").select("class_id").eq("user_id", userId),
    supabase.from("subject_group_members").select("group_id").eq("student_id", userId),
  ]);
  const classIds = [...new Set(((members ?? []) as any[]).map((row) => row.class_id).filter(Boolean))];
  const groupIds = [...new Set(((groupMembers ?? []) as any[]).map((row) => row.group_id).filter(Boolean))];
  if (classIds.length === 0 && groupIds.length === 0) {
    return { slots: [], classIds, groupIds, classNames: [] };
  }

  const select = "*, classes(name), subjects(name, color, abbreviation), subject_groups(name)";
  const [classSlotsRes, groupSlotsRes] = await Promise.all([
    classIds.length
      ? supabase.from("class_schedule_slots" as any).select(select).in("class_id", classIds)
      : Promise.resolve({ data: [] as any[] }),
    groupIds.length
      ? supabase.from("class_schedule_slots" as any).select(select).in("group_id", groupIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const merged = [
    ...(((classSlotsRes as any).data as any[]) ?? []),
    ...(((groupSlotsRes as any).data as any[]) ?? []),
  ];
  const byId = new Map<string, StudentClassSlot>();
  for (const row of merged) byId.set(row.id, row as StudentClassSlot);
  const slots = [...byId.values()].sort(
    (a, b) => a.day_of_week - b.day_of_week || minutes(a.start_time) - minutes(b.start_time),
  );
  const classNames = [...new Set(
    slots.map((slot) => slot.classes?.name ?? slot.subject_groups?.name).filter(Boolean) as string[],
  )];
  return { slots, classIds, groupIds, classNames };
}
