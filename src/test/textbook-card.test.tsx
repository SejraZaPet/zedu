import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import TextbookCard from "@/components/textbooks/TextbookCard";

afterEach(cleanup);

describe("textbook card interaction", () => {
  it("opens the whole card by click, Enter and Space without stealing nested actions", () => {
    const onOpen = vi.fn();
    const onCopy = vi.fn();
    render(
      <TextbookCard onOpen={onOpen} openLabel="Otevřít učebnici Technologie přípravy pokrmů">
        <h3>Technologie přípravy pokrmů</h3>
        <button
          onClick={(event) => {
            event.stopPropagation();
            onCopy();
          }}
        >
          Kopírovat kód
        </button>
      </TextbookCard>,
    );

    const card = screen.getByRole("link", { name: "Otevřít učebnici Technologie přípravy pokrmů" });
    expect(card).toHaveAttribute("tabindex", "0");
    fireEvent.click(screen.getByText("Technologie přípravy pokrmů"));
    expect(onOpen).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(card, { key: "Enter" });
    fireEvent.keyDown(card, { key: " " });
    expect(onOpen).toHaveBeenCalledTimes(3);

    const copy = screen.getByRole("button", { name: "Kopírovat kód" });
    fireEvent.click(copy);
    fireEvent.keyDown(copy, { key: "Enter" });
    fireEvent.keyDown(copy, { key: " " });
    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledTimes(3);
  });
});
