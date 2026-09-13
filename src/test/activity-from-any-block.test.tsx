import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { blockToPlainText } from "@/lib/block-conversions";
import { groupBlocksIntoSlide } from "@/lib/slide-groups";
import type { Block } from "@/lib/textbook-config";

const block = (id: string, type: string, props: Record<string, any>): Block =>
  ({ id, type, visible: true, props } as any);

describe("text z libovolného bloku pro AI aktivitu", () => {
  it("z tabulky udělá věty se sloupci", () => {
    const t = block("t1", "table", {
      headers: ["Druh masa", "Zvíře"],
      rows: [["Hovězí", "kráva"], ["Vepřové", "prase"]],
    });
    const text = blockToPlainText(t);
    expect(text).toContain("Sloupce: Druh masa, Zvíře");
    expect(text).toContain("Druh masa: Hovězí; Zvíře: kráva");
  });

  it("vytáhne text z obrázku s popiskem i ze snímku (slide_group)", () => {
    const img = block("i1", "image", { caption: "Dělení hovězího masa", alt: "schéma" });
    expect(blockToPlainText(img)).toContain("Dělení hovězího masa");

    const grouped = groupBlocksIntoSlide(
      [
        block("p1", "paragraph", { text: "<p>Hovězí maso je ze skotu.</p>" }),
        block("p2", "paragraph", { text: "<p>Vepřové maso je z prasat.</p>" }),
      ],
      ["p1", "p2"],
      2,
    );
    const groupText = blockToPlainText(grouped[0]);
    expect(groupText).toContain("Hovězí maso je ze skotu.");
    expect(groupText).toContain("Vepřové maso je z prasat.");
  });
});

describe("nabídka aktivity u karet ve snímku", () => {
  it("karta ve sloupcích nabízí Vytvořit aktivitu z tohoto obsahu", async () => {
    const { default: BlockEditor } = await import("@/components/admin/BlockEditor");
    const grouped = groupBlocksIntoSlide(
      [
        block("p1", "paragraph", { text: "<p>Hovězí maso je ze skotu.</p>" }),
        block("p2", "paragraph", { text: "<p>Vepřové maso je z prasat.</p>" }),
      ],
      ["p1", "p2"],
      2,
    );
    render(<BlockEditor blocks={grouped} onChange={vi.fn()} />);
    const menus = screen.getAllByLabelText("Možnosti bloku Text");
    expect(menus.length).toBe(2);
    fireEvent.click(menus[0]);
    expect(await screen.findByText("Vytvořit aktivitu z tohoto obsahu")).toBeTruthy();
  });
});
