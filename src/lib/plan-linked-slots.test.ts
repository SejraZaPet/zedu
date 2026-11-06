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

import { assignableLessonDates, semesterStart } from "./plan-linked-slots";
describe("assignableLessonDates", () => {
  const ev = (iso: string, scheduleStatus?: string) => ({ start: new Date(iso), scheduleStatus });
  it("semestr: listopad → 1. 9., leden → 1. 9. loni, březen → 1. 2.", () => {
    expect(semesterStart(new Date("2026-11-06T12:00:00")).toDateString()).toBe(new Date(2026, 8, 1).toDateString());
    expect(semesterStart(new Date("2027-01-15T12:00:00")).toDateString()).toBe(new Date(2026, 8, 1).toDateString());
    expect(semesterStart(new Date("2027-03-10T12:00:00")).toDateString()).toBe(new Date(2027, 1, 1).toDateString());
  });
  it("nabídne celé pololetí (i starší než 8 týdnů), ne loňské a ne budoucí", () => {
    const now = new Date("2026-11-06T12:00:00");
    const r = assignableLessonDates([ev("2026-09-02T08:00:00"), ev("2026-08-28T08:00:00"), ev("2026-11-05T08:00:00"), ev("2026-11-20T08:00:00")], now);
    expect(r.map((e) => e.start.getDate())).toEqual([5, 2]);
  });
  it("vynechá zrušené a přesunuté hodiny", () => {
    const now = new Date("2026-11-06T12:00:00");
    const r = assignableLessonDates([ev("2026-10-01T08:00:00", "cancelled"), ev("2026-10-02T08:00:00", "moved_from"), ev("2026-10-03T08:00:00")], now);
    expect(r).toHaveLength(1);
  });
  it("ponechá předvyplněné datum z karty i mimo pololetí", () => {
    const now = new Date("2026-11-06T12:00:00");
    expect(assignableLessonDates([ev("2026-06-01T08:00:00")], now, "2026-06-01")).toHaveLength(1);
  });
});
