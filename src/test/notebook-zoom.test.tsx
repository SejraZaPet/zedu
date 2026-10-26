import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import NotebookCanvas from "@/components/notebook/NotebookCanvas";

beforeEach(() => {
  localStorage.clear();
  (globalThis as any).ResizeObserver = class {
    observe() {} unobserve() {} disconnect() {}
  };
});

const content = { strokes: [], textBoxes: [], images: [] } as any;
const renderCanvas = (extra: any = {}) =>
  render(<NotebookCanvas ownerId="u" content={content} backgroundStyle="blank" onChange={() => {}} {...extra} />);

describe("přiblížení stránky sešitu", () => {
  it("tlačítka přiblížit/oddálit/obnovit mění velikost stránky", () => {
    renderCanvas();
    const stage = screen.getByTestId("nb-stage");
    expect(stage.style.width).toBe("100%");
    fireEvent.click(screen.getByRole("button", { name: "Přiblížit stránku" }));
    expect(stage.style.width).toBe("125%");
    fireEvent.click(screen.getByRole("button", { name: "Obnovit velikost 100 %" }));
    expect(stage.style.width).toBe("100%");
    fireEvent.click(screen.getByRole("button", { name: "Oddálit stránku" }));
    expect(stage.style.width).toBe("75%");
  });

  it("velikost se pamatuje v localStorage a drží meze 50–250 %", () => {
    localStorage.setItem("bezli.notebook.zoom", "1.5");
    const a = renderCanvas();
    expect(screen.getByTestId("nb-stage").style.width).toBe("150%");
    a.unmount();
    localStorage.setItem("bezli.notebook.zoom", "99");
    renderCanvas();
    expect(screen.getByTestId("nb-stage").style.width).toBe("250%");
  });

  it("při přiblížení nad 100 % je stránka v posuvné oblasti", () => {
    renderCanvas();
    fireEvent.click(screen.getByRole("button", { name: "Přiblížit stránku" }));
    expect(screen.getByTestId("nb-zoom-scroll").className).toContain("overflow-auto");
  });

  it("ovládání je dostupné i v režimu jen pro čtení", () => {
    renderCanvas({ readOnly: true });
    expect(screen.getByRole("button", { name: "Přiblížit stránku" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Oddálit stránku" })).toBeTruthy();
  });
});
