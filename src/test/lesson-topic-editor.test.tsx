import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LessonTopicEditor } from "@/components/teacher/LessonTopicEditor";

describe("LessonTopicEditor", () => {
  it("bez tématu: klik otevře editor a uloží text", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<LessonTopicEditor topic={null} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Přidat téma hodiny" }));
    fireEvent.change(screen.getByLabelText("Téma hodiny", { selector: "input" }), { target: { value: " Opakování " } });
    fireEvent.click(screen.getByRole("button", { name: "Uložit" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith("Opakování"));
  });
  it("Smazat téma uloží null", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<LessonTopicEditor topic="Zlomky" onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: /Upravit téma hodiny/ }));
    fireEvent.click(screen.getByRole("button", { name: /Smazat téma/ }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(null));
  });
  it("Esc a Zrušit nic neuloží", () => {
    const onSave = vi.fn();
    render(<LessonTopicEditor topic={null} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Přidat téma hodiny" }));
    fireEvent.keyDown(screen.getByLabelText("Téma hodiny", { selector: "input" }), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Přidat téma hodiny" }));
    fireEvent.click(screen.getByRole("button", { name: "Zrušit" }));
    expect(onSave).not.toHaveBeenCalled();
  });
  it("při chybě uložení editor zůstane otevřený s textem", async () => {
    const onSave = vi.fn().mockResolvedValue(false);
    render(<LessonTopicEditor topic={null} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Přidat téma hodiny" }));
    const input = screen.getByLabelText("Téma hodiny", { selector: "input" });
    fireEvent.change(input, { target: { value: "X" } });
    fireEvent.click(screen.getByRole("button", { name: "Uložit" }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(screen.getByDisplayValue("X")).toBeTruthy();
  });
});
