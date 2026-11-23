import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import LessonPlanActions from "@/components/subject-class/LessonPlanActions";

const handlers = {
  onOpen: vi.fn(),
  onAssign: vi.fn(),
  onNew: vi.fn(),
  onUnlink: vi.fn(),
};

describe("Akce plánu na gradientní kartě", () => {
  it("Přiřadit i Nový použijí kontrastní obrysovou variantu", () => {
    render(<LessonPlanActions hasPlan={false} dateLabel="23. 11." onColor {...handlers} />);
    for (const name of [/Přiřadit plán hodiny/, /Nový plán hodiny/]) {
      const button = screen.getByRole("button", { name });
      expect(button.className).toContain("border-primary-foreground");
      expect(button.className).toContain("text-primary-foreground");
      expect(button.className).toContain("bg-foreground/35");
      expect(button.className).toContain("focus-visible:ring-background");
    }
  });

  it("mimo barevnou kartu zůstane původní ghost varianta", () => {
    render(<LessonPlanActions hasPlan={false} dateLabel="24. 11." {...handlers} />);
    const button = screen.getByRole("button", { name: /Přiřadit plán hodiny/ });
    expect(button.className).not.toContain("border-primary-foreground");
    expect(button.className).toContain("hover:bg-muted");
  });
});
