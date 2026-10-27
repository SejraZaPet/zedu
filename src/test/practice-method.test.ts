import { describe, expect, it } from "vitest";
import {
  METHOD_PHASES, buildPhases, allocateQuiz, prepareSourceText, SOURCE_TEXT_LIMIT, MIN_SOURCE_TEXT_LENGTH,
} from "../../supabase/functions/_shared/practice-phases";
import {
  checkAcrostic, sequenceUnlockedCount, advance, startWork, remainingMs, pause, resume,
  POMODORO_IDLE, POMODORO_PRESETS, notebookPageText, withStops,
} from "@/lib/practice-method";
import { scorePractice } from "@/lib/student-practice";

const TEXT = "Fotosyntéza probíhá v chloroplastech. ".repeat(20);
const mc = (t: string) => ({ type: "multiple_choice", text: t, options: ["a", "b", "c", "d"], correct_index: 0 });

describe("definice fází", () => {
  const expected: Record<string, string[]> = {
    sq4r: ["survey", "question", "read", "recite", "write", "review"],
    pqrst: ["preview", "question", "read", "recite", "test"],
    "5p": ["prolistuj", "ptej", "prectii", "povez", "proveř"],
    neana: ["nahled", "eseje", "aktivni_cteni", "notace", "aplikace"],
    sekvencni: ["spojeni"],
    akrostika: ["pojmy", "pismena", "veta", "test"],
    loci: ["trasa", "obrazy", "prochazeni"],
    pomodoro: ["plan", "blok", "otazky"],
  };
  it.each(Object.keys(expected))("%s má fáze ve správném pořadí", (slug) => {
    expect(METHOD_PHASES[slug].map((d) => d.key)).toEqual(expected[slug]);
  });
  it("všech 8 technik", () => expect(Object.keys(METHOD_PHASES).sort()).toEqual(Object.keys(expected).sort()));

  it("bez obsahu od AI se stránka nerozbije (fallback)", () => {
    for (const slug of Object.keys(expected)) {
      const phases = buildPhases(slug, {}, 8, TEXT);
      expect(phases.length).toBeGreaterThanOrEqual(expected[slug].length);
      phases.filter((p) => p.kind === "questions").forEach((p) => expect(p.questions.length).toBeGreaterThan(0));
    }
  });

  it("SQ4R: survey 2 otázky, review dostane zbytek podle délky", () => {
    for (const total of [4, 8, 12]) {
      const a = allocateQuiz("sq4r", total);
      expect(a.survey).toBe(2);
      expect(a.review).toBe(Math.max(1, total - 2 - 3));
    }
    const ai = { quiz: { survey: [mc("1"), mc("2"), mc("3")], review: Array.from({ length: 9 }, (_, i) => mc(`r${i}`)) } };
    const ph = buildPhases("sq4r", ai, 12, TEXT);
    expect(ph.find((p) => p.key === "survey")!.questions).toHaveLength(2);
    expect(ph.find((p) => p.key === "review")!.questions).toHaveLength(7);
    expect(ph.find((p) => p.key === "read")!.content!.text).toBe(TEXT.trim().length ? TEXT : "");
  });

  it("Sekvenční: části z AI + závěr Spojení", () => {
    const sections = [1, 2, 3].map((i) => ({ title: `S${i}`, text: `část ${i}`, questions: [mc("a"), mc("b")] }));
    const ph = buildPhases("sekvencni", { sections, quiz: { spojeni: [mc("x"), mc("y")] } }, 8, TEXT);
    expect(ph.map((p) => p.kind)).toEqual(["section", "section", "section", "questions"]);
  });

  it("Loci: otázky procházení mají správný pojem a zastávku žáka", () => {
    const terms = ["Mitochondrie", "Jádro", "Ribozom", "Vakuola", "Membrána"].map((term) => ({ term }));
    const ph = buildPhases("loci", { terms }, 8, TEXT);
    const walk = ph.find((p) => p.key === "prochazeni")!;
    expect(walk.questions).toHaveLength(5);
    expect(walk.questions[0].correct_answer).toBe("Mitochondrie");
    expect(withStops(walk.questions[0].text, ["Kuchyň"])).toBe("Zastávka Kuchyň: jaký pojem tu leží?");
    expect(withStops(walk.questions[1].text, ["Kuchyň"])).toContain("Zastávka 2");
  });
});

