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

  if (name === "cut" || name === "none") return { config: { ...base, style: "cut" } };
  if (name === "fade" || name === "dissolve") return { config: { ...base, style: "fade" } };
  if (name === "push" || name === "pull") return { config: { ...base, style: "push" } };
  if (name === "wipe" || name === "cover" || name === "uncover" || name === "strips") return { config: { ...base, style: "wipe" } };
  if (name === "zoom") return { config: { ...base, style: "zoom" } };
  if (["circle", "diamond", "plus", "wedge", "wheel", "split", "comb", "checker", "blinds", "randombar"].includes(name)) {
    return { config: { ...base, style: "zoom" }, approximation: `PowerPoint efekt ${name} byl převeden na Přiblížení.` };
  }
  if (name === "newsflash") return { config: { ...base, style: "rotate" }, approximation: "PowerPoint efekt newsflash byl převeden na Otočení." };
  return { config: { ...base, style: "fade" }, approximation: `Nepodporovaný PowerPoint přechod ${name} byl převeden na Prolnutí.` };
}

function speed(config: SlideTransitionConfig): string {
  return config.duration <= 0.4 ? "fast" : config.duration <= 1 ? "med" : "slow";
}

/** Nejbližší nativní OOXML přechod; pptxgenjs jej zapisuje až naše ZIP doplňování. */
export function pptxTransitionXmlForSlide(slide: any): string {
  const config = transitionConfigFromSlide(slide);
  const attrs = ` spd="${speed(config)}"`;
  if (config.style === "cut") return `<p:transition${attrs}><p:cut/></p:transition>`;
  if (config.style === "push") return `<p:transition${attrs}><p:push dir="${DIRECTION_XML[config.direction]}"/></p:transition>`;
  if (config.style === "wipe") return `<p:transition${attrs}><p:wipe dir="${DIRECTION_XML[config.direction]}"/></p:transition>`;
  if (config.style === "zoom" || config.style === "rotate" || config.style === "focus") return `<p:transition${attrs}><p:zoom/></p:transition>`;
  // blur / flip / mirror nemají spolehlivý ekvivalent v základním OOXML.
  return `<p:transition${attrs}><p:fade/></p:transition>`;
}

export function pptxTransitionExportReport(slides: any[]) {
  const approximateStyles = new Set<string>();
  let nativeCount = 0;
  let approximateCount = 0;
  for (const slide of slides || []) {
    const style = transitionConfigFromSlide(slide).style;
    if (["rotate", "blur", "flip", "mirror", "focus"].includes(style)) {
      approximateStyles.add(style);
      approximateCount++;
    } else nativeCount++;
  }
  return { nativeCount, approximateCount, approximateStyles: [...approximateStyles] };
}
