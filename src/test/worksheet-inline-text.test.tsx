import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { InlineText } from "@/components/worksheet/InlineText";
import LayoutBlockItem from "@/components/worksheet-items/LayoutBlockItem";

function Harness({ initial, onHistory }: { initial: string; onHistory: (v: string) => void }) {
  const [v, setV] = useState(initial);
  return <InlineText value={v} ariaLabel="Zadání úlohy" onCommit={(n) => { onHistory(n); setV(n); }} />;
}

describe("InlineText – úprava textu přímo v listu", () => {
  it("zapíše text až po dokončení úpravy a jen jednou (jeden krok zpět)", () => {
    const commit = vi.fn();
    render(<Harness initial="Stará" onHistory={commit} />);
    const box = screen.getByLabelText("Zadání úlohy");
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: "N" } });
    fireEvent.change(box, { target: { value: "Nová otázka" } });
    expect(commit).not.toHaveBeenCalled();
    fireEvent.blur(box);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith("Nová otázka");
  });

  it("Esc vrátí původní text a nic nezapíše", () => {
    const commit = vi.fn();
    render(<Harness initial="Původní" onHistory={commit} />);
    const box = screen.getByLabelText("Zadání úlohy") as HTMLTextAreaElement;
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: "Omyl" } });
    fireEvent.keyDown(box, { key: "Escape" });
    fireEvent.blur(box);
    expect(box.value).toBe("Původní");
    expect(commit).not.toHaveBeenCalled();
  });

  it("Enter v jednořádkovém poli úpravu ukončí a uloží", () => {
    const commit = vi.fn();
    render(<Harness initial="" onHistory={commit} />);
    const box = screen.getByLabelText("Zadání úlohy");
    box.focus();
    fireEvent.change(box, { target: { value: "Otázka" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(commit).toHaveBeenCalledWith("Otázka");
  });

  it("rozepsaný text se uloží i při odpojení (přepnutí položky / odchod)", () => {
    const commit = vi.fn();
    const { unmount } = render(<InlineText value="A" ariaLabel="x" onCommit={commit} />);
    fireEvent.change(screen.getByLabelText("x"), { target: { value: "AB" } });
    unmount();
    expect(commit).toHaveBeenCalledWith("AB");
  });

  it("nadpis sekce bez onEditText (žák, náhled) zůstává prostý nadpis bez pole", () => {
    const item: any = { id: "s1", type: "section_header", prompt: "Úvod", points: 0, answerSpace: { type: "none", heightMm: 0 } };
    const { container } = render(<LayoutBlockItem item={item} value={undefined} onChange={() => undefined} disabled showResults={false} />);
    expect(container.querySelector("textarea")).toBeNull();
    expect(container.textContent).toContain("Úvod");
  });

  it("pokyny s onEditText zapíší do stejného pole prompt", () => {
    const edit = vi.fn();
    const item: any = { id: "i1", type: "instruction_box", prompt: "Čti", points: 0, answerSpace: { type: "none", heightMm: 0 } };
    render(<LayoutBlockItem item={item} value={undefined} onChange={() => undefined} disabled showResults={false} onEditText={edit} />);
    const box = screen.getByLabelText("Text pokynů");
    fireEvent.change(box, { target: { value: "Čti pozorně" } });
    fireEvent.blur(box);
    expect(edit).toHaveBeenCalledWith("prompt", "Čti pozorně");
  });

});
