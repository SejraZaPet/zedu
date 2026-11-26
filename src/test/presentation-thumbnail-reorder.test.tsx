import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import PresentationThumbnails from "@/components/presentation/editor/PresentationThumbnails";

vi.mock("@/components/admin/SlideCanvas", () => ({
  STAGE_W: 960, STAGE_H: 540, SlideBody: () => null,
}));
vi.mock("@/components/presentation/editor/SlideInsertMenu", () => ({ default: () => null }));
vi.mock("@/components/presentation/editor/SlideTransitionPopover", () => ({ default: () => null }));

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function setup() {
  const onMove = vi.fn();
  const onDelete = vi.fn();
  const onSelect = vi.fn();
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
    const index = Number(this.getAttribute("data-slide-thumbnail") ?? this.getAttribute("data-testid")?.replace("slide-thumbnail-", "") ?? 0);
    const x = index * 184;
    return { x, y: 0, left: x, top: 0, right: x + 136, bottom: 76, width: 136, height: 76, toJSON: () => ({}) };
  });
  render(<PresentationThumbnails
    slides={[{ slideId: "a", blocks: [] }, { slideId: "b", blocks: [] }, { slideId: "c", blocks: [] }]}
    activeIndex={0} themeId="minimal" onMove={onMove} onDelete={onDelete} onSelect={onSelect}
    onAdd={vi.fn()} onDuplicate={vi.fn()} onMoveEdge={vi.fn()} onToggleHidden={vi.fn()}
    onInsert={vi.fn()} onTransitionChange={vi.fn()} onApplyTransitionAll={vi.fn()}
  />);
  return { onMove, onDelete, onSelect, first: screen.getByRole("button", { name: /Otevřít slide 1/ }) };
}

describe("přesouvání miniatur prezentace", () => {
  it("přetažení myší předá přesun prvního slidu za druhý", async () => {
    class TestPointerEvent extends MouseEvent {
      pointerId = 1;
      isPrimary = true;
      pointerType = "mouse";
    }
    vi.stubGlobal("PointerEvent", TestPointerEvent);
    const { first, onMove } = setup();
    fireEvent.pointerDown(first, { button: 0, clientX: 40, clientY: 40 });
    fireEvent.pointerMove(document, { clientX: 60, clientY: 40 });
    await act(async () => {});
    fireEvent.pointerMove(document, { clientX: 224, clientY: 40 });
    fireEvent.pointerUp(document);
    await waitFor(() => expect(onMove).toHaveBeenCalledWith(0, 1));
  });

  it("mezerník a šipka přesunou slide i klávesnicí", async () => {
    const { first, onMove } = setup();
    first.focus();
    fireEvent.keyDown(first, { key: " ", code: "Space" });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    fireEvent.keyDown(document, { key: "ArrowRight", code: "ArrowRight" });
    fireEvent.keyDown(document, { key: " ", code: "Space" });
    await waitFor(() => expect(onMove).toHaveBeenCalledWith(0, 1));
  });

  it("Delete nadále maže vybraný slide a kliknutí jej vybírá", () => {
    const { first, onDelete, onSelect, onMove } = setup();
    fireEvent.click(first);
    expect(onSelect).toHaveBeenCalledWith(0, expect.anything());
    fireEvent.keyDown(first, { key: "Delete" });
    expect(onDelete).toHaveBeenCalledWith([0]);
    expect(onMove).not.toHaveBeenCalled();
  });
});