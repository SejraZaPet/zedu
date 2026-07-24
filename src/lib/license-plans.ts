export type PlanKey = "Start" | "Růst" | "Škola" | "Lektor";

export interface Plan {
  key: PlanKey;
  title: string;
  tagline: string;
  highlight?: boolean;
  limits: string[];
  features: string[];
}

export const PLANS: Plan[] = [
  {
    key: "Start",
    title: "Start",
    tagline: "Pro menší školy začínající s digitalizací výuky",
    limits: ["3 učitelé zdarma", "2 třídy", "Do 70 aktivních žáků"],
    features: [
      "Učebnice a úkoly",
      "Živé prezentace",
      "Gamifikace a avatar",
      "Rodičovský portál",
      "ZEduMarket (jen prohlížení)",
      "Základní statistiky",
      "E-mailová podpora",
    ],
  },
  {
    key: "Růst",
    title: "Růst",
    tagline: "Pro školy, které chtějí naplno využít potenciál platformy",
    highlight: true,
    limits: ["8 učitelů zdarma", "6 tříd", "Do 250 aktivních žáků"],
    features: [
      "Vše z balíčku Start",
      "Plný přístup do ZEduMarket",
      "Rozšířené statistiky",
      "Rychlejší e-mailová podpora",
    ],
  },
  {
    key: "Škola",
    title: "Škola",
    tagline: "Pro celoškolní nasazení bez limitů",
    limits: ["Neomezeno učitelů", "Neomezeno tříd", "250+ aktivních žáků"],
    features: [
      "Vše z balíčku Růst",
      "Vlastní branding školy (logo, barvy)",
      "DVPP akreditované kurzy",
      "Statistiky a exporty pro vedení školy",
      "Prioritní podpora (telefon)",
    ],
  },
  {
    key: "Lektor",
    title: "Lektor",
    tagline: "Pro samostatné lektory mimo školní strukturu",
    limits: ["1 učitel (vy)", "Do 5 skupin na start", "Platba podle počtu žáků"],
    features: [
      "Učebnice a úkoly",
      "Živé prezentace",
      "Gamifikace a avatar",
      "ZEduMarket",
      "Základní statistiky",
      "E-mailová podpora",
    ],
  },
];

export const LICENSE_ROLES = ["Ředitel/ka", "Učitel/ka", "Lektor/ka", "Jiné"] as const;
