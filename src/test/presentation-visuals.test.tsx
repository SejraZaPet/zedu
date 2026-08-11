import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ThemeGalleryPopover from "@/components/admin/ThemeGalleryPopover";
import StartFromTemplateDialog from "@/components/admin/StartFromTemplateDialog";
import { SlideBody } from "@/components/admin/SlideCanvas";
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
