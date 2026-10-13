import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LessonActivityChecklist from "@/components/assignments/LessonActivityChecklist";
import type { ActivityProgressEntry } from "@/lib/lesson-activity-progress";
import { computeLessonActivityProgress } from "@/lib/lesson-activity-progress";

const entries: ActivityProgressEntry[] = [
  {
    activity: { index: 1, title: "Kvíz", activityType: "quiz", required: true },
    best: { score: 8, maxScore: 8, completedAt: "2026-10-13T08:00:00Z", ratio: 1 },
  },
  {
    activity: { index: 2, title: "Pexeso", activityType: "matching", required: true },
    best: null,
  },
];

const allDone: ActivityProgressEntry[] = [
  {
    activity: { index: 1, title: "Kvíz", activityType: "quiz", required: true },
    best: { score: 8, maxScore: 8, completedAt: "2026-10-13T08:00:00Z", ratio: 1 },
  },
];

describe("LessonActivityChecklist (učitelská karta)", () => {
  it("chybí-li povinná aktivita, zobrazí oranžové upozornění s jejím názvem", () => {
    render(<LessonActivityChecklist entries={entries} teacher />);
    expect(screen.getByText("Chybí povinná aktivita: Pexeso")).toBeInTheDocument();
    expect(screen.getByLabelText("Chybí povinná aktivita")).toBeInTheDocument();
    // U dokončené aktivity upozornění na ni nevede.
    expect(screen.queryByText(/Chybí.*Kvíz/)).toBeNull();
  });

  it("u více chybějících spojí názvy do jedné výstrahy", () => {
    const twoMissing: ActivityProgressEntry[] = [
      { activity: { index: 1, title: "Kvíz", activityType: "quiz", required: true }, best: null },
      { activity: { index: 2, title: "Pexeso", activityType: "matching", required: true }, best: null },
    ];
    render(<LessonActivityChecklist entries={twoMissing} teacher />);
    expect(screen.getByText("Chybí povinné aktivity: Kvíz, Pexeso")).toBeInTheDocument();
  });

  it("jsou-li všechny splněné, žádné upozornění se nezobrazí", () => {
    render(<LessonActivityChecklist entries={allDone} teacher />);
    expect(screen.queryByLabelText("Chybí povinná aktivita")).toBeNull();
    expect(screen.queryByText(/Chybí povinn/)).toBeNull();
    expect(screen.getByText(/Kvíz/)).toBeInTheDocument();
  });

  it("žákovská varianta výstrahu nemá", () => {
    render(<LessonActivityChecklist entries={entries} />);
    expect(screen.queryByText(/Chybí povinn/)).toBeNull();
  });

  it("doplňkové aktivity se do počtu povinných nezapočítají", () => {
    const acts = [
      { index: 1, title: "Kvíz", activityType: "quiz", required: true },
      { index: 2, title: "Bonus", activityType: "quiz", required: false },
    ];
    const best = new Map([
      [1, { score: 8, maxScore: 8, completedAt: "2026-10-13T08:00:00Z", ratio: 1 }],
      [2, { score: 4, maxScore: 4, completedAt: "2026-10-13T08:05:00Z", ratio: 1 }],
    ]);
    const p = computeLessonActivityProgress(acts, best);
    expect(p.total).toBe(1);
    expect(p.done).toBe(1);
    expect(p.other.map((e) => e.activity.index)).toEqual([2]);
  });
});
