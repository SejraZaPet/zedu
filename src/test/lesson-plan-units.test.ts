import { describe, it, expect } from "vitest";
import { buildLessonUnits, clampLessonMinutes } from "@/lib/lesson-plan-units";

const h = (id: string, text: string, level = 2) => ({ id, type: "heading", props: { text, level } });
const p = (id: string, text: string) => ({ id, type: "paragraph", props: { text } });

describe("celky lekce pro plán hodiny", () => {
  it("dělí podle nadpisů, úvod před prvním nadpisem", () => {
    const u = buildLessonUnits([p("a", "Intro"), h("h1", "Jedna"), p("b", "x"), h("h2", "Dva", 3), h("h3", "Tři"), h("h4", "Čtyři")]);
    expect(u.map((x) => x.title)).toEqual(["Úvod", "Jedna", "Tři", "Čtyři"]);
    expect(u[1].blockIds).toEqual(["h1", "b", "h2"]);
  });
  it("méně než 3 nadpisy → podle karet", () => {
    const u = buildLessonUnits([
      { id: "g1", type: "slide_group", props: { children: [h("x", "Karta A"), p("y", "t")] } },
      p("z", "Volný text"),
      { id: "g2", type: "slide_group", props: { children: [p("w", "Karta B")] } },
    ]);
    expect(u.map((x) => x.title)).toEqual(["Karta A", "Volný text", "Karta B"]);
  });
  it("bez nadpisů a karet → po 5 blocích", () => {
    const u = buildLessonUnits(Array.from({ length: 12 }, (_, i) => p(`p${i}`, `T${i}`)));
    expect(u.map((x) => x.blockIds.length)).toEqual([5, 5, 2]);
    expect(u[1].title).toBe("T5");
  });
  it("délka hodiny se drží v 10–180", () => {
    expect(clampLessonMinutes(5)).toBe(10);
    expect(clampLessonMinutes(500)).toBe(180);
    expect(clampLessonMinutes("x")).toBe(45);
  });
});
