import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BlockStyleControls from "@/components/admin/block-editors/BlockStyleControls";
import type { Block } from "@/lib/textbook-config";

const block = (props: Record<string, any> = {}): Block =>
  ({ id: "p1", type: "paragraph", visible: true, props: { text: "<p>Ahoj</p>", ...props } }) as Block;

describe("sjednocená volba barvy", () => {
  it("panel vlastností už nenabízí druhou cestu k barvě textu", () => {
    render(<BlockStyleControls block={block()} onChange={vi.fn()} />);
    expect(screen.queryByText("Barva textu")).toBeNull();
    expect(screen.getByText("Pozadí bloku")).toBeTruthy();
  });

  it("vlastní barva pozadí se uloží z plné palety", () => {
    const onChange = vi.fn();
    render(<BlockStyleControls block={block({ backgroundStyle: "note" })} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Vlastní barva pozadí"));
    expect(screen.getAllByText("Neutrální").length).toBeGreaterThan(1);
    expect(screen.getByText("Vlastní barva")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Modrá"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ backgroundColor: "#2563eb", backgroundStyle: null }),
    );
  });
});
