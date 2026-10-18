import { useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PhaseCountdownButton } from "@/components/classroom/PhaseCountdownButton";
import { ClassroomToolsOverlay, type ClassroomToolRequest } from "@/components/classroom/ClassroomToolsOverlay";

vi.mock("@/components/classroom/PeopleTools", () => ({ PeopleTool: () => null }));
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

function PlanHarness() {
  const [text, setText] = useState("Rozepsaný plán");
  const [request, setRequest] = useState<ClassroomToolRequest | null>(null);
  return <><input aria-label="Text plánu" value={text} onChange={e => setText(e.target.value)} /><PhaseCountdownButton timeMin="2" onOpen={setRequest} /><ClassroomToolsOverlay request={request} onClose={() => setRequest(null)} /></>;
}

describe("plan tools", () => {
  it("starts the phase countdown immediately and keeps unsaved text after Escape", () => {
    vi.useFakeTimers();
    render(<PlanHarness />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "[TEST] Neuložená změna" } });
    fireEvent.click(screen.getByRole("button", { name: "Spustit odpočet" }));
    expect(screen.getByRole("timer")).toHaveTextContent("02:00");
    act(() => { vi.advanceTimersByTime(1120); });
    expect(screen.getByRole("timer")).toHaveTextContent("01:58");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("[TEST] Neuložená změna");
    fireEvent.click(screen.getByRole("button", { name: "Spustit odpočet" }));
    expect(screen.getByRole("timer")).toHaveTextContent("02:00");
  });
  it("does not exit the underlying teacher fullscreen when closed", () => {
    const underlying = document.createElement("div");
    document.body.append(underlying);
    vi.spyOn(document, "fullscreenElement", "get").mockReturnValue(underlying);
    const exit = vi.fn();
    Object.defineProperty(document, "exitFullscreen", { configurable: true, value: exit });
    const close = vi.fn();
    render(<ClassroomToolsOverlay request={{ id: "stopwatch" }} onClose={close} />);
    fireEvent.click(screen.getByRole("button", { name: "Zavřít" }));
    expect(close).toHaveBeenCalledTimes(1);
    expect(exit).not.toHaveBeenCalled();
    underlying.remove();
  });
});