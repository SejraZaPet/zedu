/**
 * Centrální registr kontextové nápovědy (otazníčky HelpHint).
 * Texty spravujte jen zde; odkazy do Akademie přes stabilní id kurzu/modulu.
 */
export type HelpAudience = "teacher" | "student" | "both";

export interface HelpHintEntry {
  title: string;
  body: string;
  when?: string;
  audience: HelpAudience;
  academy?: { courseId: string; moduleId?: string; label?: string };
  /** V demu: "explain" = místo odkazu vysvětlení; vlastní text volitelně. */
  demo?: { body?: string; academy?: "same" | "explain" };
}

export const ACADEMY_COURSES = {
  live: "e9913293-b547-4489-9f61-3191be6c1666", // Jak tvořit a používat živé prezentace
  daily: "ad521481-6a92-4054-97c2-854b351e61c1", // Bezli v každodenní výuce — pro učitele
} as const;

const LIVE_START = "cbbd259b-ee9f-4f53-8bbb-4045485a33ce";
const LIVE_ADD = "58e3cbf2-7996-4df0-869e-292b08de977e";
const LIVE_JOIN = "b1fc3de9-fb0c-438b-9ab8-0b7c863475d5";

export const DEMO_ACADEMY_TEXT = "Podrobný kurz najdete v Akademii v plném účtu.";
export const HELP_BODY_MAX = 280;

export const HELP_HINTS = {
  "live.tools": {
    title: "Nástroje živé prezentace",
    body: "Pod Nástroji najdete dotazy žáků, časovač, losování a další pomůcky do hodiny. Počet nových dotazů ukazuje červený odznak.",
    when: "Kdykoli během hodiny, když potřebujete pomůcku, ale nechcete opustit prezentaci.",
    audience: "teacher",
    academy: { courseId: ACADEMY_COURSES.live, moduleId: LIVE_START },
  },
  "live.activity": {
    title: "Spustit aktivitu a zveřejnit výsledky",
    body: "U slidu s aktivitou ji nejdřív spustíte, žáci odpovídají na svých zařízeních. Výsledky se na projektoru ukážou až po zveřejnění.",
    when: "Když chcete nechat třídu nejprve odpovědět a výsledky probrat společně.",
    audience: "teacher",
    academy: { courseId: ACADEMY_COURSES.live, moduleId: LIVE_START },
  },
  "live.join": {
    title: "Připojení žáků",
    body: "Žáci se připojí kódem hry nebo naskenováním QR kódu. Klepnutím na kód v rohu zobrazíte velký QR i během promítání.",
    when: "Na začátku hodiny nebo když se někdo připojuje později.",
    audience: "teacher",
    academy: { courseId: ACADEMY_COURSES.live, moduleId: LIVE_JOIN },
  },
  "live.add": {
    title: "Přidat slide za chodu",
    body: "Tlačítkem + vložíte nový slide až za ten aktuální. Žáci ho uvidí, teprve když na něj přejdete.",
    audience: "teacher",
    academy: { courseId: ACADEMY_COURSES.live, moduleId: LIVE_ADD },
  },
  "live.adaptive": {
    title: "Adaptivní závěr",
    body: "Ukáže otázky, ve kterých se objevila aspoň jedna chybná odpověď, seřazené od nejhorší. Úspěšnost je podíl správných odpovědí.",
    when: "Na konci hodiny pro společné zopakování. Pozor: „Zopakovat slabé otázky“ nahradí slidy této hry – výsledky si předem exportujte.",
    audience: "teacher",
    academy: { courseId: ACADEMY_COURSES.live, moduleId: LIVE_START },
  },
  "demo.limits": {
    title: "Limity ukázky",
    body: "Ukázka je na vyzkoušení, proto má omezený počet položek a AI dotazů. V plném účtu tato omezení nejsou.",
    audience: "both",
    demo: { academy: "explain" },
  },
} satisfies Record<string, HelpHintEntry>;

export type HelpHintId = keyof typeof HELP_HINTS;

export function getHelpHint(id: string): HelpHintEntry | null {
  return (HELP_HINTS as Record<string, HelpHintEntry>)[id] ?? null;
}

/** Odkaz do Akademie podle role; v demu s "explain" nebo pro žáka u učitelského kurzu null. */
export function academyHref(entry: HelpHintEntry, opts: { isDemo: boolean; role: "teacher" | "student" }): string | null {
  if (!entry.academy) return null;
  if (opts.isDemo && entry.demo?.academy === "explain") return null;
  if (opts.role === "student" && entry.audience === "teacher") return null;
  const base = opts.role === "student" ? "/student/akademie" : "/ucitel/akademie";
  const q = new URLSearchParams({ kurz: entry.academy.courseId });
  if (entry.academy.moduleId) q.set("modul", entry.academy.moduleId);
  return `${base}?${q.toString()}`;
}
