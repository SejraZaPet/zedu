/**
 * SlideSpec v1 — Intermediate format for PPTX / PDF / HTML export.
 *
 * Every lesson-plan slide is normalised into this shape before
 * hitting any renderer.  The spec is intentionally renderer-agnostic:
 * each renderer picks the fields it supports and ignores the rest.
 */

// ────────────────── Core types ──────────────────

export const SLIDE_SPEC_VERSION = "v1" as const;

export type SlideType =
  | "intro"
  | "objective"
  | "explain"
  | "practice"
  | "activity"
  | "summary"
  | "exit";

export interface TextBlock {
  /** Unique id within the slide */
  id: string;
  /** Raw text content (may contain simple markdown: **bold**, *italic*) */
  text: string;
  /** Role hint so renderers can style differently */
  role: "heading" | "body" | "caption" | "device_instruction";
  /** Font-size hint in pt (default: role-based) */
  fontSize?: number;
  /** Bold flag */
  bold?: boolean;
}

export interface ImageRef {
  id: string;
  /** Public URL or storage path */
  src: string;
  alt: string;
  /** Placement hint */
  position: "inline" | "background" | "side";
  /** Width fraction 0-1 relative to slide width */
  widthFraction?: number;
}

export interface InteractivePlaceholder {
  /** Activity type (mcq, matching, hotspot, etc.) */
  activityType: string;
  /** Prompt shown to students */
  prompt?: string;
  /** Join code for live sessions */
  joinCode?: string;
  /** Full join URL (may be "nespecifikováno" until session is created) */
  joinUrl?: string;
  /** Serialised activity model — opaque to the spec, passed through to renderers */
  model?: Record<string, unknown>;
  /** Whether to render a QR placeholder in print exports */
  showQr?: boolean;
}

export interface SlideSpec {
  /** Unique slide id */
  id: string;
  /** Ordinal 1-based index */
  index: number;
  /** Pedagogical type */
  type: SlideType;
  /** Slide title (short) */
  title: string;
  /** Structured text blocks */
  textBlocks: TextBlock[];
  /** Image references */
  images: ImageRef[];
  /** Interactive activity placeholder (null if no activity) */
  interactivePlaceholder: InteractivePlaceholder | null;
  /** Speaker / teacher notes (plain text) */
  speakerNotes: string;
  /** Layout hint for renderers */
  layout: "default" | "title" | "two_column" | "media_right" | "media_left" | "full_image";
}

export interface SlideSpecDocument {
  version: typeof SLIDE_SPEC_VERSION;
  meta: {
    title: string;
    subject: string;
    gradeBand: string;
    mode: "teacher-led" | "student_paced";
    slideCount: number;
    generatedAt: string;
  };
  slides: SlideSpec[];
}

// ────────────────── JSON Schema (for strict validation) ──────────────────

export const SLIDE_SPEC_JSON_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "SlideSpecDocument",
  type: "object",
  required: ["version", "meta", "slides"],
  properties: {
    version: { type: "string", const: "v1" },
    meta: {
      type: "object",
      required: ["title", "subject", "gradeBand", "mode", "slideCount", "generatedAt"],
      properties: {
        title: { type: "string" },
        subject: { type: "string" },
        gradeBand: { type: "string" },
        mode: { type: "string", enum: ["teacher-led", "student_paced"] },
        slideCount: { type: "integer", minimum: 1 },
        generatedAt: { type: "string", format: "date-time" },
      },
    },
    slides: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["id", "index", "type", "title", "textBlocks", "images", "interactivePlaceholder", "speakerNotes", "layout"],
        properties: {
          id: { type: "string" },
          index: { type: "integer", minimum: 1 },
          type: { type: "string", enum: ["intro", "objective", "explain", "practice", "activity", "summary", "exit"] },
          title: { type: "string" },
          textBlocks: {
            type: "array",
            items: {
              type: "object",
              required: ["id", "text", "role"],
              properties: {
                id: { type: "string" },
                text: { type: "string" },
                role: { type: "string", enum: ["heading", "body", "caption", "device_instruction"] },
                fontSize: { type: "number" },
                bold: { type: "boolean" },
              },
            },
          },
          images: {
            type: "array",
            items: {
              type: "object",
              required: ["id", "src", "alt", "position"],
              properties: {
                id: { type: "string" },
                src: { type: "string" },
                alt: { type: "string" },
                position: { type: "string", enum: ["inline", "background", "side"] },
                widthFraction: { type: "number", minimum: 0, maximum: 1 },
              },
            },
          },
          interactivePlaceholder: {
            oneOf: [
              { type: "null" },
              {
                type: "object",
                required: ["activityType"],
                properties: {
                  activityType: { type: "string" },
                  prompt: { type: "string" },
                  joinCode: { type: "string" },
                  joinUrl: { type: "string" },
                  model: { type: "object" },
                  showQr: { type: "boolean" },
                },
              },
            ],
          },
          speakerNotes: { type: "string" },
          layout: { type: "string", enum: ["default", "title", "two_column", "media_right", "media_left", "full_image"] },
        },
      },
    },
  },
} as const;

