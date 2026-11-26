import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import ShapeRenderer from "@/components/blocks/ShapeRenderer";
import { resolveCornerRadiusPx } from "@/lib/shape-corner-radius";
import { importedCornerRadiusPx } from "@/lib/pptx-rich-import";

describe("resolveCornerRadiusPx", () => {
  it("poloměr v px se nemění při změně šířky ani výšky", () => {
    const p = { shapeKind: "rounded-rect", cornerRadiusPx: 20 };
    expect(resolveCornerRadiusPx(p, 200, 100)).toBe(20);
    expect(resolveCornerRadiusPx(p, 800, 100)).toBe(20);
    expect(resolveCornerRadiusPx(p, 200, 600)).toBe(20);
  });
  it("ořízne poloměr na polovinu kratší strany", () => {
    expect(resolveCornerRadiusPx({ shapeKind: "rounded-rect", cornerRadiusPx: 80 }, 400, 60)).toBe(30);
  });
  it("pilulka je vždy plně zaoblená", () => {
    expect(resolveCornerRadiusPx({ shapeKind: "pill", cornerRadiusPx: 4 }, 400, 60)).toBe(30);
  });
  it("starý tvar s borderRadius se přepočítá podle šířky jako dřív", () => {
    // dříve rx=30 jednotek ve viewBoxu 200 široké → 30 * 400/200 = 60 px vodorovně
    expect(resolveCornerRadiusPx({ shapeKind: "rounded-rect", borderRadius: 30 }, 400, 300)).toBe(60);
    expect(resolveCornerRadiusPx({ shapeKind: "rounded-rect" }, 400, 300)).toBe(60);
    expect(resolveCornerRadiusPx({ shapeKind: "rectangle" }, 400, 300)).toBe(12);
  });
  it("čtyřúhelník s cornerRadiusPx 0 má ostré rohy", () => {
    expect(resolveCornerRadiusPx({ shapeKind: "rectangle", cornerRadiusPx: 0 }, 400, 300)).toBe(0);
  });
});

describe("ShapeRenderer", () => {
  let size = { w: 400, h: 200 };
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => size.w);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(() => size.h);
    Object.defineProperty(SVGElement.prototype, "clientWidth", { configurable: true, get: () => size.w });
    Object.defineProperty(SVGElement.prototype, "clientHeight", { configurable: true, get: () => size.h });
  });
  afterEach(() => vi.restoreAllMocks());

  const rectOf = (c: HTMLElement) => c.querySelector("rect")!;

  it("kreslí kruhové rohy se stejným px poloměrem při různé velikosti", () => {
    size = { w: 400, h: 200 };
    const a = render(<ShapeRenderer fill shapeKind="rounded-rect" strokeWidth={0} cornerRadiusPx={24} />);
    expect(rectOf(a.container).getAttribute("rx")).toBe("24");
    expect(rectOf(a.container).getAttribute("ry")).toBe("24");
    expect(a.container.querySelector("svg")!.getAttribute("viewBox")).toBe("0 0 400 200");
    a.unmount();
    size = { w: 1200, h: 500 };
    const b = render(<ShapeRenderer fill shapeKind="rounded-rect" strokeWidth={0} cornerRadiusPx={24} />);
    expect(rectOf(b.container).getAttribute("rx")).toBe("24");
    expect(b.container.querySelector("svg")!.getAttribute("viewBox")).toBe("0 0 1200 500");
  });

  it("starý uložený tvar vykreslí stejný vodorovný poloměr jako dříve", () => {
    size = { w: 600, h: 300 };
    const { container } = render(<ShapeRenderer fill shapeKind="rounded-rect" strokeWidth={0} borderRadius={20} />);
    // dříve: rx=20 jednotek × (600/200) = 60 px
    expect(rectOf(container).getAttribute("rx")).toBe("60");
  });
});

describe("import PPTX roundRect", () => {
  it("převede adj na px podle kratší strany", () => {
    const doc = new DOMParser().parseFromString('<p:spPr xmlns:p="p" xmlns:a="a"><a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 25000"/></a:avLst></a:prstGeom></p:spPr>', "application/xml");
    // 50 % × 50 % scény 1600×900 → kratší strana 450 px; 25 % = 112.5
    expect(importedCornerRadiusPx(doc.documentElement, { w: 50, h: 50 })).toBe(112.5);
  });
});
