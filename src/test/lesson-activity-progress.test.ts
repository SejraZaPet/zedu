import { describe, it, expect } from "vitest";
import {
  bestResultsByActivity,
  computeLessonActivityProgress,
  uniqueActivityTitles,
  baseActivityTitle,
  lessonActivityTitles,
} from "@/lib/lesson-activity-progress";
import { activityMeta } from "@/lib/activity-meta";

describe("bestResultsByActivity", () => {
  it("vezme nejlepší výsledek bez ohledu na pořadí řádků", () => {
    const rows = [
      { activity_index: 2, score: 8, max_score: 8, completed_at: "2026-10-07T08:30:00Z" },
      { activity_index: 2, score: 3, max_score: 8, completed_at: "2026-10-07T09:00:00Z" },
      { activity_index: 4, score: 1, max_score: 4 },
      { activity_index: 4, score: 4, max_score: 4 },
    ];
    const a = bestResultsByActivity(rows);
    const b = bestResultsByActivity([...rows].reverse());
    expect(a.get(2)!.score).toBe(8);
    expect(b.get(2)!.score).toBe(8);
    expect(a.get(2)!.completedAt).toBe("2026-10-07T08:30:00Z");
    expect(a.get(4)!.score).toBe(4);
    expect(b.get(4)!.score).toBe(4);
  });
});

describe("názvy aktivit", () => {
  it("bez názvu použije typ", () => {
    expect(baseActivityTitle("", "quiz")).toBe(activityMeta("quiz").label);
    expect(baseActivityTitle("Aktivita", "quiz")).toBe(activityMeta("quiz").label);
    expect(baseActivityTitle("Moje", "quiz")).toBe("Moje");
  });
  it("při shodě přidá pořadí", () => {
    const out = uniqueActivityTitles([{ title: "Kvíz" }, { title: "Jiné" }, { title: "Kvíz" }, { title: "Kvíz" }]);
    expect(out.map((a) => a.title)).toEqual(["Kvíz", "Jiné", "Kvíz (2)", "Kvíz (3)"]);
  });
  it("v lekci indexuje podle viditelných bloků", () => {
    const m = lessonActivityTitles([
      { type: "paragraph" },
      { type: "activity", props: { activityType: "quiz" } },
      { type: "activity", props: { activityType: "quiz" } },
    ]);
    const label = activityMeta("quiz").label;
    expect(m.get(1)).toBe(label);
    expect(m.get(2)).toBe(`${label} (2)`);
  });
});

describe("computeLessonActivityProgress", () => {
  const acts = [
    { index: 1, title: "A", activityType: "quiz", required: true },
    { index: 2, title: "B", activityType: "quiz", required: true },
    { index: 3, title: "C", activityType: "quiz", required: true },
    { index: 5, title: "D", activityType: "quiz", required: false },
  ];
  it("X z Y, průměr hotových a nepovinné zvlášť", () => {
    const best = bestResultsByActivity([
      { activity_index: 1, score: 8, max_score: 8 },
      { activity_index: 2, score: 4, max_score: 8 },
      { activity_index: 5, score: 0, max_score: 4 },
    ]);
    const p = computeLessonActivityProgress(acts, best);
    expect(p.done).toBe(2);
    expect(p.total).toBe(3);
    expect(p.completedAvgPct).toBe(75);
    expect(p.completionPct).toBe(50);
    expect(p.other.map((e) => e.activity.index)).toEqual([5]);
    expect(p.required.find((e) => e.activity.index === 3)!.best).toBeNull();
  });
  it("počítá bodově váženou úspěšnost 21 z 25 jako 84 %", () => {
    const best = bestResultsByActivity([
      { activity_index: 1, score: 7, max_score: 8 },
      { activity_index: 2, score: 4, max_score: 7 },
      { activity_index: 3, score: 10, max_score: 10 },
    ]);
    expect(computeLessonActivityProgress(acts, best).successPct).toBe(84);
  });
  it("při nulové hotovosti nemá procento úspěšnosti", () => {
    const progress = computeLessonActivityProgress(acts, new Map());
    expect(progress.done).toBe(0);
    expect(progress.successPct).toBeNull();
  });
});
