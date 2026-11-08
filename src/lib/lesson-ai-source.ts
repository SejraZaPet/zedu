import { splitLessonIntoSections } from "@/lib/lesson-content-splitter";
import { blocksToText } from "../../supabase/functions/_shared/lesson-text";
import { normalizeAiProps, assertAiFillContent } from "@/lib/activity-ai-normalize";
import type { Block } from "@/lib/textbook-config";

export type LessonAiType = "mcq" | "true_false" | "matching" | "fill_blanks" | "flashcards";
export interface LessonAiSource { lessonId: string; lessonSource: "teacher_textbook_lessons"; sectionIds: string[]; textHash: string; createdAt: string }
export interface OwnedAiLesson { id: string; title: string; blocks: unknown; textbook_id: string }
export interface AiSourceBook { id: string; teacher_id: string; copied_from_textbook_id: string | null; is_system: boolean; is_demo_seed: boolean }
export function ownSourceBook(book: AiSourceBook, userId: string) {
  return book.teacher_id === userId && !book.copied_from_textbook_id && !book.is_system && !book.is_demo_seed;
}
export function lessonAiParts(lesson: OwnedAiLesson) {
  const sections = splitLessonIntoSections(lesson.blocks);
  return sections.length ? sections.map(s => ({ id: String(s.index), title: s.title, text: [s.title, s.text].filter(Boolean).join("\n") }))
    : [{ id: "all", title: "Celá lekce", text: blocksToText(lesson.blocks) }];
}
export function sourceText(parts: { id: string; text: string }[], ids: string[], limit: number) {
  return parts.filter(p => ids.includes(p.id)).map(p => p.text).join("\n\n").trim().slice(0, limit);
}
export function aiTypeLimits(type: LessonAiType) {
  return type === "flashcards" ? { min: 3, max: 15, text: 6000 } : type === "fill_blanks" ? { min: 3, max: 8, text: 6000 }
    : { min: 3, max: type === "matching" ? 8 : 12, text: 14000 };
}
export function lessonAiRequest(type: LessonAiType, text: string, title: string, count: number) {
  const limits = aiTypeLimits(type);
  const n = Math.max(limits.min, Math.min(limits.max, Math.round(count) || limits.min));
  if (text.trim().length < 40) throw new Error("Vybraná část nemá dost textu. Vyberte více částí lekce.");
  return type === "fill_blanks" || type === "flashcards"
    ? { name: "generate-activity-content", body: { activityType: type, context: text.slice(0, limits.text), topic: title.slice(0, 120), ...(type === "flashcards" ? { cardCount: n } : { itemCount: n }) } }
    : { name: "generate-lesson-quiz", body: { text: text.slice(0, limits.text), title: title.slice(0, 200), format: type, count: n } };
}
export async function makeLessonSource(lesson: OwnedAiLesson, sectionIds: string[], text: string): Promise<LessonAiSource> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  const textHash = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
  return { lessonId: lesson.id, lessonSource: "teacher_textbook_lessons", sectionIds: [...sectionIds], textHash, createdAt: new Date().toISOString() };
}
export function lessonAiDraft(type: LessonAiType, data: any, title: string, source: LessonAiSource): Block {
  let props: Record<string, any>;
  if (type === "mcq") {
    if (!Array.isArray(data?.questions) || !data.questions.length) throw new Error("AI nevrátila použitelné otázky.");
    props = { quiz: { questions: data.questions.map((q: any) => ({ question: q.question, explanation: q.explanation, answers: q.answers.map((text: string, i: number) => ({ text, correct: i === q.correctIndex })) })) } };
  } else if (type === "true_false") {
    if (!Array.isArray(data?.statements) || !data.statements.length) throw new Error("AI nevrátila použitelná tvrzení.");
    props = { trueFalse: { statements: data.statements } };
  } else if (type === "matching") {
    if (!Array.isArray(data?.pairs) || data.pairs.length < 2) throw new Error("AI nevrátila dost dvojic.");
    props = { matching: { left: data.pairs.map((p: any) => p.left), right: data.pairs.map((p: any) => p.right) } };
  } else {
    props = data?.props ?? {};
    if (type === "flashcards" && (!Array.isArray(props.flashcards) || !props.flashcards.length)) throw new Error("AI nevrátila kartičky.");
  }
  props = normalizeAiProps(props);
  assertAiFillContent(type, props);
  return { id: crypto.randomUUID(), type: "activity", visible: true, props: { ...props, title, activityType: type === "mcq" ? "quiz" : type, ai_generated: true, source } };
}