import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  alignFrameToStage,
  alignFramesTogether,
  distributeFrames,
  fillStageFrame,
  boundingFrame,
  makeGroupBlock,
  snapFrame,
  snapFrameToGrid,
  ungroupBlock,
} from "@/lib/block-frame";
import { SlideBody } from "@/components/admin/SlideCanvas";

describe("zarovnávání a přichytávání rámců", () => {
  it("přichytí k svislému středu snímku", () => {
    const res = snapFrame({ x: 24.6, y: 40, w: 50, h: 10 }, "move", []);
    expect(res.frame.x).toBe(25);
    expect(res.guides.v).toContain(50);
  });

  it("přichytí k levému okraji jiného prvku", () => {
    const res = snapFrame({ x: 30.4, y: 70, w: 20, h: 10 }, "move", [{ x: 30, y: 10, w: 20, h: 10 }]);
    expect(res.frame.x).toBe(30);
  });

  it("bez blízké linky nevrací vodítka", () => {
    const res = snapFrame({ x: 33, y: 33, w: 10, h: 10 }, "move", []);
    expect(res.guides.v).toHaveLength(0);
    expect(res.guides.h).toHaveLength(0);
  });

  it("mřížka zaokrouhlí na celá procenta", () => {
    expect(snapFrameToGrid({ x: 12.4, y: 8.7, w: 30, h: 20 }, "move", 1)).toMatchObject({ x: 12, y: 9 });
  });

  it("zarovná prvek vůči snímku", () => {
    expect(alignFrameToStage({ x: 12, y: 5, w: 40, h: 10 }, "hcenter").x).toBe(30);
    expect(alignFrameToStage({ x: 12, y: 5, w: 40, h: 10 }, "bottom").y).toBe(90);
    expect(fillStageFrame()).toEqual({ x: 0, y: 0, w: 100, h: 100 });
  });

  it("zarovná výběr podle bounding boxu", () => {
    const frames = [
      { x: 10, y: 10, w: 20, h: 10 },
      { x: 40, y: 30, w: 20, h: 10 },
    ];
    expect(boundingFrame(frames)).toMatchObject({ x: 10, y: 10, w: 50, h: 30 });
    expect(alignFramesTogether(frames, "left").every((f) => f.x === 10)).toBe(true);
  });

  it("rozmístí prvky se stejnými mezerami", () => {
    const frames = [
      { x: 0, y: 0, w: 10, h: 10 },
      { x: 30, y: 0, w: 10, h: 10 },
      { x: 90, y: 0, w: 10, h: 10 },
    ];
    const out = distributeFrames(frames, "h");
    expect(out[1].x).toBe(45);
  });
});

describe("skupiny prvků", () => {
  const a = { id: "a", type: "heading", frame: { x: 10, y: 10, w: 20, h: 10 }, props: { text: "Alfa" } } as any;
  const b = { id: "b", type: "paragraph", frame: { x: 40, y: 30, w: 20, h: 10 }, props: { text: "Beta" } } as any;

  it("spojí prvky a zachová relativní pozice", () => {
    const group = makeGroupBlock([a, b], "g1");
    expect(group.type).toBe("group");
    expect(group.frame).toMatchObject({ x: 10, y: 10, w: 50, h: 30 });
    expect(group.props.children[0].frame).toMatchObject({ x: 0, y: 0 });
    const restored = ungroupBlock(group);
    expect(restored[1].frame).toMatchObject({ x: 40, y: 30, w: 20, h: 10 });
  });

  it("skupinu vykreslí i mimo editor (projektor / žák)", () => {
    const group = makeGroupBlock([a, b], "g1");
    render(<SlideBody slide={{ blocks: [group], projector: { headline: "Snímek" } }} />);
    expect(screen.getByText("Alfa")).toBeTruthy();
    expect(screen.getByText("Beta")).toBeTruthy();
  });
});
