import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import PresentationCompactFormatToolbar from "@/components/presentation/editor/PresentationCompactFormatToolbar";
import type { Block } from "@/lib/textbook-config";

const block = { id: "text-1", type: "paragraph", visible: true, frame: { x: 10, y: 10, w: 60, h: 20 }, props: { text: "Ověření" } } as Block;
const base = { block, framed: true, onChangeProps: vi.fn(), onMove: vi.fn(), onDelete: vi.fn() };

describe("kompaktní formátovací lišta", () => {
  it("nabídne B/I/U s přístupnými názvy a zachová pokročilé akce v Další", () => {
    const onChangeProps = vi.fn();
    render(<PresentationCompactFormatToolbar {...base} onChangeProps={onChangeProps} onCopyBlock={vi.fn()} onCopyStyle={vi.fn()} onChangeLayer={vi.fn()} />);
    expect(document.querySelector(".deck-compact-format")).toBeTruthy();
    for (const name of ["Písmo a velikost", "Tučně", "Kurzíva", "Podtržení", "Barva textu", "Pozadí boxu", "Animace", "Vrstvy", "Duplikovat prvek", "Další možnosti"]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
    fireEvent.click(screen.getByRole("button", { name: "Podtržení" }));
    expect(onChangeProps).toHaveBeenCalledWith(expect.objectContaining({ underline: true }));
    fireEvent.click(screen.getByRole("button", { name: "Další možnosti" }));
    expect(screen.getByRole("button", { name: "Kopírovat styl" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Smazat prvek" })).toBeTruthy();
  });

  it("u víceprvkového výběru zachová zarovnání, rozmístění a skupiny", () => {
    render(<PresentationCompactFormatToolbar {...base} selectedCount={2} onAlignGroup={vi.fn()} onDistribute={vi.fn()} onGroup={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Zarovnat vlevo podle výběru" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Další možnosti" }));
    expect(screen.getByRole("button", { name: "Rozmístit vodorovně" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Spojit do skupiny" })).toBeTruthy();
  });
});
