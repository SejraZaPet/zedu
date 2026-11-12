import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import StartActivityPanel from "@/components/live/StartActivityPanel";
import AwaitingStartNotice from "@/components/live/AwaitingStartNotice";
import ActivityStartModeToggle from "@/components/live/ActivityStartModeToggle";
import { getActivityStartPref, setActivityStartPref, ACTIVITY_START_PREF_KEY } from "@/lib/activity-start-pref";
import { isAwaitingStart } from "@/lib/live-timing";

const slide = { type: "activity", activitySpec: { title: "Studená kuchyně", question: "Q?" } };

describe("panel Spustit aktivitu", () => {
  it("armedQuestion na aktivním slidu = čeká na spuštění", () => {
    expect(isAwaitingStart({ activityStartMode: "manual", armedQuestion: 2 }, slide, 2)).toBe(true);
    expect(isAwaitingStart({ activityStartMode: "manual" }, slide, 2)).toBe(false);
  });
  it("zobrazí název, počet žáků a spustí kliknutím i Enterem", () => {
    const onStart = vi.fn();
    render(<StartActivityPanel slide={slide} playerCount={7} onStart={onStart} />);
    expect(screen.getByTestId("start-activity").textContent).toContain("Spustit aktivitu: Studená kuchyně");
    expect(screen.getByText(/Žáci čekají \(7\)/)).toBeTruthy();
    fireEvent.click(screen.getByTestId("start-activity"));
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onStart).toHaveBeenCalledTimes(2);
  });
  it("Enter v textovém poli aktivitu nespustí", () => {
    const onStart = vi.fn();
    render(<><input data-testid="i" /><StartActivityPanel slide={slide} onStart={onStart} /></>);
    fireEvent.keyDown(screen.getByTestId("i"), { key: "Enter" });
    expect(onStart).not.toHaveBeenCalled();
  });
  it("žák i projektor vidí jasnou zprávu s názvem", () => {
    render(<AwaitingStartNotice slide={slide} variant="student" />);
    expect(screen.getByText("Aktivita „Studená kuchyně“ začne, až ji učitel spustí.")).toBeTruthy();
  });
});

describe("přepínač ručně/automaticky", () => {
  beforeEach(() => localStorage.clear());
  it("výchozí je ručně", () => expect(getActivityStartPref()).toBe("manual"));
  it("zapamatuje poslední volbu", () => {
    render(<ActivityStartModeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "automaticky" }));
    expect(localStorage.getItem(ACTIVITY_START_PREF_KEY)).toBe("auto");
    expect(getActivityStartPref()).toBe("auto");
  });
  it("chyba úložiště nespadne a vrací ručně", () => {
    const g = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("x"); });
    const s = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("x"); });
    expect(() => setActivityStartPref("auto")).not.toThrow();
    expect(getActivityStartPref()).toBe("manual");
    g.mockRestore(); s.mockRestore();
  });
});
