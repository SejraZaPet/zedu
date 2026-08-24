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
  sharedWith: string | null; // null = public in BezliMarket
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

  // Direct share → notify recipient (public shares get no notification).
  if (input.sharedWith) {
    try {
      const [{ data: sender }, { data: target }] = await Promise.all([
        supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", session.user.id)
          .maybeSingle(),
        input.kind === "textbook"
          ? supabase.from("teacher_textbooks").select("title").eq("id", input.targetId).maybeSingle()
          : input.kind === "worksheet"
          ? supabase.from("worksheets").select("title").eq("id", input.targetId).maybeSingle()
          : supabase.from("lesson_plans").select("title").eq("id", input.targetId).maybeSingle(),
      ]);
      const senderName =
        [sender?.first_name, sender?.last_name].filter(Boolean).join(" ").trim() || "Kolega";
      const kindLabel =
        input.kind === "textbook"
          ? "učebnici"
          : input.kind === "worksheet"
          ? "pracovní list"
          : "prezentaci";
      const title = (target as any)?.title ?? "materiál";
      await supabase.from("notifications").insert({
        recipient_id: input.sharedWith,
        sender_id: session.user.id,
        type: "content_share",
        title: "Nový sdílený materiál",
        body: `${senderName} s vámi sdílel/a ${kindLabel} „${title}“`,
        link: "/ucitel/sdileno-se-mnou",
        status: "sent",
        sent_at: new Date().toISOString(),
        payload: {
          share_id: (data as any).id,
          kind: input.kind,
          target_id: input.targetId,
        },
      } as any);
    } catch (e) {
      console.warn("[createShare] notification insert failed", e);
    }
  }

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
  target_language: string | null;
  target_difficulty_level: string | null;
  sharer_name: string | null;
}

export interface PublicSharesFilters {
  search?: string;
  grades?: string[]; // grade_level values
  subjects?: string[];
  languages?: string[];
  difficulties?: string[];
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
       teacher_textbooks:textbook_id ( title, subject, grade_level, language, difficulty_level ),
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
      target_language: kind === "textbook" ? (target?.language ?? null) : null,
      target_difficulty_level: kind === "textbook" ? (target?.difficulty_level ?? null) : null,
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
  if (filters.languages && filters.languages.length > 0) {

    items = items.filter((i) => {
      if (i.kind !== "textbook") return false;
      return filters.languages!.includes(i.target_language ?? "cs");
    });
  }
  if (filters.difficulties && filters.difficulties.length > 0) {
    items = items.filter((i) => {
      if (i.kind !== "textbook") return false;
      return filters.difficulties!.includes(i.target_difficulty_level ?? "standard");
    });
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
      title: `${src.title} (z BezliMarket)`,
      subject: src.subject,
      grade_band: src.grade_band,
      slides: src.slides,
      input_data: src.input_data,
      shared_visibility: "private",
      anonymous: false,
      copied_from_lesson_plan_id: sourceId,
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
      title: `${src.title} (z BezliMarket)`,
      subject: src.subject,
      grade_band: src.grade_band,
      worksheet_mode: src.worksheet_mode,
      spec: src.spec,
      status: "draft",
      copied_from_worksheet_id: sourceId,
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
      title: `${src.title} (z BezliMarket)`,
      description: (src as any).description ?? "",
      subject: src.subject,
      visibility: "private",
      access_code: newAccessCode,
      grade_level: (src as any).grade_level ?? null,
      school_type: (src as any).school_type ?? null,
      language: (src as any).language ?? "cs",
      difficulty_level: (src as any).difficulty_level ?? null,
      copied_from_textbook_id: sourceId,

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

export const LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "cs", label: "Čeština" },
  { value: "sk", label: "Slovenština" },
  { value: "en", label: "Angličtina" },
  { value: "other", label: "Jiný" },
];

export const DIFFICULTY_OPTIONS: { value: string; label: string }[] = [
  { value: "standard", label: "Standardní" },
  { value: "simplified", label: "Zjednodušená" },
  { value: "advanced", label: "Rozšířená" },
];

export const GRADE_LEVEL_OPTIONS: { value: string; label: string }[] = [

  { value: "zs1", label: "ZŠ 1. stupeň" },
  { value: "zs2", label: "ZŠ 2. stupeň" },
  { value: "ss", label: "SŠ" },
  { value: "vs", label: "VŠ" },
];

// ------------------------- Public textbook preview -------------------------

export interface PublicTextbookOutlineChapter {
  id: string; // topic id or "__no_topic__"
  title: string;
  sort_order: number;
  lesson_count: number;
}

export interface PublicTextbookOutline {
  textbook_id: string;
  title: string;
  chapters: PublicTextbookOutlineChapter[];
  total_lessons: number;
}

export interface PublicTextbookFirstLesson {
  id: string;
  title: string;
  hero_image_url: string | null;
  blocks: any[];
}

