import {
  normalizeTransitionDuration,
  transitionConfigFromSlide,
  type SlideTransitionConfig,
  type SlideTransitionDirection,
} from "@/lib/slide-transitions";

export interface PptxTransitionRead {
  config: SlideTransitionConfig;
  /** Popis efektu, který nemá přesný protějšek v editoru. */
  approximation?: string;
}

const DIRECTIONS: Record<string, SlideTransitionDirection> = { l: "left", r: "right", u: "up", d: "down" };
const DIRECTION_XML: Record<SlideTransitionDirection, string> = { left: "l", right: "r", up: "u", down: "d" };
const CUT: SlideTransitionConfig = { style: "cut", direction: "left", duration: 0.2 };

function durationFromXml(transition: Element): number {
  const exact = Number(transition.getAttribute("p14:dur") || transition.getAttribute("dur"));
  if (Number.isFinite(exact) && exact > 0) return normalizeTransitionDuration(exact / 1000);
  const speed = transition.getAttribute("spd");
  return speed === "slow" ? 1.4 : speed === "med" ? 0.8 : 0.35;
}

/** Čte pouze přímý p:transition daného slidu, ne animace prvků v p:timing. */
export function pptxTransitionFromDocument(doc: Document): PptxTransitionRead {
  const transition = Array.from(doc.getElementsByTagName("p:transition"))
    .find((element) => element.parentElement?.tagName === "p:sld");
  if (!transition) return { config: { ...CUT } };
  const effect = Array.from(transition.children).find((element) => element.tagName.startsWith("p:"));
  if (!effect) return { config: { ...CUT, duration: durationFromXml(transition) } };
  const name = effect.localName.toLowerCase();
  const direction = DIRECTIONS[effect.getAttribute("dir") || "l"] || "left";
  const duration = durationFromXml(transition);
  const base = { direction, duration } as const;
  const approximate = (style: SlideTransitionConfig["style"], target: string): PptxTransitionRead => ({
    config: { ...base, style }, approximation: `PowerPoint efekt ${name} byl převeden na ${target}.`,
  });

  if (name === "cut" || name === "none") return { config: { ...base, style: "cut" } };
  if (name === "fade" || name === "dissolve") return { config: { ...base, style: "fade" } };
  if (name === "push" || name === "pull") return { config: { ...base, style: "push" } };
  if (name === "circle") return { config: { ...base, style: "circle-wipe" } };
  if (name === "wipe") return { config: { ...base, style: "line-wipe" } };
  if (name === "cover" || name === "uncover") return approximate("color-wipe", "Stírání barev");
  if (name === "split" || name === "strips" || name === "blinds") return approximate("slice", "Rozseknutí");
  if (["diamond", "plus", "wedge", "wheel", "zoom"].includes(name)) return approximate("circle-wipe", "Kruhové stírání");
  if (["comb", "checker", "randombar"].includes(name)) return approximate("flow", "Proudění");
  if (name === "newsflash") return approximate("flow", "Proudění");
  return { config: { ...base, style: "fade" }, approximation: `Nepodporovaný PowerPoint přechod ${name} byl převeden na Rozpuštění.` };
}

function speed(config: SlideTransitionConfig): string {
  return config.duration <= 0.4 ? "fast" : config.duration <= 1 ? "med" : "slow";
}

/** Nejbližší nativní OOXML přechod; pptxgenjs jej zapisuje až naše ZIP doplňování. */
export function pptxTransitionXmlForSlide(slide: any): string {
  const config = transitionConfigFromSlide(slide);
  const attrs = ` spd="${speed(config)}"`;
  if (config.style === "cut") return `<p:transition${attrs}><p:cut/></p:transition>`;
  if (config.style === "push" || config.style === "flow") return `<p:transition${attrs}><p:push dir="${DIRECTION_XML[config.direction]}"/></p:transition>`;
  if (config.style === "circle-wipe") return `<p:transition${attrs}><p:circle/></p:transition>`;
  if (config.style === "line-wipe") return `<p:transition${attrs}><p:wipe dir="${DIRECTION_XML[config.direction]}"/></p:transition>`;
  if (config.style === "color-wipe" || config.style === "stack") return `<p:transition${attrs}><p:cover dir="d"/></p:transition>`;
  if (config.style === "slice") return `<p:transition${attrs}><p:split orient="horz" dir="out"/></p:transition>`;
  // Match & move nemá přenositelný ekvivalent bez stejných interních ID prvků.
  return `<p:transition${attrs}><p:fade/></p:transition>`;
}

export function pptxTransitionExportReport(slides: any[]) {
  const approximateStyles = new Set<string>();
  let nativeCount = 0;
  let approximateCount = 0;
  for (const slide of slides || []) {
    const style = transitionConfigFromSlide(slide).style;
    if (["color-wipe", "match-move", "flow", "slice"].includes(style)) {
      approximateStyles.add(style);
      approximateCount++;
    } else nativeCount++;
  }
  return { nativeCount, approximateCount, approximateStyles: [...approximateStyles] };
}
