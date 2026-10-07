import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LessonCompletionControl } from "@/components/lesson/LessonSuccessSummary";

describe("LessonCompletionControl", () => {
  it("učiteli zobrazí neaktivní tlačítko bez ukládání", () => {
    const onComplete = vi.fn();
    render(
      <LessonCompletionControl
        teacher
        allRequiredDone
        completedCount={3}
        requiredCount={3}
        onComplete={onComplete}
      />,
    );
    const button = screen.getByRole("button", { name: /označit lekci jako dokončenou/i });
    expect(button).toBeDisabled();
    expect(screen.getByText("Tlačítko je jen pro žáky")).toBeInTheDocument();
    fireEvent.click(button);
    expect(onComplete).not.toHaveBeenCalled();
  });
});