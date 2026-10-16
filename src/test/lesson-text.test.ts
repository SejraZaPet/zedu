import { describe, expect, it } from "vitest";
import { blocksToText, cleanLessonText, hasEnoughLessonText, INSUFFICIENT_LESSON_TEXT } from "../../supabase/functions/_shared/lesson-text";
import { practiceErrorMessage } from "@/lib/practice-error";
import { blocksToPlainText } from "@/lib/lesson-study";

describe("shared lesson text extraction", () => {
  const blocks = [
    { type: "heading", props: { text: "<h2>Poživatiny &amp; výživa</h2>" } },
    { type: "bullet_list", props: { items: ["Potraviny", { text: "<b>Pochutiny</b> &ndash; káva" }] } },
    { type: "slide_group", props: { children: [
      { type: "paragraph", props: { text: "<p>První odstavec.</p><p>Druhý&nbsp;odstavec.</p>" } },
      { type: "slide_group", props: { children: [
        { type: "image", props: { caption: "Popis obrázku", url: "https://media.example/private" } },
        { type: "activity", props: { quiz: { question: "Co jsou poživatiny?", answers: [{ text: "Látky určené k požívání", correct: true }], explanation: "Dodávají živiny." } } },
      ] } },
    ] } },
    { type: "activity", props: { flashcards: [{ front: "Potravina", back: "Má výživovou hodnotu." }], revealCards: { cards: [{ title: "Pochutina", content: "Ovlivňuje chuť." }] } } },
    { type: "activity", props: { quiz: { questions: [{ question: "Více otázek", answers: [{ text: "Více odpovědí" }] }] } } },
  ];

  it("reads props, lists, deeply nested groups and activity questions/answers/cards", () => {
    const text = blocksToText(blocks);
    for (const expected of ["Poživatiny & výživa", "Potraviny", "Pochutiny – káva", "První odstavec.\n\nDruhý odstavec.", "Popis obrázku", "Co jsou poživatiny?", "Látky určené k požívání", "Dodávají živiny.", "Potravina", "Má výživovou hodnotu.", "Pochutina", "Ovlivňuje chuť.", "Více otázek", "Více odpovědí"]) {
      expect(text).toContain(expected);
    }
    expect(text).not.toMatch(/<[^>]+>|&nbsp;|https:\/\/|correct/);
    expect(blocksToPlainText(blocks)).toBe(text);
  });

  it("cleans markup and decodes numeric entities without script content", () => {
    expect(cleanLessonText('<script>secret()</script><p>&#x10D;aj &#269; &quot;A&quot;<br>další</p>')).toBe('čaj č "A"\ndalší');
    expect(cleanLessonText("&#99999999;")).toBe("");
  });

  it("handles empty input, legacy top-level fields and the 8000 character limit", () => {
    expect(blocksToText(null)).toBe("");
    expect(blocksToText([{ text: "Text", title: "Nadpis", heading: "Sekce", content: "Obsah" }])).toContain("Obsah");
    expect(blocksToText([{ props: { text: "a".repeat(9000) } }])).toHaveLength(8000);
    expect(blocksToText(blocks, 25)).toHaveLength(25);
  });

  it("rejects text below 200 characters but accepts exactly 200", () => {
    expect(hasEnoughLessonText("a".repeat(199))).toBe(false);
    expect(hasEnoughLessonText("a".repeat(200))).toBe(true);
    expect(hasEnoughLessonText(" ".repeat(200))).toBe(false);
  });

  it("shows the server message instead of the generic invocation error", async () => {
    const context = new Response(JSON.stringify({ error: INSUFFICIENT_LESSON_TEXT }), { status: 422 });
    expect(await practiceErrorMessage({ context, message: "Edge Function returned a non-2xx status code" })).toBe(INSUFFICIENT_LESSON_TEXT);
    expect(await practiceErrorMessage(new Error("Připojení selhalo"))).toBe("Připojení selhalo");
  });
});