import { supabase } from "@/integrations/supabase/client";

export interface StudentTextbookLink {
  textbook_id: string;
  textbook_type: "teacher" | "global";
  class_id: string | null;
  subject_id: string | null;
  source: "class" | "class_subject" | "schedule" | "group";
}

const asType = (raw: unknown): "teacher" | "global" =>
  raw === "global" ? "global" : "teacher";

/**
 * Vrátí všechny učebnice, které jsou žákovi zpřístupněné přes jeho třídy –
 * ať už je učitel připojil ke třídě, k předmětu třídy, do rozvrhu,
 * nebo do skupiny předmětu.
 */
export async function fetchStudentClassTextbookLinks(
  userId: string,
  classIds: string[],
): Promise<StudentTextbookLink[]> {
  const links: StudentTextbookLink[] = [];

  const classScoped = classIds.length > 0;

  const [classRes, subjRes, subjTbRes, slotRes, groupRes] = await Promise.all([
    classScoped
      ? supabase
          .from("class_textbooks")
          .select("textbook_id, textbook_type, class_id")
          .in("class_id", classIds)
      : Promise.resolve({ data: [] as any[] }),
    classScoped
      ? supabase
          .from("class_subjects")
          .select("id, class_id, subject_id, textbook_id, textbook_type, archived")
          .in("class_id", classIds)
      : Promise.resolve({ data: [] as any[] }),
    classScoped
      ? supabase
          .from("class_subject_textbooks")
          .select(
            "textbook_id, textbook_type, class_subject_id, class_subjects!inner(class_id, subject_id, archived)",
          )
          .in("class_subjects.class_id", classIds)
      : Promise.resolve({ data: [] as any[] }),
    classScoped
      ? supabase
          .from("class_schedule_slots" as any)
          .select("textbook_id, textbook_type, class_id, subject_id")
          .in("class_id", classIds)
          .not("textbook_id", "is", null)
      : Promise.resolve({ data: [] as any[] }),
    supabase
      .from("subject_group_members")
      .select(
        "group_id, subject_groups!inner(id, subject_id, archived, textbook_id, textbook_type)",
      )
      .eq("student_id", userId),
  ]);

  for (const row of ((classRes as any).data ?? []) as any[]) {
    if (!row.textbook_id) continue;
    links.push({
      textbook_id: row.textbook_id,
      textbook_type: asType(row.textbook_type),
      class_id: row.class_id ?? null,
      subject_id: null,
      source: "class",
    });
  }

  for (const row of ((subjRes as any).data ?? []) as any[]) {
    if (!row.textbook_id || row.archived) continue;
    links.push({
      textbook_id: row.textbook_id,
      textbook_type: asType(row.textbook_type),
      class_id: row.class_id ?? null,
      subject_id: row.subject_id ?? null,
      source: "class_subject",
    });
  }

  for (const row of ((subjTbRes as any).data ?? []) as any[]) {
    const cs = row.class_subjects;
    if (!row.textbook_id || !cs || cs.archived) continue;
    links.push({
      textbook_id: row.textbook_id,
      textbook_type: asType(row.textbook_type),
      class_id: cs.class_id ?? null,
      subject_id: cs.subject_id ?? null,
      source: "class_subject",
    });
  }

  for (const row of ((slotRes as any).data ?? []) as any[]) {
    if (!row.textbook_id) continue;
    links.push({
      textbook_id: row.textbook_id,
      textbook_type: asType(row.textbook_type),
      class_id: row.class_id ?? null,
      subject_id: row.subject_id ?? null,
      source: "schedule",
    });
  }

  for (const row of ((groupRes as any).data ?? []) as any[]) {
    const g = row.subject_groups;
    if (!g?.textbook_id || g.archived) continue;
    links.push({
      textbook_id: g.textbook_id,
      textbook_type: asType(g.textbook_type),
      class_id: null,
      subject_id: g.subject_id ?? null,
      source: "group",
    });
  }

  // Učebnice připojené ke skupině předmětu přes vazební tabulku
  const groupRows = ((groupRes as any).data ?? []) as any[];
  const groupIds = [...new Set(groupRows.map((r) => r.group_id).filter(Boolean))];
  const subjectIdByGroup = new Map<string, string | null>(
    groupRows.map((r) => [r.group_id, r.subject_groups?.subject_id ?? null]),
  );
  if (groupIds.length > 0) {
    const { data: sgt } = await supabase
      .from("subject_group_textbooks")
      .select("textbook_id, textbook_type, subject_group_id")
      .in("subject_group_id", groupIds);
    for (const row of (sgt ?? []) as any[]) {
      if (!row.textbook_id) continue;
      links.push({
        textbook_id: row.textbook_id,
        textbook_type: asType(row.textbook_type),
        class_id: null,
        subject_id: subjectIdByGroup.get(row.subject_group_id) ?? null,
        source: "group",
      });
    }
  }



  // Odstraníme duplicity (stejná učebnice ze stejného zdroje pro stejnou třídu).
  const seen = new Set<string>();
  return links.filter((l) => {
    const key = `${l.textbook_type}-${l.textbook_id}-${l.class_id ?? ""}-${l.subject_id ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
