import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BlockEditor from "@/components/admin/BlockEditor";
import type { Block } from "@/lib/textbook-config";

const child = (id: string) =>
  ({ id, type: "paragraph", visible: true, props: { text: "<p>Ahoj</p>" } }) as Block;

const group = (mode: "columns" | "free"): Block =>
  ({
    id: "g1",
    type: "slide_group",
    visible: true,
    props: { mode, layout: 2, children: [child("c1"), child("c2")] },
  }) as Block;

describe("vlastnosti bloku uvnitř spojeného snímku", () => {
  for (const mode of ["columns", "free"] as const) {
    it(`režim ${mode}: dítě má panel s velikostí, fontem i pozadím`, () => {
      render(<BlockEditor blocks={[group(mode)]} onChange={vi.fn()} />);
      const btns = screen.getAllByLabelText("Vlastnosti bloku Text");
      expect(btns.length).toBe(2);
      fireEvent.click(btns[0]);
      expect(screen.getByText("Velikost")).toBeTruthy();
      expect(screen.getByText("Font")).toBeTruthy();
      expect(screen.getByText("Pozadí bloku")).toBeTruthy();
      expect(screen.getByLabelText("Vlastní barva pozadí")).toBeTruthy();
    });
  }
});
