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
      props: { text: "Úvod maso", level: 2, backgroundStyle: "important" },
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
    { id: "div-1", type: "divider", props: { style: "line" } },
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

  it("povýšený nadpis si zachová lokální styl místo obarvení celého snímku", () => {
    const headingSlide = content.find((s: any) => s.projector?.headline === "Úvod maso");
    expect(headingSlide).toBeTruthy();
    expect(headingSlide.backgroundOverride).toBeUndefined();
    expect(headingSlide.headlineBlockProps).toMatchObject({
      level: 2,
      backgroundStyle: "important",
    });
  });

  it("sloučený mezititulek si zachová celý preset pozadí, nejen odvozenou barvu", () => {
    const merged = blocksToSlides([
      { id: "short-a", type: "paragraph", props: { text: "Krátce" } },
      { id: "short-h", type: "heading", props: { text: "Barevný mezititulek", level: 3, backgroundStyle: "tip" } },
      { id: "short-b", type: "paragraph", props: { text: "Pokračování" } },
    ] as any, "Sloučení");
    const headings = merged.flatMap((s: any) => s.blocks || []).filter((b: any) => b.type === "heading");
    expect(headings.some((b: any) => b.props?.backgroundStyle === "tip")).toBe(true);
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

  it("oddělovač zůstane viditelným blokem a současně ukončí sekci", () => {
    const all = content.flatMap((s: any) => s.blocks || []);
    expect(all.find((b: any) => b.id === "div-1")?.type).toBe("divider");
  });

  it("přenese hero obrázek na úvodní snímek", () => {
    const withHero = blocksToSlides(lessonBlocks as any, "Úvod maso", {
      heroImageUrl: "https://example.com/hero.jpg",
    });
    expect(withHero[0]).toMatchObject({
      type: "intro",
      heroImage: "https://example.com/hero.jpg",
      layout: "img-left",
    });
  });

  it("přenese minimální výšku skupiny i výšky jejích dětí", () => {
    const source = [{
      id: "height-group",
      type: "slide_group",
      props: {
        layout: 2,
        groupMinHeight: 540,
        children: [
          { id: "height-a", type: "paragraph", props: { text: "A", groupHeight: 260 } },
          { id: "height-b", type: "paragraph", props: { text: "B", groupHeight: 340 } },
        ],
      },
    }];
    const groupSlide = blocksToSlides(source as any, "Výšky").find((s: any) => s.sourceBlockId === "height-group");
    expect(groupSlide?.groupMinHeight).toBe(540);
    expect(groupSlide?.blocks.map((b: any) => b.props.groupHeight)).toEqual([260, 340]);
  });
});
