import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import ImportPptxToPresentationDialog from "@/components/admin/ImportPptxToPresentationDialog";

const invoke = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...args: any[]) => invoke(...args) } },
}));

const mkFile = () =>
  new File([new Uint8Array([1, 2, 3, 4])], "hodina.pptx", {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });

describe("Import .pptx do prezentace", () => {
  beforeEach(() => invoke.mockReset());

  it("zobrazí upozornění o nepřenositelném rozvržení", () => {
    render(<ImportPptxToPresentationDialog open onOpenChange={() => {}} onImported={() => {}} />);
    expect(
      screen.getByText(/Přesné rozvržení, fonty a animace z PowerPointu nelze/i),
    ).toBeTruthy();
  });

  it("mapuje 1 lesson = 1 slide, přidá obrázky a odfiltruje nepodporované bloky", async () => {
    invoke.mockResolvedValue({
      data: {
        lessons: [
          {
            title: "Úvod",
            blocks: [
              { id: "x", type: "heading", visible: true, props: { text: "Úvod", level: 2 } },
              { id: "y", type: "divider", visible: true, props: {} },
              { id: "z", type: "hierarchy", visible: true, props: {} },
            ],
          },
          { title: "Průběh", blocks: [{ id: "p", type: "paragraph", visible: true, props: { text: "Text" } }] },
        ],
        embeddedImagesBySlide: [{ slideNumber: 2, urls: ["https://img/a.jpg", "https://img/b.jpg"] }],
      },
      error: null,
    });

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
    expect(slides).toHaveLength(2);

    expect(slides[0].projector.headline).toBe("Úvod");
    expect(slides[0].layout).toBe("full");
    expect(slides[0].blocks.map((b: any) => b.type)).toEqual(["heading"]);
    expect(slides[0].themeId).toBe("nature");
    expect(typeof slides[0].slideId).toBe("string");

    expect(slides[1].projector.headline).toBe("Průběh");
    expect(slides[1].heroImage).toBe("https://img/a.jpg");
    expect(slides[1].layout).toBe("img-right");
    // druhý obrázek snímku jako samostatný blok
    expect(slides[1].blocks.map((b: any) => b.type)).toEqual(["paragraph", "image"]);
    expect(slides[1].blocks[1].props.url).toBe("https://img/b.jpg");

    // mode "split" = rozdělení po snímcích
    expect(invoke.mock.calls[0][1].body.mode).toBe("split");
  });
});
