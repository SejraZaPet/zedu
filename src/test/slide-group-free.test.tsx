import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  autoGridFrames,
  getGroupChildFrames,
  getGroupMode,
  groupBlocksIntoSlide,
  setGroupChildFrame,
  setGroupMode,
} from "@/lib/slide-groups";
import { blocksToSlides } from "@/lib/blocks-to-slides";
import { LessonBlock } from "@/components/LessonBlockRenderer";
import type { Block } from "@/lib/textbook-config";

const b = (id: string, type: any, props: any = {}): Block => ({ id, type, visible: true, props });

const base = [
  b("p1", "paragraph", { text: "A" }),
  b("p2", "paragraph", { text: "B" }),
];

describe("volné rozmístění ve snímku", () => {
  it("výchozí režim je Sloupce (zpětná kompatibilita)", () => {
    const grouped = groupBlocksIntoSlide(base, ["p1", "p2"], 2);
    expect(getGroupMode(grouped[0])).toBe("columns");
    const slides = blocksToSlides(grouped, "Lekce");
    expect(slides.find((s: any) => s.layout === "two-cols")).toBeTruthy();
  });

  it("přepnutí na volné rozmístění dopočítá rovnoměrnou mřížku", () => {
    const grouped = groupBlocksIntoSlide(base, ["p1", "p2"], 2);
    const g = setGroupMode(grouped, grouped[0].id, "free");
    expect(getGroupMode(g[0])).toBe("free");
    const frames = getGroupChildFrames(g[0]);
    expect(frames.p1.x).toBeLessThan(frames.p2.x);
    expect(autoGridFrames(2)).toHaveLength(2);

  });

  it("uložené x/y/w/h se přenese do snímku prezentace", () => {
    const grouped0 = groupBlocksIntoSlide(base, ["p1", "p2"], 2);
    const gid = grouped0[0].id;
    let g = setGroupMode(grouped0, gid, "free");
    g = setGroupChildFrame(g, gid, "p1", { x: 5, y: 10, w: 40, h: 30 });
    const slides = blocksToSlides(g, "Lekce");
    const free = slides.find((s: any) => s.layout === "free") as any;
    expect(free).toBeTruthy();
    expect(free.blocks.find((x: any) => x.id === "p1").frame).toMatchObject({ x: 5, y: 10, w: 40, h: 30 });
  });

  it("žákovské zobrazení použije absolutní pozice", () => {
    const grouped0 = groupBlocksIntoSlide(base, ["p1", "p2"], 2);
    const gid = grouped0[0].id;
    let g = setGroupMode(grouped0, gid, "free");
    g = setGroupChildFrame(g, gid, "p1", { x: 5, y: 10, w: 40, h: 30 });
    const { container } = render(<LessonBlock block={g[0]} />);
    const item = container.querySelector("[data-free-frame-item='p1']") as HTMLElement;
    expect(item.style.left).toBe("5%");
    expect(item.style.width).toBe("40%");
  });
});
