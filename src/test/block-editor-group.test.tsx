import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BlockEditor from "@/components/admin/BlockEditor";
import type { Block } from "@/lib/textbook-config";

const blocks: Block[] = [
  { id: "img", type: "paragraph", visible: true, props: { text: "Text" } },
  { id: "tab", type: "table", visible: true, props: { headers: ["A"], rows: [["1"]] } },
];

describe("spojování bloků v editoru lekce", () => {
  it("vybere dva bloky, spojí je do snímku a zpět rozdělí", () => {
    let current: Block[] = blocks;
    const onChange = vi.fn((next: Block[]) => { current = next; });
    const { rerender } = render(<BlockEditor blocks={current} onChange={onChange} />);

    const boxes = screen.getAllByRole("checkbox", { name: /vybrat blok/i });
    expect(boxes.length).toBe(2);
    fireEvent.click(boxes[0]);
    fireEvent.click(boxes[1]);

    fireEvent.click(screen.getByRole("button", { name: /Spojit do jednoho snímku/i }));
    expect(current).toHaveLength(1);
    expect(current[0].type).toBe("slide_group");

    rerender(<BlockEditor blocks={current} onChange={onChange} />);
    expect(screen.getByText("Snímek")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Rozdělit/i }));
    expect(current.map((b) => b.id)).toEqual(["img", "tab"]);
  });
});
