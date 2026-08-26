import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { readFileSync } from "node:fs";
import ImportPptxToPresentationDialog from "@/components/admin/ImportPptxToPresentationDialog";

const FIXTURE = "/tmp/pptx-fixture/test-3-slides.pptx";

const mkFile = () =>
  new File([new Uint8Array(readFileSync(FIXTURE))], "hodina.pptx", {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });

describe("Import .pptx do prezentace", () => {
  it("zobrazí upozornění o nepřenositelném rozvržení", () => {
    render(<ImportPptxToPresentationDialog open onOpenChange={() => {}} onImported={() => {}} />);
    expect(
      screen.getByText(/Rozvržení, fonty\s+a animace z PowerPointu nelze přenést/i),
    ).toBeTruthy();
  });

  it("vytvoří přesně N slidů pro N snímků PPTX se správnými texty", async () => {
    const onImported = vi.fn();
    render(
      <ImportPptxToPresentationDialog
        open
        onOpenChange={() => {}}
        onImported={onImported}
        themeId="nature"
      />,
    );

    const input = document.getElementById("pptx-import-file") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [mkFile()] } });
    fireEvent.click(screen.getByRole("button", { name: /Importovat snímky/i }));

    await waitFor(() => expect(onImported).toHaveBeenCalled());
    const slides = onImported.mock.calls[0][0];

    expect(slides).toHaveLength(3);
    expect(slides.map((s: any) => s.projector.headline)).toEqual([
      "První snímek",
      "Druhý snímek",
      "Třetí snímek",
    ]);
    expect(slides.every((s: any) => s.type === "content")).toBe(true);
    expect(slides.every((s: any) => s.themeId === "nature")).toBe(true);
    expect(slides.every((s: any) => typeof s.slideId === "string")).toBe(true);

    // texty těla snímků
    const bodyTexts = slides.map((s: any) =>
      s.blocks.map((b: any) => b.props.text ?? (b.props.items || []).join("|")).join(" / "),
    );
    expect(bodyTexts[0]).toContain("Text prvního snímku");
    expect(bodyTexts[1]).toContain("Bod A");
    expect(bodyTexts[2]).toContain("Závěr hodiny");
  });
});