describe("skórování přes fáze", () => {
  it("počítá jen hodnotitelné otázky ze všech fází", () => {
    const ph = buildPhases("pqrst", { quiz: { preview: [mc("p")], test: [mc("t1"), mc("t2")] } }, 6, TEXT);
    const qs = ph.flatMap((p) => p.questions) as any[];
    const answers: Record<string, number> = {};
    qs.forEach((q, i) => { if (q.type === "multiple_choice") answers[String(i)] = 0; });
    const r = scorePractice(qs, answers);
    expect(r.total).toBe(3);
    expect(r.correct).toBe(3);
  });
});

describe("akrostika", () => {
  const terms = ["Merkur", "Venuše", "Země"];
  it("věta se správnými písmeny v pořadí", () => expect(checkAcrostic("Moje velká zahrada", terms).ok).toBe(true));
  it("špatné pořadí neprojde", () => {
    const r = checkAcrostic("Velká moje zahrada", terms);
    expect(r.ok).toBe(false);
    expect(r.items[0].ok).toBe(false);
  });
  it("diakritika: Č i C odpovídá pojmu na Č", () => {
    expect(checkAcrostic("Čáp letí", ["Čočka", "Luk"]).ok).toBe(true);
    expect(checkAcrostic("Cap letí", ["Čočka", "Luk"]).ok).toBe(true);
  });
  it("akronym jedním slovem", () => {
    const r = checkAcrostic("MVZ", terms);
    expect(r.mode).toBe("akronym");
    expect(r.ok).toBe(true);
  });
});

describe("odemykání Sekvenční", () => {
  const sec = { kind: "section", questions: [mc("a"), mc("b")] as any[] };
  const phases = [sec, sec, sec, { kind: "questions", questions: [mc("x")] as any[] }];
  it("bez odpovědí je odemčená jen 1. část", () => expect(sequenceUnlockedCount(phases, {})).toBe(1));
  it("50 % neodemkne další", () => expect(sequenceUnlockedCount(phases, { 0: 0, 1: 1 })).toBe(1));
  it("100 % odemkne další část", () => expect(sequenceUnlockedCount(phases, { 0: 0, 1: 0 })).toBe(2));
  it("všechny části → odemčené Spojení", () =>
    expect(sequenceUnlockedCount(phases, { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 })).toBe(4));
});

describe("časovač Pomodoro z časových razítek", () => {
  const p = POMODORO_PRESETS["25/5"];
  const MIN = 60_000;
  it("zbývající čas se počítá z konce bloku", () => {
    const s = startWork(POMODORO_IDLE, 0, p);
    expect(remainingMs(s, 10 * MIN)).toBe(15 * MIN);
  });
  it("po skončení práce krátká pauza, po 4. cyklu dlouhá", () => {
    let s = startWork(POMODORO_IDLE, 0, p);
    let r = advance(s, 25 * MIN, p);
    expect(r.finished).toBe("work");
    expect(r.state.mode).toBe("break");
    expect(r.state.endsAt).toBe(30 * MIN);
    s = { ...startWork(POMODORO_IDLE, 0, p), cycles: 3 };
    r = advance(s, 26 * MIN, p);
    expect(r.state.mode).toBe("long_break");
    expect(r.state.endsAt).toBe(40 * MIN);
  });
  it("pauza drží zbývající čas i po dlouhé nepřítomnosti", () => {
    const s = pause(startWork(POMODORO_IDLE, 0, p), 5 * MIN);
    expect(advance(s, 100 * MIN, p).finished).toBeNull();
    expect(remainingMs(resume(s, 100 * MIN), 100 * MIN)).toBe(20 * MIN);
  });
  it("předvolby 25/5, 15/3, 50/10", () => {
    expect(Object.keys(POMODORO_PRESETS)).toEqual(["25/5", "15/3", "50/10"]);
  });
});

describe("zdroj textu", () => {
  it("ořízne na 8000 znaků", () => {
    const r = prepareSourceText("a".repeat(9000));
    expect(r.ok && r.text.length).toBe(SOURCE_TEXT_LIMIT);
    expect(SOURCE_TEXT_LIMIT).toBe(8000);
  });
  it("odmítne krátký text česky", () => {
    const r = prepareSourceText("krátké");
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.error).toContain(String(MIN_SOURCE_TEXT_LENGTH));
  });
  it("ze sešitu čte jen textová pole (bez tahů, obrázků a seznamu třídy)", () => {
    const content = {
      strokes: [{ points: [[1, 2]] }],
      images: [{ url: "x" }],
      textBoxes: [{ text: "Poznámka 1" }, { text: "Jména", kind: "class-roster" }, { text: "  " }, { text: "Poznámka 2" }],
    };
    expect(notebookPageText(content)).toBe("Poznámka 1\n\nPoznámka 2");
    expect(notebookPageText({ strokes: [] })).toBe("");
  });
});
