import { describe, expect, it } from "vitest";
import { blocksToSlides } from "@/lib/blocks-to-slides";

/**
 * Věrnost přenosu vizuálu lekce do prezentace (bod B plánu) na struktuře
 * odpovídající lekci „Úvod maso": spojené karty s různě podbarvenými bloky,
 * nadpisy různých úrovní, galerie, callout.
 */
describe("prezentace z lekce – věrnost vizuálu", () => {
  const lessonBlocks = [
    {
      id: "h-main",
      type: "heading",
      props: { text: "Úvod maso", level: 2 },
    },
    {
      id: "grp-1",
      type: "slide_group",
      props: {
        layout: 2,
        children: [
          { id: "g1-h", type: "heading", props: { text: "Význam masa", level: 3 } },
          { id: "g1-a", type: "paragraph", props: { text: "Bílkoviny", backgroundStyle: "important" } },
          { id: "g1-b", type: "paragraph", props: { text: "Vitamíny", backgroundStyle: "tip" } },
        ],
      },
    },
    {
      id: "c1",
      type: "callout",
      props: { text: "Pozor na hygienu." },
    },
    {
      id: "gal1",
      type: "gallery",
      props: {
        images: [
          { url: "a.jpg", caption: "Hovězí" },
          { url: "b.jpg", caption: "Vepřové" },
        ],
      },
    },
  ];

  const slides = blocksToSlides(lessonBlocks as any, "Úvod maso");
  const content = slides.filter((s: any) => s.type === "explain");

  it("úroveň nadpisu z lekce se přenáší na snímek", () => {
    const withLevel = content.filter((s: any) => typeof s.headlineLevel === "number");
    expect(withLevel.length).toBeGreaterThan(0);
    expect(withLevel.some((s: any) => s.headlineLevel === 2 || s.headlineLevel === 3)).toBe(true);
  });

  it("různá podbarvení bloků zůstanou na blocích, snímek se nepřebarví", () => {
    const groupSlide = content.find((s: any) =>
      (s.blocks || []).some((b: any) => b.id === "g1-a"),
    ) as any;
    expect(groupSlide).toBeTruthy();
    expect(groupSlide.backgroundOverride).toBeUndefined();
    const styles = (groupSlide.blocks || []).map((b: any) => b.props?.backgroundStyle);
    expect(styles).toContain("important");
    expect(styles).toContain("tip");
  });

  it("callout zůstane calloutem, nedegraduje na odstavec", () => {
    const all = content.flatMap((s: any) => s.blocks || []);
    expect(all.find((b: any) => b.id === "c1")?.type).toBe("callout");
  });

  it("z galerie se přenesou všechny obrázky", () => {
    const refs = content.flatMap((s: any) => s.projector?.assetRefs || []);
    expect(refs).toContain("a.jpg");
    expect(refs).toContain("b.jpg");
  });
});