/**
 * Fetch chapter structure of a publicly-shared teacher textbook via a
 * SECURITY DEFINER RPC. Only lesson counts (no content) are returned.
 * Direct SELECT on teacher_textbook_lessons is no longer permitted for
 * public previews.
 */
export async function getPublicTextbookOutline(
  textbookId: string,
): Promise<PublicTextbookOutline | null> {
  const { data, error } = await supabase.rpc(
    "get_public_textbook_outline" as any,
    { _textbook_id: textbookId },
  );
  if (error) throw error;
  const rows = (data ?? []) as any[];

  if (rows.length === 0) {
    // Textbook is publicly shared but has no published lessons — still
    // surface title/chapters=[] so the dialog can render a friendly state.
    const { data: tb } = await supabase
      .from("teacher_textbooks")
      .select("id, title")
      .eq("id", textbookId)
      .maybeSingle();
    if (!tb) return null;
    return {
      textbook_id: textbookId,
      title: (tb as any).title,
      chapters: [],
      total_lessons: 0,
    };
  }

  const chapters: PublicTextbookOutlineChapter[] = rows.map((r: any) => ({
    id: r.chapter_id,
    title: r.chapter_title,
    sort_order: r.chapter_sort_order ?? 0,
    lesson_count: r.lesson_count ?? 0,
  }));
  return {
    textbook_id: textbookId,
    title: rows[0].textbook_title,
    chapters,
    total_lessons: rows[0].total_lessons ?? 0,
  };
}

/**
 * Load the first (free) lesson of a publicly-shared textbook via a
 * SECURITY DEFINER RPC. The server picks which lesson qualifies and
 * enforces access — a direct table SELECT is no longer possible.
 */
export async function getPublicTextbookFirstLesson(
  textbookId: string,
): Promise<PublicTextbookFirstLesson | null> {
  const { data, error } = await supabase.rpc(
    "get_public_textbook_first_lesson" as any,
    { _textbook_id: textbookId },
  );
  if (error) throw error;
  const rows = (data ?? []) as any[];
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    title: r.title,
    hero_image_url: r.hero_image_url ?? null,
    blocks: (r.blocks ?? []) as any[],
  };
}

// ------------------------- Trial: 3-day full preview -------------------------

export interface TextbookTrial {
  id: string;
  textbook_id: string;
  teacher_id: string;
  started_at: string;
  expires_at: string;
}

export async function getTextbookTrial(
  textbookId: string,
): Promise<TextbookTrial | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data } = await supabase
    .from("textbook_trial_activations")
    .select("id, textbook_id, teacher_id, started_at, expires_at")
    .eq("textbook_id", textbookId)
    .eq("teacher_id", session.user.id)
    .maybeSingle();
  return (data as TextbookTrial | null) ?? null;
}

export async function activateTextbookTrial(
  textbookId: string,
): Promise<TextbookTrial> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Musíte se přihlásit.");
  const { data, error } = await supabase
    .from("textbook_trial_activations")
    .insert({ textbook_id: textbookId, teacher_id: session.user.id })
    .select("id, textbook_id, teacher_id, started_at, expires_at")
    .single();
  if (error) throw new Error(error.message);
  return data as TextbookTrial;
}

export interface PublicTextbookLessonFull {
  id: string;
  title: string;
  hero_image_url: string | null;
  blocks: any[];
  topic_id: string | null;
  topic_title: string | null;
  topic_sort_order: number;
  sort_order: number;
}

/**
 * Load ALL published lessons of a publicly-shared teacher textbook — the RPC
 * only returns data when the caller has an active trial for this textbook.
 * Direct SELECT on teacher_textbook_lessons is no longer permitted.
 */
export async function getPublicTextbookAllLessons(
  textbookId: string,
): Promise<PublicTextbookLessonFull[]> {
  const { data, error } = await supabase.rpc(
    "get_public_textbook_all_lessons" as any,
    { _textbook_id: textbookId },
  );
  if (error) throw error;
  const rows = (data ?? []) as any[];
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    hero_image_url: r.hero_image_url ?? null,
    blocks: (r.blocks ?? []) as any[],
    topic_id: r.topic_id ?? null,
    topic_title: r.topic_title ?? null,
    topic_sort_order: r.topic_sort_order ?? 9999,
    sort_order: r.sort_order ?? 0,
  }));
}



// ------------------------- Content reviews -------------------------

export type ReviewTargetKind = "textbook" | "worksheet" | "lesson_plan";

export interface ContentReview {
  id: string;
  textbook_id: string | null;
  worksheet_id: string | null;
  lesson_plan_id: string | null;
  reviewer_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
  reviewer_name?: string | null;
}

export interface ReviewAggregate {
  count: number;
  average: number;
}

function reviewColumnFor(kind: ReviewTargetKind): "textbook_id" | "worksheet_id" | "lesson_plan_id" {
  return kind === "textbook" ? "textbook_id" : kind === "worksheet" ? "worksheet_id" : "lesson_plan_id";
}

