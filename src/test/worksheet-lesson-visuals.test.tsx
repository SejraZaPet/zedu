import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import LessonVisualBlockItem from "@/components/worksheet-items/LessonVisualBlockItem";
import { createDefaultItem } from "@/lib/worksheet-defaults";
import { renderWorksheetVariantHtml } from "@/lib/worksheet-print-renderer";
import { emptyWorksheetSpec } from "@/lib/worksheet-defaults";

describe("vizuální bloky pracovního listu", () => {
  it("žákovský renderer zachová stranu obrázku, galerii a variantu calloutu", () => {
    const imageText = {
      ...createDefaultItem("image_text", 1),
      imageUrl: "https://example.com/maso.jpg",
      imageText: "Důležité živiny",
      imagePosition: "right" as const,
    };
    const { container, rerender } = render(
      <LessonVisualBlockItem item={imageText} value={undefined} onChange={() => undefined} disabled showResults={false} />,
    );
    expect(container.firstElementChild?.className).toContain("md:flex-row-reverse");
    expect(screen.getByText("Důležité živiny")).toBeInTheDocument();

    const gallery = {
      ...createDefaultItem("gallery", 2),
      galleryColumns: 2 as const,
      galleryImages: [
        { url: "a.jpg", caption: "Hovězí" },
        { url: "b.jpg", caption: "Vepřové" },
      ],
    };
    rerender(<LessonVisualBlockItem item={gallery} value={undefined} onChange={() => undefined} disabled showResults={false} />);
    expect(screen.getByText("Hovězí")).toBeInTheDocument();
    expect(screen.getByText("Vepřové")).toBeInTheDocument();

    const callout = {
      ...createDefaultItem("callout", 3),
      calloutVariant: "warning" as const,
      calloutText: "Pozor na hygienu.",
    };
    rerender(<LessonVisualBlockItem item={callout} value={undefined} onChange={() => undefined} disabled showResults={false} />);
    expect(screen.getByText("Pozor na hygienu.")).toBeInTheDocument();
  });

  it("tisk vykreslí všechny čtyři typy bez číslování", () => {
    const spec = emptyWorksheetSpec({ title: "Vizuální test" });
    spec.variants[0].items = [
      { ...createDefaultItem("image", 1), imageUrl: "image.jpg", imageCaption: "Řez masem" },
      { ...createDefaultItem("image_text", 2), imageUrl: "side.jpg", imageText: "Text vedle obrázku", imagePosition: "right" },
      { ...createDefaultItem("gallery", 3), galleryImages: [{ url: "a.jpg" }, { url: "b.jpg" }], galleryColumns: 2 },
      { ...createDefaultItem("callout", 4), calloutVariant: "tip", calloutText: "Zapamatujte si" },
    ];
    const html = renderWorksheetVariantHtml(spec, "A");
    expect(html).toContain("ws-lesson-image");
    expect(html).toContain("ws-image-text-right");
    expect(html).toContain("grid-template-columns:repeat(2");
    expect(html).toContain("Zapamatujte si");
    expect(html).not.toContain("ws-item-num\">1.");
  });
});