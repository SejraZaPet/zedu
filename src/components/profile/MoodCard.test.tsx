import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import MoodCard from "./MoodCard";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-a" }, loading: false }),
}));

describe("Vzhled profilu", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.dataset.mood = "bezli";
  });

  it("nabídne tři radio nálady a okamžitě uloží volbu jen pro přihlášeného uživatele", () => {
    render(<MoodCard />);
    expect(screen.getByRole("radiogroup", { name: "Barevná nálada" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);

    fireEvent.click(screen.getByRole("radio", { name: /Natural mood/ }));

    expect(screen.getByRole("radio", { name: /Natural mood/ })).toBeChecked();
    expect(document.documentElement.dataset.mood).toBe("natural");
    expect(window.localStorage.getItem("Bezli:mood")).toBe("natural");
    expect(window.localStorage.getItem("Bezli:mood-owner")).toBe("user-a");
  });

  it("radio skupina reaguje na klávesnici", async () => {
    render(<MoodCard />);
    const bezli = screen.getByRole("radio", { name: /^Bezli/ });
    bezli.focus();
    act(() => { fireEvent.keyDown(bezli, { key: "ArrowDown" }); });
    const minimal = screen.getByRole("radio", { name: /Minimal mood/ });
    await waitFor(() => expect(minimal).toHaveFocus());
    act(() => { fireEvent.keyDown(minimal, { key: " " }); });
    await waitFor(() => expect(minimal).toBeChecked());
    expect(document.documentElement.dataset.mood).toBe("minimal");
  });
});
