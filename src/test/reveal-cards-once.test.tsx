import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import RevealCardsActivity from "@/components/activities/RevealCardsActivity";

describe("RevealCardsActivity", () => {
  it("reports completion only once when cards are closed and reopened", () => {
    const onComplete = vi.fn();
    render(<RevealCardsActivity cards={[{ title: "A", content: "a" }]} onComplete={onComplete} />);
    const btn = screen.getByText("A");
    fireEvent.click(btn); fireEvent.click(btn); fireEvent.click(btn);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(1, 1);
  });
});
