import { describe, expect, it } from "vitest";
import { pptxTransitionExportReport, pptxTransitionFromDocument, pptxTransitionXmlForSlide } from "@/lib/pptx-slide-transitions";

const slide = (transitionStyle: string) => ({ transitionStyle, transitionDirection: "left", transitionDuration: 0.6 });

describe("mapování Canva přechodů do PPTX", () => {
  it("zapíše přesné nebo nejbližší OOXML efekty", () => {
    expect(pptxTransitionXmlForSlide(slide("cut"))).toContain("<p:cut/>");
    expect(pptxTransitionXmlForSlide(slide("fade"))).toContain("<p:fade/>");
    expect(pptxTransitionXmlForSlide(slide("push"))).toContain('<p:push dir="l"/>');
    expect(pptxTransitionXmlForSlide(slide("circle-wipe"))).toContain("<p:circle/>");
    expect(pptxTransitionXmlForSlide(slide("line-wipe"))).toContain('<p:wipe dir="l"/>');
    expect(pptxTransitionXmlForSlide(slide("color-wipe"))).toContain('<p:cover dir="d"/>');
    expect(pptxTransitionXmlForSlide(slide("stack"))).toContain('<p:cover dir="d"/>');
    expect(pptxTransitionXmlForSlide(slide("slice"))).toContain('<p:split orient="horz" dir="out"/>');
    expect(pptxTransitionXmlForSlide(slide("flow"))).toContain('<p:push dir="l"/>');
    expect(pptxTransitionXmlForSlide(slide("match-move"))).toContain("<p:fade/>");
  });

  it("v souhrnu vypíše všechny aproximované styly", () => {
    const report = pptxTransitionExportReport([
      slide("cut"), slide("circle-wipe"), slide("color-wipe"), slide("match-move"), slide("flow"), slide("slice"),
    ]);
    expect(report.nativeCount).toBe(2);
    expect(report.approximateCount).toBe(4);
    expect(report.approximateStyles).toEqual(["color-wipe", "match-move", "flow", "slice"]);
  });

  it("přečte kruh, čáru, cover a split do odpovídajících Canva voleb", () => {
    const read = (effect: string) => pptxTransitionFromDocument(new DOMParser().parseFromString(
      `<p:sld xmlns:p="p"><p:transition spd="med">${effect}</p:transition></p:sld>`, "application/xml",
    ));
    expect(read("<p:circle/>").config.style).toBe("circle-wipe");
    expect(read('<p:wipe dir="r"/>').config).toMatchObject({ style: "line-wipe", direction: "right", duration: 0.8 });
    expect(read('<p:cover dir="d"/>').config.style).toBe("color-wipe");
    expect(read('<p:split orient="horz" dir="out"/>').config.style).toBe("slice");
    expect(read("<p:prism/>")).toMatchObject({ config: { style: "fade" }, approximation: expect.stringContaining("Rozpuštění") });
  });
});
