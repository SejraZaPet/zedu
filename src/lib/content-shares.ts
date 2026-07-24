import { supabase } from "@/integrations/supabase/client";

export type ShareTargetKind = "textbook" | "worksheet" | "lesson_plan";

export interface ContentShareRow {
  id: string;
  textbook_id: string | null;
  worksheet_id: string | null;
  lesson_plan_id: string | null;
  shared_by: string;
  shared_with: string | null;
  includes_worksheets: boolean;
  includes_presentations: boolean;
  status: string;
  created_at: string;
}

export interface CreateShareInput {
  kind: ShareTargetKind;
  targetId: string;
  sharedWith: string | null; // null = public in ZEduMarket
  includesWorksheets?: boolean;
  includesPresentations?: boolean;
}

export async function createShare(input: CreateShareInput): Promise<ContentShareRow> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Musíte se přihlásit.");

  const payload: Record<string, any> = {
    shared_by: session.user.id,
    shared_with: input.sharedWith,
    includes_worksheets: input.kind === "textbook" ? !!input.includesWorksheets : false,
    includes_presentations: input.kind === "textbook" ? !!input.includesPresentations : false,
    status: "active",
  };
  if (input.kind === "textbook") payload.textbook_id = input.targetId;
  else if (input.kind === "worksheet") payload.worksheet_id = input.targetId;
  else payload.lesson_plan_id = input.targetId;

  const { data, error } = await supabase
    .from("content_shares" as any)
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as ContentShareRow;
}

export interface SharedWithMeItem extends ContentShareRow {
  kind: ShareTargetKind;
  target_title: string | null;
  target_subject: string | null;
  sharer_name: string | null;
}

export async function listSharedWithMe(userId: string): Promise<SharedWithMeItem[]> {
  const { data, error } = await supabase
    .from("content_shares" as any)
    .select(
      `id, textbook_id, worksheet_id, lesson_plan_id, shared_by, shared_with,
       includes_worksheets, includes_presentations, status, created_at,
       teacher_textbooks:textbook_id ( title, subject ),
       worksheets:worksheet_id ( title, subject ),
       lesson_plans:lesson_plan_id ( title, subject ),
       sharer:profiles!content_shares_shared_by_fkey ( first_name, last_name )`,
    )
    .eq("shared_with", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((r: any) => {
    const kind: ShareTargetKind = r.textbook_id
      ? "textbook"
      : r.worksheet_id
      ? "worksheet"
      : "lesson_plan";
    const target =
      kind === "textbook"
        ? r.teacher_textbooks
        : kind === "worksheet"
        ? r.worksheets
        : r.lesson_plans;
    const sharer = r.sharer;
    return {
      ...r,
      kind,
      target_title: target?.title ?? null,
      target_subject: target?.subject ?? null,
      sharer_name: sharer
        ? [sharer.first_name, sharer.last_name].filter(Boolean).join(" ") || null
        : null,
    } as SharedWithMeItem;
  });
}

export interface PublicShareItem extends ContentShareRow {
  kind: ShareTargetKind;
  target_title: string | null;
  target_subject: string | null;
  target_grade_level: string[] | null;
  sharer_name: string | null;
}

export interface PublicSharesFilters {
  search?: string;
  grades?: string[]; // grade_level values
  subjects?: string[];
  materialMode?: "all" | "with" | "without" | "material_only";
}

export async function listPublicShares(
  filters: PublicSharesFilters = {},
): Promise<PublicShareItem[]> {
  const { data, error } = await supabase
    .from("content_shares" as any)
    .select(
      `id, textbook_id, worksheet_id, lesson_plan_id, shared_by, shared_with,
       includes_worksheets, includes_presentations, status, created_at,
       teacher_textbooks:textbook_id ( title, subject, grade_level ),
       worksheets:worksheet_id ( title, subject, grade_band ),
       lesson_plans:lesson_plan_id ( title, subject, grade_band ),
       sharer:profiles!content_shares_shared_by_fkey ( first_name, last_name )`,
    )
    .is("shared_with", null)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (error) throw error;

  let items: PublicShareItem[] = (data ?? []).map((r: any) => {
    const kind: ShareTargetKind = r.textbook_id
      ? "textbook"
      : r.worksheet_id
      ? "worksheet"
      : "lesson_plan";
    const target =
      kind === "textbook"
        ? r.teacher_textbooks
        : kind === "worksheet"
        ? r.worksheets
        : r.lesson_plans;
    const sharer = r.sharer;
    const grades: string[] | null =
      kind === "textbook"
        ? (target?.grade_level ?? null)
        : target?.grade_band
        ? [target.grade_band]
        : null;
    return {
      ...r,
      kind,
      target_title: target?.title ?? null,
      target_subject: target?.subject ?? null,
      target_grade_level: grades,
      sharer_name: sharer
        ? [sharer.first_name, sharer.last_name].filter(Boolean).join(" ") || null
        : null,
    } as PublicShareItem;
  });

  if (filters.search) {
    const q = filters.search.toLowerCase();
    items = items.filter((i) => (i.target_title ?? "").toLowerCase().includes(q));
  }
  if (filters.subjects && filters.subjects.length > 0) {
    items = items.filter((i) => filters.subjects!.includes(i.target_subject ?? ""));
  }
  if (filters.grades && filters.grades.length > 0) {
    items = items.filter((i) =>
      (i.target_grade_level ?? []).some((g) => filters.grades!.includes(g)),
    );
  }
  switch (filters.materialMode) {
    case "with":
      items = items.filter(
        (i) => i.kind === "textbook" && (i.includes_worksheets || i.includes_presentations),
      );
      break;
    case "without":
      items = items.filter(
        (i) => i.kind === "textbook" && !i.includes_worksheets && !i.includes_presentations,
      );
      break;
    case "material_only":
      items = items.filter((i) => i.kind !== "textbook");
      break;
    default:
      break;
  }
  return items;
}

export async function searchTeachers(query: string) {
  const q = query.trim();
  if (q.length < 2) return [];
  const { data: teacherRoles } = await supabase
    .from("user_roles")
    .select("user_id")
    .in("role", ["teacher", "lektor", "admin"]);
  const ids = (teacherRoles ?? []).map((r) => r.user_id);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email")
    .in("id", ids)
    .or(
      [
        `first_name.ilike.%${q}%`,
        `last_name.ilike.%${q}%`,
        `email.ilike.%${q}%`,
      ].join(","),
    )
    .limit(15);
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id as string,
    label:
      [p.first_name, p.last_name].filter(Boolean).join(" ").trim() ||
      (p.email as string) ||
      p.id,
    email: p.email as string | null,
  }));
}