/** Aggregate rating for a single target (kind + id). */
export async function getReviewAggregate(
  kind: ReviewTargetKind,
  targetId: string,
): Promise<ReviewAggregate> {
  const col = reviewColumnFor(kind);
  const { data, error } = await supabase
    .from("content_reviews" as any)
    .select("rating")
    .eq(col, targetId);
  if (error) throw error;
  const arr = (data ?? []) as unknown as { rating: number }[];
  const count = arr.length;
  const average = count === 0 ? 0 : arr.reduce((s, r) => s + r.rating, 0) / count;
  return { count, average };
}

/** Batch aggregate for several targets of the same kind — one query. */
export async function getReviewAggregates(
  kind: ReviewTargetKind,
  ids: string[],
): Promise<Map<string, ReviewAggregate>> {
  const out = new Map<string, ReviewAggregate>();
  if (ids.length === 0) return out;
  const col = reviewColumnFor(kind);
  const { data, error } = await supabase
    .from("content_reviews" as any)
    .select(`${col}, rating`)
    .in(col, ids);
  if (error) throw error;
  for (const id of ids) out.set(id, { count: 0, average: 0 });
  const acc = new Map<string, { sum: number; count: number }>();
  for (const row of (data ?? []) as any[]) {
    const key = row[col] as string;
    const cur = acc.get(key) ?? { sum: 0, count: 0 };
    cur.sum += row.rating;
    cur.count += 1;
    acc.set(key, cur);
  }
  for (const [id, v] of acc) {
    out.set(id, { count: v.count, average: v.count === 0 ? 0 : v.sum / v.count });
  }
  return out;
}

/**
 * Batch usage counts — how many teachers copied each public item into their materials.
 * Single RPC call for all kinds at once.
 */
export async function getUsageCounts(input: {
  textbookIds?: string[];
  worksheetIds?: string[];
  lessonPlanIds?: string[];
}): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const tb = input.textbookIds ?? [];
  const ws = input.worksheetIds ?? [];
  const lp = input.lessonPlanIds ?? [];
  for (const id of tb) out.set(`textbook:${id}`, 0);
  for (const id of ws) out.set(`worksheet:${id}`, 0);
  for (const id of lp) out.set(`lesson_plan:${id}`, 0);
  if (tb.length === 0 && ws.length === 0 && lp.length === 0) return out;
  const { data, error } = await supabase.rpc("get_public_content_usage_counts" as any, {
    _textbook_ids: tb,
    _worksheet_ids: ws,
    _lesson_plan_ids: lp,
  });
  if (error) throw error;
  for (const row of (data ?? []) as any[]) {
    out.set(`${row.kind}:${row.source_id}`, Number(row.usage_count) || 0);
  }
  return out;
}

export async function listReviews(
  kind: ReviewTargetKind,
  targetId: string,
): Promise<ContentReview[]> {
  const col = reviewColumnFor(kind);
  const { data, error } = await supabase
    .from("content_reviews" as any)
    .select(
      `id, textbook_id, worksheet_id, lesson_plan_id, reviewer_id, rating, comment, created_at, updated_at,
       reviewer:profiles!content_reviews_reviewer_id_fkey ( first_name, last_name )`,
    )
    .eq(col, targetId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    ...r,
    reviewer_name: r.reviewer
      ? [r.reviewer.first_name, r.reviewer.last_name].filter(Boolean).join(" ").trim() || null
      : null,
  })) as ContentReview[];
}

/** My review for a target (kind + id), or null. */
export async function getMyReview(
  kind: ReviewTargetKind,
  targetId: string,
): Promise<ContentReview | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const col = reviewColumnFor(kind);
  const { data, error } = await supabase
    .from("content_reviews" as any)
    .select("*")
    .eq(col, targetId)
    .eq("reviewer_id", session.user.id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as ContentReview) ?? null;
}

export async function upsertReview(input: {
  kind: ReviewTargetKind;
  /** The ORIGINAL content id (the market entry), NOT the copy's id. */
  targetId: string;
  rating: number;
  comment?: string | null;
}): Promise<ContentReview> {
  const userId = await requireUserId();
  if (input.rating < 1 || input.rating > 5) throw new Error("Hodnocení musí být 1–5.");
  const col = reviewColumnFor(input.kind);

  const existing = await getMyReview(input.kind, input.targetId);
  if (existing) {
    const { data, error } = await supabase
      .from("content_reviews" as any)
      .update({ rating: input.rating, comment: input.comment ?? null })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    return data as unknown as ContentReview;
  }

  const payload: Record<string, any> = {
    reviewer_id: userId,
    rating: input.rating,
    comment: input.comment ?? null,
    [col]: input.targetId,
  };
  const { data, error } = await supabase
    .from("content_reviews" as any)
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as ContentReview;
}

export async function deleteReview(reviewId: string): Promise<void> {
  const { error } = await supabase.from("content_reviews" as any).delete().eq("id", reviewId);
  if (error) throw error;
}