// ────────────────── Converter: LessonPlan Slide → SlideSpec ──────────────────

interface RawSlide {
  slideId: string;
  type: string;
  projector: { headline: string; body: string; assetRefs?: string[] };
  device: { instructions: string; activityRefs?: string[]; headline?: string };
  teacherNotes: string;
  activitySpec?: Record<string, any>;
  checkpoints?: any[];
}

/**
 * Convert raw lesson-plan slides into a SlideSpecDocument.
 */
export function toSlideSpecDocument(
  slides: RawSlide[],
  meta: { title: string; subject: string; gradeBand: string; mode?: string },
): SlideSpecDocument {
  return {
    version: SLIDE_SPEC_VERSION,
    meta: {
      title: meta.title,
      subject: meta.subject,
      gradeBand: meta.gradeBand,
      mode: (meta.mode === "student-paced" || meta.mode === "student_paced") ? "student_paced" : "teacher-led",
      slideCount: slides.length,
      generatedAt: new Date().toISOString(),
    },
    slides: slides.map((s, i) => convertSlide(s, i)),
  };
}

function convertSlide(raw: RawSlide, index: number): SlideSpec {
  const textBlocks: TextBlock[] = [];

  // Heading from projector
  if (raw.projector?.headline) {
    textBlocks.push({
      id: `${raw.slideId}-heading`,
      text: raw.projector.headline,
      role: "heading",
      bold: true,
    });
  }

  // Body from projector
  if (raw.projector?.body) {
    textBlocks.push({
      id: `${raw.slideId}-body`,
      text: raw.projector.body,
      role: "body",
    });
  }

  // Device instructions
  if (raw.device?.instructions) {
    textBlocks.push({
      id: `${raw.slideId}-device`,
      text: raw.device.instructions,
      role: "device_instruction",
    });
  }

  // Images from assetRefs
  const images: ImageRef[] = (raw.projector?.assetRefs || []).map((src, imgIdx) => ({
    id: `${raw.slideId}-img-${imgIdx}`,
    src,
    alt: `Slide ${index + 1} image ${imgIdx + 1}`,
    position: "inline" as const,
  }));

  // Interactive placeholder
  let interactivePlaceholder: InteractivePlaceholder | null = null;
  if (raw.activitySpec) {
    interactivePlaceholder = {
      activityType: raw.activitySpec.type || "unknown",
      prompt: raw.activitySpec.prompt,
      model: raw.activitySpec.model,
      showQr: raw.type === "intro",
    };
  }

  // Layout detection
  let layout: SlideSpec["layout"] = "default";
  if (raw.type === "intro") layout = "title";
  else if (images.length > 0) layout = "media_right";

  return {
    id: raw.slideId,
    index: index + 1,
    type: (raw.type || "explain") as SlideType,
    title: raw.projector?.headline || "",
    textBlocks,
    images,
    interactivePlaceholder,
    speakerNotes: raw.teacherNotes || "",
    layout,
  };
}

// ────────────────── Activity Transform Rules ──────────────────

export interface ActivityTransformRule {
  activityType: string;
  pptx: {
    renderChoices: boolean;
    correctInSpeakerNotes: boolean;
    showQr: boolean;
    fallbackText: string;
  };
  pdf: {
    renderChoices: boolean;
    showQr: boolean;
    fallbackText: string;
  };
  html: {
    embedInteractive: boolean;
    offlineFallbackText: string;
  };
}

