import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import PollActivity from "@/components/activities/PollActivity";

const options = [
  { id: "a", text: "[TEST] Spolupráce" },
  { id: "b", text: "[TEST] Praxe" },
  { id: "c", text: "[TEST] Inspirace" },
  { id: "d", text: "[TEST] Zvědavost" },
];

describe("PollActivity – výběr odpovědi", () => {
  it("celý řádek přepne výběr a zpřístupní hlasování", () => {
    render(<PollActivity question="[TEST] Otázka" options={options} />);
    const first = screen.getByRole("button", { name: "[TEST] Spolupráce" });
    const second = screen.getByRole("button", { name: "[TEST] Praxe" });
    const vote = screen.getByRole("button", { name: "Hlasovat" });

    expect(vote).toBeDisabled();
    fireEvent.click(first);
    expect(first).toHaveAttribute("aria-pressed", "true");
    expect(vote).toBeEnabled();

    fireEvent.click(second);
    expect(first).toHaveAttribute("aria-pressed", "false");
    expect(second).toHaveAttribute("aria-pressed", "true");
  });

  it("u více odpovědí umožní vybrat i odznačit jednotlivé možnosti", () => {
    render(<PollActivity question="[TEST] Otázka" options={options} allowMultiple />);
    const first = screen.getByRole("button", { name: "[TEST] Spolupráce" });
    const second = screen.getByRole("button", { name: "[TEST] Praxe" });

    fireEvent.click(first);
    fireEvent.click(second);
    expect(first).toHaveAttribute("aria-pressed", "true");
    expect(second).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(first);
    expect(first).toHaveAttribute("aria-pressed", "false");
    expect(second).toHaveAttribute("aria-pressed", "true");
  });
});
