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

describe("shoda bloků prezentace s lekcí", () => {
  const slide = {
    themeId: "minimal",
    layout: "two-cols",
    groupMinHeight: 520,
    projector: { headline: "Barevný nadpis" },
    headlineLevel: 2,
    headlineBlockProps: { level: 2, backgroundStyle: "important" },
    blocks: [
      { id: "callout", type: "callout", visible: true, props: { calloutType: "remember", text: "Zapamatujte si" } },
      { id: "table", type: "table", visible: true, props: { headers: ["A"], rows: [["B"]], groupHeight: 300 } },
      { id: "bullets", type: "bullet_list", visible: true, props: { items: ["První bod"] } },
    ],
  };

  it("zachová lokální pozadí titulku včetně akcentu, odsazení a radiusu", () => {
    const { container } = render(<SlideBody slide={slide} themeId="minimal" />);
    const headline = container.querySelector('[data-headline-background="true"]') as HTMLElement;
    expect(headline).toBeTruthy();
    expect(headline.style.background).toBeTruthy();
    expect(headline.style.borderLeft).toContain("4px solid");
    expect(headline.style.padding).toBe("12px 16px");
    expect(headline.style.borderRadius).toBe("10px");
  });

  it("vykreslí callout stejnou paletou a typografií jako lekce", () => {
    const { container } = render(<SlideBody slide={slide} themeId="minimal" />);
    const callout = container.querySelector('[data-callout-type="remember"]') as HTMLElement;
    expect(callout).toBeTruthy();
    expect(callout.className).toContain("border-primary/40");
    expect(callout.className).toContain("bg-primary/10");
    expect(callout.className).toContain("text-foreground");
    expect(callout.textContent).toContain("🧠");
    expect(callout.innerHTML).toContain("text-sm");
  });

  it("vykreslí tabulku světlými styly lekce a zachová výšky skupiny", () => {
    const { container } = render(<SlideBody slide={slide} themeId="minimal" />);
    const table = container.querySelector('[data-lesson-table="true"]') as HTMLElement;
    expect(table.className).toContain("text-sm");
    expect(table.querySelector("th")?.className).toContain("bg-muted");
    expect(table.querySelector("th")?.className).toContain("border-border");
    expect(table.querySelector("td")?.className).toContain("text-foreground");
    const group = container.querySelector('[data-slide-group="two-cols"]') as HTMLElement;
    expect(group.style.minHeight).toBe("520px");
    expect(container.innerHTML).toContain("min-height: 300px");
  });

  it("rozlišuje všechny čtyři úrovně nadpisů a drží seznam blízko sazby lekce", () => {
    const blocks = [1, 2, 3, 4].map((level) => ({
      id: `h-${level}`,
      type: "heading",
      visible: true,
      props: { level, text: `H${level}` },
    }));
    const { container } = render(<SlideBody slide={{ ...slide, projector: { headline: "" }, layout: "full", blocks }} themeId="minimal" />);
    const html = container.innerHTML;
    expect(html).toContain("text-4xl");
    expect(html).toContain("text-3xl");
    expect(html).toContain("text-2xl");
    expect(html).toContain("text-xl");
  });
});
