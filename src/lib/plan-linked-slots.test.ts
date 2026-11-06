import { describe, it, expect } from "vitest";
import { inputDataWithoutLesson, removeSlotsForLesson } from "./plan-linked-slots";

const ctx = { date: "2026-11-06", isGroup: false, contextId: "c1", subjectKey: "potraviny" };

describe("plan-linked-slots", () => {
  it("odpojení odstraní jen termín dané hodiny, jiné termíny i pole zůstanou", () => {
    const input = {
      title: "x",
      linkedSlots: [
        { subject: "Potraviny", classId: "c1", date: "2026-11-06", time: "10:40" },
        { subject: "Potraviny", classId: "c1", date: "2026-11-13" },
        { subject: "Potraviny", classId: "c2", date: "2026-11-06" },
        { subject: "Jiný", classId: "c1", date: "2026-11-06" },
      ],
    };
    const out = inputDataWithoutLesson(input, ctx)!;
    expect(out.title).toBe("x");
    expect(out.linkedSlots).toHaveLength(3);
    expect(out.linkedSlots.some((s) => s.classId === "c1" && s.date === "2026-11-06" && s.subject === "Potraviny")).toBe(false);
  });

  it("vrací null, když plán termín nemá", () => {
    expect(inputDataWithoutLesson({ linkedSlots: [{ classId: "c1", date: "2026-11-07" }] }, ctx)).toBeNull();
    expect(inputDataWithoutLesson(null, ctx)).toBeNull();
  });

  it("skupina: odpojí podle groupId a staré sloty bez cíle", () => {
    const g = { ...ctx, isGroup: true, contextId: "g1" };
    const out = removeSlotsForLesson(
      [{ groupId: "g1", date: "2026-11-06" }, { date: "2026-11-06" }, { groupId: "g2", date: "2026-11-06" }],
      g,
    );
    expect(out).toEqual([{ groupId: "g2", date: "2026-11-06" }]);
  });
});

import { assignablePastLessons } from "./plan-linked-slots";
describe("assignablePastLessons", () => {
  const now = new Date("2026-11-06T12:00:00");
  const ev = (d: string) => ({ start: new Date(d) });
  it("nabídne proběhlé hodiny posledních 8 týdnů, nejnovější první", () => {
    const r = assignablePastLessons([ev("2026-10-01T08:00:00"), ev("2026-11-05T08:00:00"), ev("2026-08-01T08:00:00")], now);
    expect(r.map((e) => e.start.getDate())).toEqual([5, 1]);
  });
  it("starší hodinu ponechá, pokud je právě zvolená z karty", () => {
    expect(assignablePastLessons([ev("2026-08-01T08:00:00")], now, "2026-08-01")).toHaveLength(1);
  });
});
