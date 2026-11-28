import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
import RaisedHandsIndicator, { RAISED_HANDS_POSITION_STYLE } from "@/components/game/RaisedHandsIndicator";

describe("RaisedHandsIndicator position", () => {
  it("sits top-right below the teacher bar, never in the bottom corner of the add-slide button", () => {
    render(<RaisedHandsIndicator players={[{ id: "p1", nickname: "Petr", hand_raised: true, hand_raised_at: "2026-01-01" } as any]} />);
    const box = screen.getByTestId("raised-hands-indicator");
    expect(RAISED_HANDS_POSITION_STYLE.top).toContain("63px");
    expect("bottom" in RAISED_HANDS_POSITION_STYLE).toBe(false);
    expect(box.style.bottom).toBe("");
    expect(box.className).not.toMatch(/bottom-/);
    expect(screen.getByRole("button", { name: "Zvednuté ruce: 1" })).toBeTruthy();
  });
});