// ------------------------- Copy helpers -------------------------

async function requireUserId(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Musíte se přihlásit.");
  return session.user.id;
}

export async function copyLessonPlan(sourceId: string): Promise<string> {
  const userId = await requireUserId();
  const { data: src, error } = await supabase
    .from("lesson_plans")
    .select("*")
    .eq("id", sourceId)
    .single();
  if (error || !src) throw error ?? new Error("Plán nenalezen");

  const { data: copy, error: insErr } = await supabase
    .from("lesson_plans")
    .insert({
      teacher_id: userId,
      title: `${src.title} (z ZEduMarket)`,
      subject: src.subject,
      grade_band: src.grade_band,
      slides: src.slides,
      input_data: src.input_data,
      shared_visibility: "private",
      anonymous: false,
    } as any)
    .select("id")
    .single();
  if (insErr) throw insErr;
  return copy!.id as string;
}

export async function copyWorksheet(sourceId: string): Promise<string> {
  const userId = await requireUserId();
  const { data: src, error } = await supabase
    .from("worksheets")
    .select("*")
    .eq("id", sourceId)
    .single();
  if (error || !src) throw error ?? new Error("Pracovní list nenalezen");

  const { data: copy, error: insErr } = await supabase
    .from("worksheets")
    .insert({
      teacher_id: userId,
      title: `${src.title} (z ZEduMarket)`,
      subject: src.subject,
      grade_band: src.grade_band,
      worksheet_mode: src.worksheet_mode,
      spec: src.spec,
      status: "draft",
    } as any)
    .select("id")
    .single();
  if (insErr) throw insErr;
  return copy!.id as string;
}

