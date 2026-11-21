/** Krátké „k čemu to je“ a orientační délka technik (jen zobrazení, DB popisy se nemění). */
const INFO: Record<string, { purpose: string; duration: string }> = {
  "5p": { purpose: "Na rychlé zvládnutí nové kapitoly", duration: "25 min" },
  akrostika: { purpose: "Na zapamatování seznamů a pořadí", duration: "10 min" },
  loci: { purpose: "Na zapamatování pojmů a pořadí", duration: "15 min" },
  neana: { purpose: "Na důkladné pochopení textu", duration: "30 min" },
  pomodoro: { purpose: "Na soustředění bez rozptylování", duration: "25 min" },
  pqrst: { purpose: "Na učení z delšího textu", duration: "30 min" },
  sekvencni: { purpose: "Na rozdělení velkého učiva na části", duration: "20 min" },
  sq4r: { purpose: "Na hloubkové učení před testem", duration: "35 min" },
};

export const methodPurpose = (slug: string | null | undefined) => (slug ? INFO[slug] ?? null : null);

export interface HumanMethodInfo {
  title: string;
  description: string;
  originalName: string;
}

/** Žák vybírá podle záměru; odborný název zůstává pouze jako malá nápověda. */
const HUMAN_INFO: Record<string, HumanMethodInfo> = {
  "5p": { title: "Kapitola v pěti krocích", description: "Nejprve se podíváš, pak čteš a ověříš si, co umíš.", originalName: "5P" },
  akrostika: { title: "Zapamatování větou", description: "Věta, která ti pomůže zapamatovat.", originalName: "Akrostika" },
  loci: { title: "Paměťový palác", description: "Pojmy rozložíš po známých místech.", originalName: "Loci" },
  neana: { title: "Čtení a vlastní poznámky", description: "Text si přečteš, vysvětlíš a zapíšeš vlastními slovy.", originalName: "NEANA" },
  pomodoro: { title: "Soustředění s pauzami", description: "25 minut soustředění, pak pauza.", originalName: "Pomodoro" },
  pqrst: { title: "Čtení s otázkami", description: "Otázky si položíš před čtením i po něm.", originalName: "PQRST" },
  sekvencni: { title: "Učivo po částech", description: "Velké téma si rozdělíš na menší kroky.", originalName: "Sekvenční" },
  sq4r: { title: "Čtení krok za krokem", description: "Text projdeš od prvního náhledu až po opakování.", originalName: "SQ4R" },
};

export const methodHumanInfo = (slug: string | null | undefined): HumanMethodInfo | null => (slug ? HUMAN_INFO[slug] ?? null : null);

export const PRACTICE_DURATIONS = [5, 10, 15] as const;

/** 5 min = 4 otázky, 10 min = 8, 15 min = 12. */
export const questionCountForDuration = (min: number | null | undefined): number | null => {
  if (!min || !Number.isFinite(min)) return null;
  return Math.max(4, Math.min(12, Math.round(min / 5) * 4));
};

/** Pořadí a názvy technik v liště „Učím se“ u lekce. */
export const STUDY_TECHNIQUES: { slug: string; name: string }[] = [
  { slug: "sq4r", name: "SQ4R" },
  { slug: "pqrst", name: "PQRST" },
  { slug: "5p", name: "5P" },
  { slug: "neana", name: "NEANA" },
  { slug: "sekvencni", name: "Sekvenční" },
  { slug: "akrostika", name: "Akrostika" },
  { slug: "loci", name: "Loci" },
  { slug: "pomodoro", name: "Pomodoro" },
];

export const techniquePracticeUrl = (slug: string, lessonId: string, min = 10) =>
  `/student/metody/${slug}/procviceni?lesson=${encodeURIComponent(lessonId)}&min=${min}`;

export const techniqueGuideUrl = (slug: string) => `/student/metody?navod=${encodeURIComponent(slug)}`;