const ACTIVITY_TRANSFORM_RULES: ActivityTransformRule[] = [
  {
    activityType: "mcq",
    pptx: { renderChoices: true, correctInSpeakerNotes: true, showQr: true, fallbackText: "Odpovězte na otázku na svém zařízení." },
    pdf: { renderChoices: true, showQr: true, fallbackText: "Zakroužkujte správnou odpověď." },
    html: { embedInteractive: true, offlineFallbackText: "Kvíz – otevřete online verzi pro interaktivní odpovídání." },
  },
  {
    activityType: "matching",
    pptx: { renderChoices: true, correctInSpeakerNotes: true, showQr: true, fallbackText: "Spojte dvojice na svém zařízení." },
    pdf: { renderChoices: true, showQr: false, fallbackText: "Spojte levý sloupec s pravým." },
    html: { embedInteractive: true, offlineFallbackText: "Spojování – otevřete online verzi." },
  },
  {
    activityType: "hotspot",
    pptx: { renderChoices: false, correctInSpeakerNotes: true, showQr: true, fallbackText: "Označte správné oblasti na obrázku (v aplikaci)." },
    pdf: { renderChoices: false, showQr: true, fallbackText: "Popište, které oblasti na obrázku jsou správné. (Viz obrázek výše.)" },
    html: { embedInteractive: true, offlineFallbackText: "Hotspot aktivita – pro interakci otevřete online verzi. Popis: Označte správné oblasti na obrázku." },
  },
  {
    activityType: "video",
    pptx: { renderChoices: false, correctInSpeakerNotes: true, showQr: true, fallbackText: "Přehrajte video a odpovězte na kontrolní otázky." },
    pdf: { renderChoices: false, showQr: true, fallbackText: "Video – kontrolní otázky jsou uvedeny níže jako textové úlohy." },
    html: { embedInteractive: true, offlineFallbackText: "Video aktivita – pro přehrání otevřete online verzi. Kontrolní otázky jsou uvedeny jako text." },
  },
  {
    activityType: "fill_blank",
    pptx: { renderChoices: false, correctInSpeakerNotes: true, showQr: false, fallbackText: "Doplňte chybějící slova." },
    pdf: { renderChoices: false, showQr: false, fallbackText: "Doplňte chybějící slova do textu." },
    html: { embedInteractive: true, offlineFallbackText: "Doplňovačka – otevřete online verzi." },
  },
  {
    activityType: "true_false",
    pptx: { renderChoices: true, correctInSpeakerNotes: true, showQr: false, fallbackText: "Rozhodněte: pravda nebo nepravda?" },
    pdf: { renderChoices: true, showQr: false, fallbackText: "Zakroužkujte Pravda / Nepravda." },
    html: { embedInteractive: true, offlineFallbackText: "Pravda/Nepravda – otevřete online verzi." },
  },
  {
    activityType: "ordering",
    pptx: { renderChoices: true, correctInSpeakerNotes: true, showQr: false, fallbackText: "Seřaďte kroky ve správném pořadí." },
    pdf: { renderChoices: true, showQr: false, fallbackText: "Očíslujte kroky ve správném pořadí." },
    html: { embedInteractive: true, offlineFallbackText: "Řazení – otevřete online verzi." },
  },
];

const DEFAULT_RULE: ActivityTransformRule = {
  activityType: "unknown",
  pptx: { renderChoices: false, correctInSpeakerNotes: false, showQr: true, fallbackText: "Vypracujte aktivitu v aplikaci ZEdu." },
  pdf: { renderChoices: false, showQr: true, fallbackText: "Vypracujte aktivitu v aplikaci ZEdu." },
  html: { embedInteractive: false, offlineFallbackText: "Aktivita – otevřete online verzi." },
};

/**
 * Get the transform rule for a given activity type.
 */
export function getActivityTransformRule(activityType: string): ActivityTransformRule {
  return ACTIVITY_TRANSFORM_RULES.find(r => r.activityType === activityType) || { ...DEFAULT_RULE, activityType };
}

/**
 * Get all transform rules as a JSON-serialisable object.
 */
export function getTransformRules(opts: { includeTeacherAnswers: boolean }): {
  transformRules: Array<{
    activityType: string;
    pptx: ActivityTransformRule["pptx"];
    pdf: ActivityTransformRule["pdf"];
    html: ActivityTransformRule["html"];
  }>;
} {
  return {
    transformRules: ACTIVITY_TRANSFORM_RULES.map(r => ({
      activityType: r.activityType,
      pptx: {
        ...r.pptx,
        correctInSpeakerNotes: opts.includeTeacherAnswers && r.pptx.correctInSpeakerNotes,
      },
      pdf: { ...r.pdf },
      html: { ...r.html },
    })),
  };
}

/**
 * Build speaker notes with answer key appended (for teacher exports).
 */
