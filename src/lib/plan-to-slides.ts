/**
 * Můstek mezi "aktivitou v lekci" / "fázemi plánu hodiny" a slidem prezentace.
 *
 * Slidy mají stejný datový model jako aktivity v lekcích (`props` bloku typu
 * `activity` = `activitySpec` slidu), takže převod je bezpečný a bezeztrátový.
 */

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `slide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** Aktivita z lekce (blok typu `activity`) → slide prezentace. */
export function activityBlockToSlide(block: any): any {
  const props = block?.props || {};
  const headline = props.title || props.question || props.activityType || "Aktivita";
  return {
    slideId: newId(),
    type: "activity",
    projector: { headline: String(headline), body: "", assetRefs: [] },
    device: { instructions: props.instructions || "Odpovězte na svém zařízení." },
    activitySpec: props,
    blocks: [{ ...block, id: newId() }],
  };
}

/** Textový slide (výklad) s volitelnou vazbou na typ aktivity z plánu hodiny. */
export function textSlide(headline: string, body: string, planActivityKind?: string): any {
  return {
    slideId: newId(),
    type: "explain",
    projector: { headline: headline.trim(), body: body.trim(), assetRefs: [] },
    device: { instructions: "Sledujte projektor." },
    ...(planActivityKind ? { planActivityKind } : {}),
  };
}

export interface PlanPhaseLike {
  timeMin?: string;
  description?: string;
  activities?: { kind: string; title: string }[];
}

/**
 * Fáze návrhu podle metody → textové slidy.
 * Každá fáze dá jeden slide s popisem; každá aktivita fáze dá vlastní slide,
 * u kterého si pamatujeme `planActivityKind` pro pozdější dogenerování obsahu AI.
 */
export function phasesToSlides(
  phases: Record<string, PlanPhaseLike>,
  phaseLabels: Record<string, string>,
  title?: string,
): any[] {
  const slides: any[] = [];
  if (title) {
    slides.push(textSlide(title, "Plán hodiny navržený podle vybraných metod."));
  }
  for (const [key, label] of Object.entries(phaseLabels)) {
    const phase = phases?.[key];
    if (!phase) continue;
    const heading = phase.timeMin ? `${label} (${phase.timeMin} min)` : label;
    slides.push(textSlide(heading, phase.description || ""));
    for (const activity of phase.activities || []) {
      slides.push(
        textSlide(
          activity.title || "Aktivita",
          `Fáze: ${label}\nNavržený typ aktivity: ${activity.kind}`,
          activity.kind,
        ),
      );
    }
  }
  return slides;
}

/** Mapování volného typu z plánu na typ aktivity slidu. */
export function mapPlanKindToActivityType(kind?: string | null): string {
  const k = String(kind || "").toLowerCase();
  if (k.includes("mcq") || k.includes("kvíz") || k.includes("kviz") || k.includes("quiz")) return "quiz";
  if (k.includes("true") || k.includes("pravda")) return "true_false";
  if (k.includes("match") || k.includes("pároc") || k.includes("spoj")) return "matching";
  if (k.includes("wall") || k.includes("zeď") || k.includes("brainstorm")) return "wall";
  if (k.includes("poll") || k.includes("hlas")) return "poll";
  if (k.includes("open") || k.includes("otevřen") || k.includes("reflex")) return "open";
  return "quiz";
}
