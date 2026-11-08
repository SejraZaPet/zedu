// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ownSourceBook, lessonAiParts, sourceText, lessonAiRequest, makeLessonSource, lessonAiDraft } from "./lesson-ai-source";
const lesson = { id: "own", title: "[TEST] Lekce", textbook_id: "book", blocks: [
  { id: "h1", type: "heading", props: { text: "První část" } }, { id: "t1", type: "text", props: { text: "Text první části určený k procvičování a tvorbě vlastního kvízu." } },
  { id: "h2", type: "heading", props: { text: "Druhá část" } }, { id: "t2", type: "text", props: { text: "Jiný obsah druhé části, který nemá být poslán do AI." } },
] };
describe("AI z vlastních lekcí", () => {
  const book = { id: "book", teacher_id: "teacher", copied_from_textbook_id: null, is_system: false, is_demo_seed: false };
  it("nabízí pouze vlastní nepřevzaté učebnice", () => {
    expect(ownSourceBook(book, "teacher")).toBe(true);
    expect(ownSourceBook(book, "other")).toBe(false);
    expect(ownSourceBook({ ...book, copied_from_textbook_id: "original" }, "teacher")).toBe(false);
    expect(ownSourceBook({ ...book, is_system: true }, "teacher")).toBe(false);
    expect(ownSourceBook({ ...book, is_demo_seed: true }, "teacher")).toBe(false);
  });
  it("skládá jen vybrané části v pořadí lekce", () => {
    const parts = lessonAiParts(lesson);
    expect(parts).toHaveLength(2);
    const text = sourceText(parts, ["1"], 14000);
    expect(text).toContain("první části");
    expect(text).not.toContain("Jiný obsah");
    expect(sourceText(parts, ["2", "1"], 14000).indexOf("První")).toBe(0);
  });
  it("respektuje limit 14000 znaků a počet 3–12 pro ABCD", () => {
    const request = lessonAiRequest("mcq", "x".repeat(15000), lesson.title, 15);
    expect(request.body).toEqual({ text: "x".repeat(14000), title: lesson.title, format: "mcq", count: 12 });
    expect(lessonAiRequest("mcq", "x".repeat(100), lesson.title, 1).body.count).toBe(3);
  });
  it("respektuje současné maximum 8 dvojic", () => {
    expect(lessonAiRequest("matching", "x".repeat(100), lesson.title, 12).body.count).toBe(8);
  });
  it("posílá jen text a parametry, žádná data žáků ani zdrojovou identitu", () => {
    expect(Object.keys(lessonAiRequest("mcq", "x".repeat(100), lesson.title, 5).body).sort()).toEqual(["count", "format", "text", "title"]);
  });
  it("kartičky omezují kontext na 6000 znaků", () => {
    const request = lessonAiRequest("flashcards", "x".repeat(7000), lesson.title, 5);
    expect("context" in request.body ? request.body.context?.length : 0).toBe(6000);
    expect("cardCount" in request.body ? request.body.cardCount : 0).toBe(5);
  });
  it("odmítne příliš krátký text", () => expect(() => lessonAiRequest("mcq", "krátký", "", 5)).toThrow());
  it("uloží zdroj a hash přesného textu", async () => {
    const source = await makeLessonSource(lesson, ["1"], "zdroj");
    expect(source).toMatchObject({ lessonId: "own", lessonSource: "teacher_textbook_lessons", sectionIds: ["1"] });
    expect(source.textHash).toHaveLength(64);
    expect((await makeLessonSource(lesson, ["1"], "jiný zdroj")).textHash).not.toBe(source.textHash);
  });
  it("vytvoří jen lokální označený návrh s metadaty", async () => {
    const source = await makeLessonSource(lesson, ["1"], "zdroj");
    const draft = lessonAiDraft("mcq", { questions: [{ question: "[TEST] Otázka", answers: ["A", "B", "C", "D"], correctIndex: 2 }] }, lesson.title, source);
    expect(draft.props.ai_generated).toBe(true);
    expect(draft.props.source).toEqual(source);
    expect(draft.props.quiz.questions[0].answers[2].correct).toBe(true);
    expect(draft).not.toHaveProperty("status");
  });
  it("odmítne prázdný návrh místo vytvoření prázdné aktivity", async () => {
    const source = await makeLessonSource(lesson, ["1"], "zdroj");
    expect(() => lessonAiDraft("mcq", {}, lesson.title, source)).toThrow();
    expect(() => lessonAiDraft("fill_blanks", { props: { fillBlanks: { text: "Bez doplnění" } } }, lesson.title, source)).toThrow();
  });
});