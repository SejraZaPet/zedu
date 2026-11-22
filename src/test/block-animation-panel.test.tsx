import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BlockAnimationPanel from "@/components/presentation/editor/BlockAnimationPanel";
import SlideBlockAnimationView from "@/components/presentation/editor/SlideBlockAnimationView";
import { SlideBody } from "@/components/admin/SlideCanvas";

const slide = { blocks: [{ id: "text", type: "paragraph", props: { text: "Text", animation: { preset: "fade", trigger: "click", order: 0, speed: 0.6, delay: 0 } } }] };
const props = () => ({ onChange: vi.fn(), onPreview: vi.fn(), onPlaySlide: vi.fn(), onReorder: vi.fn(), onClose: vi.fn() });

describe("BlockAnimationPanel", () => {
  it("selects a live preset and immediately requests canvas preview", () => {
    const own = props();
    render(<BlockAnimationPanel slide={slide} block={slide.blocks[0] as any} {...own} />);
    fireEvent.click(screen.getByRole("button", { name: "Animace Prolnutí" }));
    expect(own.onChange).toHaveBeenCalledWith(expect.objectContaining({ preset: "fade", trigger: "click" }));
    expect(own.onPreview).toHaveBeenCalledOnce();
  });

  it("turns click reveal on and off without changing content", () => {
    const own = props();
    render(<BlockAnimationPanel slide={{ blocks: [{ ...slide.blocks[0], props: { text: "Text" } }] }} block={{ ...slide.blocks[0], props: { text: "Text" } } as any} {...own} />);
    fireEvent.click(screen.getByRole("switch", { name: "Zobrazit při kliknutí" }));
    expect(own.onChange).toHaveBeenCalledWith(expect.objectContaining({ trigger: "click" }));
  });

  it("plays the whole page from the page tab and closes from the cross", () => {
    const own = props();
    render(<BlockAnimationPanel slide={slide} block={null} {...own} />);
    fireEvent.click(screen.getByRole("button", { name: "Přehrát celý slide" }));
    fireEvent.click(screen.getByRole("button", { name: "Zavřít animace" }));
    expect(own.onPlaySlide).toHaveBeenCalledOnce();
    expect(own.onClose).toHaveBeenCalledOnce();
  });
});

describe("SlideBlockAnimationView", () => {
  it("keeps editing static and hides an unrevealed live click group", () => {
    const { container, rerender } = render(<SlideBlockAnimationView block={slide.blocks[0]} index={0} play={false} revealed={false}><span>Obsah</span></SlideBlockAnimationView>);
    expect(container.querySelector(".slide-block-anim")).toBeNull();
    expect(screen.getByText("Obsah")).not.toHaveAttribute("aria-hidden");
    rerender(<SlideBlockAnimationView block={slide.blocks[0]} index={0} play revealed={false}><span>Obsah</span></SlideBlockAnimationView>);
    expect(container.querySelector(".slide-block-anim-fade")).toHaveStyle({ visibility: "hidden" });
    rerender(<SlideBlockAnimationView block={slide.blocks[0]} index={0} play revealed><span>Obsah</span></SlideBlockAnimationView>);
    expect(container.querySelector(".slide-block-anim-fade")).not.toHaveStyle({ visibility: "hidden" });
  });

  it("plays every animated element on the page and returns to a static editor", () => {
    const two = { slideId: "two", type: "explain", blocks: [
      { id: "a", type: "paragraph", props: { text: "A", animation: { preset: "fade", trigger: "click", order: 0, speed: 0.6, delay: 0 } } },
      { id: "b", type: "paragraph", props: { text: "B", animation: { preset: "pop", trigger: "click", order: 1, speed: 0.6, delay: 0 } } },
    ] };
    const { container, rerender } = render(<SlideBody slide={two as any} editable animationPreviewKey={1} animationRevealCount={2} />);
    expect(container.querySelectorAll("[data-slide-root] .slide-block-anim").length).toBeGreaterThanOrEqual(2);
    rerender(<SlideBody slide={two as any} editable animationPreviewKey={0} animationRevealCount={2} />);
    expect(container.querySelectorAll("[data-slide-root] .slide-block-anim")).toHaveLength(0);
  });
});
