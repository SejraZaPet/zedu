import { supabase } from "@/integrations/supabase/client";

export interface StudentTextbookLink {
  textbook_id: string;
  textbook_type: "teacher" | "global";
  class_id: string | null;
  subject_id: string | null;
  source: "class" | "class_subject" | "schedule" | "group" | "placement";
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

  // Učebnice odvozené z umístění lekcí cílených na žákovu třídu nebo skupinu.
  // Učitel může lekci publikovat i v učebnici, která není ke třídě/skupině
  // přímo připojená — žák ji přesto musí vidět.
  const targetFilters: string[] = [];
  if (classIds.length > 0) targetFilters.push(`class_id.in.(${classIds.join(",")})`);
  if (groupIds.length > 0) targetFilters.push(`subject_group_id.in.(${groupIds.join(",")})`);

  if (targetFilters.length > 0) {
    const orFilter = targetFilters.join(",");
    const [assignRes, placeRes] = await Promise.all([
      supabase
        .from("lesson_topic_assignments")
        .select("topic_id, class_id, subject_group_id")
        .eq("status", "published")
        .or(orFilter),
      supabase
        .from("lesson_placements")
        .select("lesson_id, class_id, subject_group_id")
        .eq("status", "published")
        .or(orFilter),
    ]);

    const assignRows = ((assignRes as any).data ?? []) as any[];
    const placeRows = ((placeRes as any).data ?? []) as any[];

    // a) globální učebnice — téma → slug předmětu → textbook_subjects.id
    const topicIds = [...new Set(assignRows.map((r) => r.topic_id).filter(Boolean))];
    if (topicIds.length > 0) {
      const { data: topics } = await supabase
        .from("textbook_topics")
        .select("id, subject")
        .in("id", topicIds);
      const slugByTopic = new Map<string, string>(
        ((topics as any[]) ?? []).map((t) => [t.id, t.subject]),
      );
      const slugs = [...new Set([...slugByTopic.values()].filter(Boolean))];
      if (slugs.length > 0) {
        const { data: subjectRows } = await supabase
          .from("textbook_subjects")
          .select("id, slug")
          .in("slug", slugs);
        const idBySlug = new Map<string, string>(
          ((subjectRows as any[]) ?? []).map((s) => [s.slug, s.id]),
        );
        for (const row of assignRows) {
          const slug = slugByTopic.get(row.topic_id);
          const textbookId = slug ? idBySlug.get(slug) : undefined;
          if (!textbookId) continue;
          links.push({
            textbook_id: textbookId,
            textbook_type: "global",
            class_id: row.class_id ?? null,
            subject_id: row.subject_group_id
              ? subjectIdByGroup.get(row.subject_group_id) ?? null
              : null,
            source: "placement",
          });
        }
      }
    }

    // b) učitelské učebnice — umístění lekce → teacher_textbook_lessons.textbook_id
    const lessonIds = [...new Set(placeRows.map((r) => r.lesson_id).filter(Boolean))];
    if (lessonIds.length > 0) {
      const { data: tLessons } = await supabase
        .from("teacher_textbook_lessons")
        .select("id, textbook_id")
        .in("id", lessonIds);
      const tbByLesson = new Map<string, string>(
        ((tLessons as any[]) ?? []).map((l) => [l.id, l.textbook_id]),
      );
      for (const row of placeRows) {
        const textbookId = tbByLesson.get(row.lesson_id);
        if (!textbookId) continue;
        links.push({
          textbook_id: textbookId,
          textbook_type: "teacher",
          class_id: row.class_id ?? null,
          subject_id: row.subject_group_id
            ? subjectIdByGroup.get(row.subject_group_id) ?? null
            : null,
          source: "placement",
        });
      }
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