export function buildSpeakerNotesWithAnswers(
  slide: SlideSpec,
  includeTeacherAnswers: boolean,
): string {
  let notes = slide.speakerNotes || "";
  if (!includeTeacherAnswers || !slide.interactivePlaceholder) return notes;

  const rule = getActivityTransformRule(slide.interactivePlaceholder.activityType);
  if (!rule.pptx.correctInSpeakerNotes) return notes;

  const model = slide.interactivePlaceholder.model;
  if (!model) return notes;

  const answerLines: string[] = ["\n--- KLÍČ ODPOVĚDÍ ---"];
  const type = slide.interactivePlaceholder.activityType;

  if (type === "mcq" && model.choices && model.correctIndex !== undefined) {
    answerLines.push(`Správná odpověď: ${(model.choices as string[])[model.correctIndex as number]}`);
  } else if (type === "matching" && model.pairs) {
    answerLines.push("Správné páry:");
    (model.pairs as Array<{ left: string; right: string }>).forEach(p => {
      answerLines.push(`  ${p.left} → ${p.right}`);
    });
  } else if (type === "hotspot" && model.correctAreas) {
    answerLines.push("Správné oblasti:");
    (model.correctAreas as Array<{ label: string }>).forEach(a => {
      answerLines.push(`  • ${a.label}`);
    });
  } else if (type === "video" && model.checkpoints) {
    answerLines.push("Kontrolní otázky (checkpoints):");
    (model.checkpoints as Array<{ time: string; question: string; answer: string }>).forEach(cp => {
      answerLines.push(`  [${cp.time}] ${cp.question} → ${cp.answer}`);
    });
  } else if (type === "true_false") {
    answerLines.push(`Správná odpověď: ${model.correctAnswer === true ? "Pravda" : "Nepravda"}`);
  } else if (type === "ordering" && model.correctOrder) {
    answerLines.push("Správné pořadí:");
    (model.correctOrder as string[]).forEach((item, i) => {
      answerLines.push(`  ${i + 1}. ${item}`);
    });
  } else if (type === "fill_blank" && model.answers) {
    answerLines.push("Správné odpovědi:");
    (model.answers as string[]).forEach((a, i) => {
      answerLines.push(`  ${i + 1}. ${a}`);
    });
  }

  if (answerLines.length > 1) {
    notes += answerLines.join("\n");
  }
  return notes;
}

// ────────────────── Example document (for documentation) ──────────────────

export const SLIDE_SPEC_EXAMPLE: SlideSpecDocument = {
  version: "v1",
  meta: {
    title: "Základy výživy",
    subject: "Nauka o výživě",
    gradeBand: "1. ročník SŠ",
    mode: "teacher-led",
    slideCount: 3,
    generatedAt: "2026-03-15T12:00:00.000Z",
  },
  slides: [
    {
      id: "s1",
      index: 1,
      type: "intro",
      title: "Vítejte v lekci o výživě",
      textBlocks: [
        { id: "s1-heading", text: "Vítejte v lekci o výživě", role: "heading", bold: true },
        { id: "s1-body", text: "Dnes se naučíme základy makroživin.", role: "body" },
        { id: "s1-device", text: "Připojte se na kód níže.", role: "device_instruction" },
      ],
      images: [],
      interactivePlaceholder: {
        activityType: "join",
        joinCode: "ABC123",
        joinUrl: "nespecifikováno",
        showQr: true,
      },
      speakerNotes: "Přivítejte žáky, zobrazte QR kód.",
      layout: "title",
    },
    {
      id: "s2",
      index: 2,
      type: "explain",
      title: "Makroživiny",
      textBlocks: [
        { id: "s2-heading", text: "Makroživiny", role: "heading", bold: true },
        { id: "s2-body", text: "Bílkoviny, tuky a sacharidy jsou tři hlavní makroživiny.", role: "body" },
      ],
      images: [
        { id: "s2-img-0", src: "/images/macronutrients.png", alt: "Diagram makroživin", position: "side", widthFraction: 0.4 },
      ],
      interactivePlaceholder: null,
      speakerNotes: "Vysvětlete rozdíl mezi jednoduchými a složenými sacharidy.",
      layout: "media_right",
    },
    {
      id: "s3",
      index: 3,
      type: "practice",
      title: "Kvíz: Makroživiny",
      textBlocks: [
        { id: "s3-heading", text: "Kvíz: Makroživiny", role: "heading", bold: true },
        { id: "s3-device", text: "Odpovězte na otázku na svém zařízení.", role: "device_instruction" },
      ],
      images: [],
      interactivePlaceholder: {
        activityType: "mcq",
        prompt: "Který z následujících je sacharid?",
        model: {
          choices: ["Bílkovina", "Glukóza", "Cholesterol", "Aminokyselina"],
          correctIndex: 1,
        },
        showQr: false,
      },
      speakerNotes: "Správná odpověď: Glukóza. Vysvětlete proč.",
      layout: "default",
    },
  ],
};
