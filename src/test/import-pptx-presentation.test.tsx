import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import pptxgen from "pptxgenjs";
import ImportPptxToPresentationDialog from "@/components/admin/ImportPptxToPresentationDialog";

/** Vytvoří reálný 3snímkový .pptx pomocí pptxgenjs (bez zápisu na disk). */
async function mkFile(): Promise<File> {
  const p = new pptxgen();
  const s1 = p.addSlide();
  s1.addText("První snímek", { x: 0.5, y: 0.4, w: 8, h: 1, fontSize: 36 });
  s1.addText("Text prvního snímku", { x: 0.5, y: 1.8, w: 8, h: 1, fontSize: 20 });
  const s2 = p.addSlide();
  s2.addText("Druhý snímek", { x: 0.5, y: 0.4, w: 8, h: 1, fontSize: 36 });
  s2.addText(
    [
      { text: "Bod A", options: { bullet: true } },
      { text: "Bod B", options: { bullet: true } },
    ],
    { x: 0.5, y: 1.8, w: 8, h: 2, fontSize: 20 },
  );
  const s3 = p.addSlide();
  s3.addText("Třetí snímek", { x: 0.5, y: 0.4, w: 8, h: 1, fontSize: 36 });
  s3.addText("Závěr hodiny", { x: 0.5, y: 1.8, w: 8, h: 1, fontSize: 20 });

  const buf = (await p.write({ outputType: "arraybuffer" })) as ArrayBuffer;
  return new File([new Uint8Array(buf)], "hodina.pptx", {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });
}

describe("Import .pptx do prezentace", () => {
  it("zobrazí upozornění o nepřenositelném rozvržení", () => {
    render(<ImportPptxToPresentationDialog open onOpenChange={() => {}} onImported={() => {}} />);
    expect(
      screen.getByText(/Rozvržení, fonty\s+a animace nelze přenést/i),
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
    fireEvent.change(input, { target: { files: [await mkFile()] } });
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
