import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Block } from "@/lib/textbook-config";
import { activitySummary, activityMinutes, activityMeta } from "@/lib/activity-meta";
import { buildActivitiesPrintHtml } from "@/lib/activity-pdf-export";
import LessonBlockRenderer from "@/components/LessonBlockRenderer";

const quizBlock = (over: Record<string, any> = {}): Block =>
  ({
    id: "a1",
    type: "activity",
    visible: true,
    props: {
      activityType: "quiz",
      title: "Druhy mas",
      estimatedMinutes: 7,
      quiz: {
        question: "Které maso je hovězí?",
        answers: [
          { text: "Svíčková", correct: true },
          { text: "Kýta z prasete", correct: false },
        ],
        explanation: "Svíčková je z hovězího.",
      },
      ...over,
    },
  }) as unknown as Block;

describe("metadata aktivit", () => {
  it("vrací souhrn, čas a popis typu", () => {
    const p = (quizBlock().props ?? {}) as Record<string, any>;
    expect(activitySummary(p)).toBe("2 možností");
    expect(activityMinutes(p)).toBe(7);
    expect(activityMeta("quiz").label).toBe("Kvíz");
    expect(activityMinutes({})).toBeNull();
  });
});

describe("PDF export aktivit", () => {
  it("zadání pro žáky neobsahuje správnou odpověď vyznačenou, s řešením ano", () => {
    const student = buildActivitiesPrintHtml([quizBlock()], { lessonTitle: "Maso", variant: "student" });
    const teacher = buildActivitiesPrintHtml([quizBlock()], { lessonTitle: "Maso", variant: "teacher" });
    expect(student).toContain("Zadání pro žáky");
    expect(student).not.toContain('class="ok"');
    expect(teacher).toContain("S řešením pro učitele");
    expect(teacher).toContain('<strong class="ok">Svíčková</strong>');
    expect(teacher).toContain("Vysvětlení");
  });
});

describe("aktivita u žáka", () => {
  it("nepovinná i povinná aktivita jsou při otevření lekce sbalené", () => {
    const { unmount } = render(<LessonBlockRenderer block={quizBlock()} />);
    expect(screen.getByText("Druhy mas")).toBeInTheDocument();
    expect(screen.getByText("Nepovinné")).toBeInTheDocument();
    expect(screen.queryByText("Které maso je hovězí?")).not.toBeInTheDocument();
    unmount();

    render(<LessonBlockRenderer block={quizBlock({ required: true })} />);
    expect(screen.getByText("🔒 Povinné")).toBeInTheDocument();
    expect(screen.queryByText("Které maso je hovězí?")).not.toBeInTheDocument();
  });
});
