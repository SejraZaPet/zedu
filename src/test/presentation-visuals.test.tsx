import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ThemeGalleryPopover from "@/components/admin/ThemeGalleryPopover";
import StartFromTemplateDialog from "@/components/admin/StartFromTemplateDialog";
import SlideCanvasDefault, { SlideBody } from "@/components/admin/SlideCanvas";
import { PRESENTATION_TEMPLATES } from "@/lib/presentation-templates";

describe("presentation visual layer", () => {
  it("renders theme gallery trigger", () => {
    render(<ThemeGalleryPopover themeId="nature" onChange={() => {}} />);
    expect(screen.getByText("Vzhled")).toBeTruthy();
  });

  it("renders template dialog options", () => {
    render(<StartFromTemplateDialog open onOpenChange={() => {}} onPick={() => {}} />);
    for (const t of PRESENTATION_TEMPLATES) expect(screen.getByText(t.name)).toBeTruthy();
  });

  it("renders themed slide thumbnails for every template slide", () => {
    for (const t of PRESENTATION_TEMPLATES) {
      for (const slide of t.build()) {
        render(<SlideBody slide={slide} themeId="pastel-playful" />);
      }
    }
    expect(true).toBe(true);
  });
});

describe("per-block typography a animace", () => {
  const slide = {
    themeId: "minimal",
    backgroundOverride: { color: "#123456" },
    layout: "full",
    projector: { headline: "Testovací slide" },
    blocks: [
      { id: "b1", type: "heading", visible: true, props: { level: 2, text: "Nadpis 48", fontSize: 48, color: "#EF4444", fontFamily: '"Playfair Display", Georgia, serif', animation: "scale" } },
      { id: "b2", type: "paragraph", visible: true, props: { text: "Odstavec 24", fontSize: 24, color: "#10B981", fontFamily: '"Courier New", ui-monospace, monospace', animation: "from-bottom" } },
      { id: "b3", type: "bullet_list", visible: true, props: { items: ["A", "B"], fontSize: 32, animation: "from-top" } },
    ],
  };

  it("aplikuje velikost, barvu a font per blok", () => {
    const { container } = render(<SlideBody slide={slide} themeId="minimal" />);
    const html = container.innerHTML;
    expect(html).toContain("font-size: 64px"); // 48pt * 1.333
    expect(html).toContain("rgb(239, 68, 68)");
    expect(html).toContain("Playfair Display");
    expect(html).toContain("font-size: 32px"); // 24pt
    expect(html).toContain("Courier New");
    expect(html).toContain("font-size: 43px"); // 32pt
  });

  it("přehraje animace jen v needitovatelném (živém) režimu", () => {
    const live = render(<SlideBody slide={slide} themeId="minimal" />);
    expect(live.container.querySelectorAll(".slide-anim-scale").length).toBe(1);
    expect(live.container.querySelectorAll(".slide-anim-from-bottom").length).toBe(1);
    expect(live.container.querySelectorAll(".slide-anim-from-top").length).toBe(1);

    const editor = render(<SlideBody slide={slide} themeId="minimal" editable />);
    expect(editor.container.querySelectorAll('[class*="slide-anim-"]').length).toBe(0);
  });

  it("vlastní pozadí slidu přepíše téma", () => {
    const { container } = render(<SlideCanvasDefault slide={slide} themeId="minimal" fit={false} />);
    expect(container.innerHTML).toContain("rgb(18, 52, 86)");
  });
});
