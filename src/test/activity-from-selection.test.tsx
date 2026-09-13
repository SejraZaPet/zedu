import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BlockEditor from "@/components/admin/BlockEditor";
import type { Block } from "@/lib/textbook-config";

const blocks: Block[] = [
  { id: "a", type: "paragraph", visible: true, props: { text: "Moučníky se připravují z těsta a náplní." } },
  { id: "b", type: "paragraph", visible: true, props: { text: "Listové těsto vzniká vrstvením tuku a těsta." } },
];

describe("aktivita z více vybraných bloků", () => {
  it("vloží aktivitu se spojeným textem za poslední vybraný blok", () => {
    let current: Block[] = blocks;
    const onChange = vi.fn((next: Block[]) => { current = next; });
    render(<BlockEditor blocks={current} onChange={onChange} />);

    const boxes = screen.getAllByRole("checkbox", { name: /vybrat blok/i });
    fireEvent.click(boxes[0]);
    fireEvent.click(boxes[1]);

    fireEvent.click(screen.getByRole("button", { name: /Vytvořit aktivitu z vybraných bloků/i }));

    expect(current).toHaveLength(3);
    expect(current[2].type).toBe("activity");
    const src = (current[2].props as any).aiSourceText as string;
    expect(src).toContain("Moučníky");
    expect(src).toContain("Listové těsto");
  });
});