export async function copyTextbook(
  sourceId: string,
  opts: { includeWorksheets?: boolean; includePresentations?: boolean } = {},
): Promise<string> {
  const userId = await requireUserId();
  const { data: src, error } = await supabase
    .from("teacher_textbooks")
    .select("*")
    .eq("id", sourceId)
    .single();
  if (error || !src) throw error ?? new Error("Učebnice nenalezena");

  // Duplicate textbook itself (fresh access_code)
  const newAccessCode = Math.random().toString(36).slice(2, 10).toUpperCase();
  const { data: copy, error: insErr } = await supabase
    .from("teacher_textbooks")
    .insert({
      teacher_id: userId,
      title: `${src.title} (z ZEduMarket)`,
      description: (src as any).description ?? "",
      subject: src.subject,
      visibility: "private",
      access_code: newAccessCode,
      grade_level: (src as any).grade_level ?? null,
      school_type: (src as any).school_type ?? null,
    } as any)
    .select("id")
    .single();
  if (insErr) throw insErr;
  const newTextbookId = copy!.id as string;

  // Duplicate lessons
  const { data: srcLessons } = await supabase
    .from("teacher_textbook_lessons")
    .select("*")
    .eq("textbook_id", sourceId);

  const lessonIdMap = new Map<string, string>();
  if (srcLessons && srcLessons.length > 0) {
    for (const l of srcLessons) {
      const payload: any = {
        textbook_id: newTextbookId,
        title: l.title,
        blocks: l.blocks ?? [],
        sort_order: l.sort_order ?? 0,
        status: "draft",
        require_activities: l.require_activities ?? false,
        hero_image_url: l.hero_image_url ?? null,
      };
      if (opts.includePresentations && (l as any).presentation_slides) {
        payload.presentation_slides = (l as any).presentation_slides;
      }
      const { data: newLesson, error: lessonErr } = await supabase
        .from("teacher_textbook_lessons")
        .insert(payload)
        .select("id")
        .single();
      if (lessonErr) throw lessonErr;
      lessonIdMap.set(l.id as string, newLesson!.id as string);
    }

    // Duplicate placements pointing to source lessons
    const { data: placements } = await supabase
      .from("lesson_placements")
      .select("*")
      .in("lesson_id", Array.from(lessonIdMap.keys()));
    if (placements && placements.length > 0) {
      const newPlacements = placements
        .map((p: any) => {
          const newLessonId = lessonIdMap.get(p.lesson_id);
          if (!newLessonId) return null;
          return {
            lesson_id: newLessonId,
            subject_slug: p.subject_slug,
            grade_number: p.grade_number,
            topic_id: p.topic_id,
            status: "draft",
          };
        })
        .filter(Boolean);
      if (newPlacements.length > 0) {
        await supabase.from("lesson_placements").insert(newPlacements as any);
      }
    }

    // Duplicate attached worksheets if requested
    if (opts.includeWorksheets) {
      const { data: attached } = await supabase
        .from("worksheet_lessons")
        .select("worksheet_id, lesson_id, lesson_type, worksheets!inner(*)")
        .in("lesson_id", Array.from(lessonIdMap.keys()));
      for (const wl of (attached ?? []) as any[]) {
        const w = wl.worksheets;
        if (!w) continue;
        const { data: newW, error: wErr } = await supabase
          .from("worksheets")
          .insert({
            teacher_id: userId,
            title: w.title,
            subject: w.subject,
            grade_band: w.grade_band,
            worksheet_mode: w.worksheet_mode,
            spec: w.spec,
            status: "draft",
          } as any)
          .select("id")
          .single();
        if (wErr) continue;
        const newLessonId = lessonIdMap.get(wl.lesson_id);
        if (newLessonId && newW) {
          await supabase.from("worksheet_lessons").insert({
            worksheet_id: newW.id,
            lesson_id: newLessonId,
            lesson_type: wl.lesson_type,
            added_by: userId,
          } as any);
        }
      }
    }
  }

  return newTextbookId;
}

export async function acceptShare(
  share: Pick<ContentShareRow, "id" | "textbook_id" | "worksheet_id" | "lesson_plan_id" | "includes_worksheets" | "includes_presentations">,
): Promise<{ kind: ShareTargetKind; newId: string }> {
  if (share.textbook_id) {
    const newId = await copyTextbook(share.textbook_id, {
      includeWorksheets: share.includes_worksheets,
      includePresentations: share.includes_presentations,
    });
    return { kind: "textbook", newId };
  }
  if (share.worksheet_id) {
    const newId = await copyWorksheet(share.worksheet_id);
    return { kind: "worksheet", newId };
  }
  if (share.lesson_plan_id) {
    const newId = await copyLessonPlan(share.lesson_plan_id);
    return { kind: "lesson_plan", newId };
  }
  throw new Error("Sdílení bez cíle");
}

export const GRADE_LEVEL_OPTIONS: { value: string; label: string }[] = [
  { value: "zs1", label: "ZŠ 1. stupeň" },
  { value: "zs2", label: "ZŠ 2. stupeň" },
  { value: "ss", label: "SŠ" },
  { value: "vs", label: "VŠ" },
];
