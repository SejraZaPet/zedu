import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TeacherNotesPanel from "@/components/live/TeacherNotesPanel";
import SlideCanvas from "@/components/admin/SlideCanvas";

const baseProps = {
  target: { slideId: "s1", index: 0 },
  initialValue: "",
  nextTitle: "Další výklad",
  collapsed: false,
  onCollapsedChange: vi.fn(),
  mobileOpen: false,
  onMobileOpenChange: vi.fn(),
  onNext: vi.fn(),
};

describe("TeacherNotesPanel", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("automaticky uloží text po 700 ms a ukáže Uloženo", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<TeacherNotesPanel {...baseProps} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText("Poznámky řečníka k aktuálnímu slidu"), { target: { value: "[TEST] Zmínit domácí příklad" } });
    expect(onSave).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(onSave).toHaveBeenCalledWith(baseProps.target, "[TEST] Zmínit domácí příklad");
    expect(screen.getByText("Uloženo")).toBeInTheDocument();
  });

  it("nabídne opakování při chybě bez ztráty textu", async () => {
    const onSave = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    render(<TeacherNotesPanel {...baseProps} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText("Poznámky řečníka k aktuálnímu slidu"), { target: { value: "[TEST] Zachovat text" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(screen.getByText("Poznámku se nepodařilo uložit.")).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Zkusit znovu" })); });
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText("Poznámky řečníka k aktuálnímu slidu")).toHaveValue("[TEST] Zachovat text");
  });

  it("sbalení ohlásí rodiči a další slide nejprve uloží", async () => {
    const onCollapsedChange = vi.fn();
    const onNext = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<TeacherNotesPanel {...baseProps} onSave={onSave} onNext={onNext} onCollapsedChange={onCollapsedChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Sbalit poznámky řečníka" }));
    expect(onCollapsedChange).toHaveBeenCalledWith(true);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Další výklad/ })); });
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});

describe("soukromí poznámek", () => {
  it("společné plátno projektoru poznámku nevykreslí", () => {
    render(<SlideCanvas slide={{ slideId: "s1", type: "explain", projector: { headline: "Veřejný nadpis", body: "Veřejný text" }, teacherNotes: "[TEST] Soukromá poznámka", blocks: [] }} />);
    expect(screen.queryByText("[TEST] Soukromá poznámka")).not.toBeInTheDocument();
  });
});
