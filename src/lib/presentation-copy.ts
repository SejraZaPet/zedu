import { mergePresentationSlides } from "@/lib/presentation-merge";

function cloneSlides(slides: any[]): any[] {
  return structuredClone(Array.isArray(slides) ? slides : []);
}

/** Vstup pro novou vlastní prezentaci bez jakékoli vazby na zdrojovou lekci. */
export function independentPresentationPayload(teacherId: string, title: string, freshSlides: any[], savedSlides: any[]) {
  const merged = mergePresentationSlides(freshSlides, savedSlides);
  return {
    teacher_id: teacherId,
    title: `${String(title || "Prezentace").trim() || "Prezentace"} – moje kopie`,
    slides: cloneSlides(merged),
    lesson_id: null,
    source_lesson_id: null,
    source_lesson_type: null,
  };
}
