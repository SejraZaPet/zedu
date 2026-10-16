import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import FillBlanksActivity from "@/components/activities/FillBlanksActivity";

afterEach(cleanup);
const choose = (word: string, gap: number) => {
  fireEvent.click(within(screen.getByRole("group", { name: "Banka slov" })).getByRole("button", { name: word }));
  fireEvent.click(screen.getByRole("button", { name: `Mezera ${gap}` }));
};

describe("banka slov doplňování", () => {
  it("starší text nabídne jednu variantu a falešná slova, uloží stejné answers", () => {
    const complete = vi.fn();
    render(<FillBlanksActivity text="Jím {{ovoce/jablko}} a {{zeleninu}}." distractors={["kámen", " "]} onComplete={complete} />);
    expect(screen.queryByRole("button", { name: "jablko" })).not.toBeInTheDocument();
    choose("ovoce", 1);
    expect(screen.getByRole("button", { name: "ovoce" })).toBeDisabled();
    choose("kámen", 2);
    fireEvent.click(screen.getByRole("button", { name: "Zkontrolovat" }));
    expect(complete.mock.calls[0]?.slice(0, 2)).toEqual([1, 2]);
    expect(complete.mock.calls[0]?.[2]).toEqual([
      expect.objectContaining({ index: 0, studentAnswer: "ovoce", correctAnswer: "ovoce / jablko", correct: true }),
      expect.objectContaining({ index: 1, studentAnswer: "kámen", correctAnswer: "zeleninu", correct: false }),
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Zkontrolovat odpovědi" }));
    expect(screen.getByRole("list", { name: "Kontrola odpovědí" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Zkusit znovu" }));
    expect(screen.getByRole("button", { name: "ovoce" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Mezera 1" })).toHaveTextContent("…");
  });
  it("vrácení a nahrazení uvolní původní slovo", () => {
    render(<FillBlanksActivity text="{{a}} {{b}}" />);
    choose("a", 1);
    fireEvent.click(screen.getByRole("button", { name: "Vrátit slovo z mezery 1" }));
    expect(screen.getByRole("button", { name: "a" })).toBeEnabled();
    choose("a", 1);
    fireEvent.click(screen.getByRole("button", { name: "b" }));
    fireEvent.click(screen.getByRole("button", { name: "Mezera 1: a" }));
    expect(screen.getByRole("button", { name: "a" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "b" })).toBeDisabled();
  });
  it("tokeny zachovávají více výskytů stejného slova", () => {
    render(<FillBlanksActivity tokens={[{ type: "blank", answer: "ano" }, { type: "text", value: " / " }, { type: "blank", answer: "ano" }]} />);
    const words = screen.getAllByRole("button", { name: "ano" });
    fireEvent.click(words[0]);
    fireEvent.click(screen.getByRole("button", { name: "Mezera 1" }));
    expect(words[0]).toBeDisabled();
    expect(words[1]).toBeEnabled();
    fireEvent.click(words[1]);
    fireEvent.click(screen.getByRole("button", { name: "Mezera 2" }));
    expect(screen.getByRole("button", { name: "Zkontrolovat" })).toBeEnabled();
  });
  it("vypnutí ponechá původní psaní a normalizaci", () => {
    const complete = vi.fn();
    render(<FillBlanksActivity text="{{žlutá}}" showWordBank={false} diacriticSensitive={false} onComplete={complete} />);
    expect(screen.queryByRole("group", { name: "Banka slov" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "ZLUTA" } });
    fireEvent.click(screen.getByRole("button", { name: "Zkontrolovat" }));
    expect(complete.mock.calls[0]?.slice(0, 2)).toEqual([1, 1]);
  });
});