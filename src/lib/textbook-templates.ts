import { supabase } from "@/integrations/supabase/client";
import { createDefaultBlock, type Block, type BlockType } from "@/lib/textbook-config";

export interface TemplateLesson {
  title: string;
  block_types: string[];
}

export interface TemplateChapter {
  title: string;
  lessons: TemplateLesson[];
}

export interface TemplateStructure {
  chapters: TemplateChapter[];
}

export interface TextbookTemplate {
  id: string;
  name: string;
  description: string;
  subject: string | null;
  is_public: boolean;
  created_by: string | null;
  structure_json: TemplateStructure;
  created_at: string;
}

const KNOWN_BLOCK_TYPES: BlockType[] = [
  "heading", "paragraph", "bullet_list", "image", "image_text", "card_grid",
  "table", "accordion", "quote", "lesson_link", "youtube", "callout", "divider",
  "two_column", "gallery", "summary", "activity",
];

const blocksFromTypes = (types: string[]): Block[] =>
  types
    .map((t) => (KNOWN_BLOCK_TYPES.includes(t as BlockType) ? createDefaultBlock(t as BlockType) : null))
    .filter(Boolean) as Block[];

/**
 * Creates a teacher_textbooks row plus all topics (chapters) and empty lessons
 * defined by the provided template structure. Returns the new textbook id.
 */
export async function createTextbookFromTemplate(params: {
  template: TemplateStructure;
  title: string;
  description: string;
  subjectSlug: string;
  startGrade: number;
  accessCode: string;
}): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Nejste přihlášen/a.");

  const { data: tb, error: tbErr } = await supabase
    .from("teacher_textbooks")
    .insert({
      title: params.title,
      description: params.description,
      subject: params.subjectSlug,
      teacher_id: session.user.id,
      access_code: params.accessCode,
    } as any)
    .select("id")
    .single();
  if (tbErr) throw tbErr;

  for (let ci = 0; ci < params.template.chapters.length; ci++) {
    const chapter = params.template.chapters[ci];
    const { data: topic, error: tErr } = await supabase
      .from("textbook_topics")
      .insert({
        title: chapter.title,
        subject: params.subjectSlug,
        grade: params.startGrade,
        sort_order: ci,
      })
      .select("id")
      .single();
    if (tErr) throw tErr;

    if (chapter.lessons.length > 0) {
      const rows = chapter.lessons.map((l, li) => ({
        topic_id: topic.id,
        title: l.title,
        sort_order: li,
        blocks: blocksFromTypes(l.block_types) as any,
        status: "draft",
      }));
      const { error: lErr } = await supabase.from("textbook_lessons").insert(rows);
      if (lErr) throw lErr;
    }
  }

  return tb.id;
}

/**
 * Builds a TemplateStructure (no content, just block_types) from an existing
 * textbook's topics+lessons, then saves it as a textbook_templates row.
 */
export async function saveTextbookAsTemplate(params: {
  textbookId: string;
  subjectSlug: string;
  name: string;
  description: string;
  isPublic: boolean;
}): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Nejste přihlášen/a.");

  const { data: topics } = await supabase
    .from("textbook_topics")
    .select("id, title, sort_order")
    .eq("subject", params.subjectSlug)
    .order("sort_order");

  const topicIds = (topics ?? []).map((t) => t.id);
  let lessons: any[] = [];
  if (topicIds.length > 0) {
    const { data } = await supabase
      .from("textbook_lessons")
      .select("topic_id, title, sort_order, blocks")
      .in("topic_id", topicIds)
      .order("sort_order");
    lessons = data ?? [];
  }

  const chapters: TemplateChapter[] = (topics ?? []).map((t) => ({
    title: t.title,
    lessons: lessons
      .filter((l) => l.topic_id === t.id)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((l) => ({
        title: l.title,
        block_types: Array.isArray(l.blocks)
          ? (l.blocks as any[]).map((b) => b?.type).filter(Boolean)
          : [],
      })),
  }));

  const { data: created, error } = await supabase
    .from("textbook_templates")
    .insert({
      name: params.name,
      description: params.description,
      subject: params.subjectSlug,
      is_public: params.isPublic,
      created_by: session.user.id,
      structure_json: { chapters } as any,
    })
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}
