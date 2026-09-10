import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import BlockEditor from "@/components/admin/BlockEditor";
import { groupBlocksIntoSlide, setGroupMode } from "@/lib/slide-groups";
import type { Block } from "@/lib/textbook-config";

const b = (id: string): Block => ({ id, type: "paragraph", visible: true, props: { text: id } });

describe("volné rozmístění: úchyt výšky karty", () => {
  it("každá karta má stejný spodní úchyt jako ve sloupcích", () => {
    const grouped = groupBlocksIntoSlide([b("p1"), b("p2")], ["p1", "p2"], 2);
    const free = setGroupMode(grouped, grouped[0].id, "free");
    const { getAllByLabelText } = render(<BlockEditor blocks={free} onChange={vi.fn()} />);
    expect(getAllByLabelText("Změnit výšku karty").length).toBe(2);
  });
});
