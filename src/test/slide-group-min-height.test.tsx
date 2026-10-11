import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { SortableSlideGroup } from "@/components/admin/BlockEditor";
import type { Block } from "@/lib/textbook-config";

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  sortableKeyboardCoordinates: () => {},
  verticalListSortingStrategy: {},
  arrayMove: (arr: unknown[]) => arr,
}));

// jsdom nepočítá layout – výšky napodobíme podle data atributů.
const origHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
const origTop = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetTop");

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get(this: HTMLElement) {
      if (this.dataset?.slideGroup) return 600;
      if (this.dataset?.slideGroupContent) return 100;
      return 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "offsetTop", {
    configurable: true,
    get(this: HTMLElement) {
      return this.dataset?.slideGroupContent ? 40 : 0;
    },
  });
});

afterAll(() => {
  if (origHeight) Object.defineProperty(HTMLElement.prototype, "offsetHeight", origHeight);
  if (origTop) Object.defineProperty(HTMLElement.prototype, "offsetTop", origTop);
});

const noop = () => {};

const makeBlock = (minHeight?: number): Block => ({
  id: "g1",
  type: "slide_group",
  visible: true,
  props: {
    layout: 1,
    ...(minHeight != null ? { groupMinHeight: minHeight } : {}),
    children: [{ id: "c1", type: "text", visible: true, props: { text: "Krátký text" } }],
  },
});

const renderGroup = (block: Block, onMinHeightChange = noop) =>
  render(
    <SortableSlideGroup
      block={block}
      onChildUpdate={noop}
      onChildRemove={noop}
      onLayoutChange={noop}
      onModeChange={noop}
      onChildFrameChange={noop}
      onChildHeightChange={noop}
      onMinHeightChange={onMinHeightChange}
      onUngroup={noop}
      onToggle={noop}
      onDelete={noop}
    />,
  );

describe("SortableSlideGroup – pevná výška v editoru", () => {
  it("karta s groupMinHeight a malým obsahem zobrazí štítek a klik výšku odstraní", async () => {
    const onMinHeightChange = vi.fn();
    renderGroup(makeBlock(600), onMinHeightChange);

    const badge = await screen.findByText(/Pevná výška: 600 px/);
    expect(badge.textContent).toContain("Obnovit automatickou výšku");

    fireEvent.click(badge);
    expect(onMinHeightChange).toHaveBeenCalledWith("g1", null);
  });

  it("karta bez groupMinHeight štítek nemá", async () => {
    renderGroup(makeBlock());
    await waitFor(() => expect(screen.getByText("Snímek")).toBeTruthy());
    expect(screen.queryByText(/Pevná výška:/)).toBeNull();
  });
});
