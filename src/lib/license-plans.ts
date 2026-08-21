export type PlanKey = "Start" | "Růst" | "Škola" | "Lektor";

export interface PlanFeature {
  text: string;
  beta?: boolean;
}

export interface PlanPrice {
  headline: string;
  suffix: string;
  note?: string;
}

export interface PlanTier {
  range: string;
  price: string;
}

export interface Plan {
  key: PlanKey;
  title: string;
  tagline: string;
  highlight?: boolean;
  limits: string[];
  features: PlanFeature[];
  price?: PlanPrice;
  priceTable?: PlanTier[];
  founderNote?: string;
}


export const PLANS: Plan[] = [
  {
    key: "Start",
    title: "Start",
    tagline: "Pro menší školy začínající s digitalizací výuky",
    limits: ["3 učitelé zdarma", "2 třídy", "Do 70 aktivních žáků"],
    features: [
      { text: "Učebnice a úkoly" },
      { text: "Živé prezentace" },
      { text: "Gamifikace a avatar" },
      { text: "Rodičovský portál" },
      { text: "ZEduMarket (jen prohlížení)" },
      { text: "Základní statistiky" },
      { text: "E-mailová podpora" },
    ],
    price: { headline: "100 Kč", suffix: "za žáka/rok", note: "max. 7 000 Kč/rok" },
    founderNote: "Prvních 50 škol: 70 Kč/žák/rok",

  },
  {
    key: "Růst",
    title: "Růst",
    tagline: "Pro školy, které chtějí naplno využít potenciál platformy",
    highlight: true,
    limits: ["8 učitelů zdarma", "6 tříd", "Do 250 aktivních žáků"],
    features: [
      { text: "Vše z balíčku Start" },
      { text: "Plný přístup do ZEduMarket", beta: true },
      { text: "Rozšířené statistiky", beta: true },
      { text: "Rychlejší e-mailová podpora" },
    ],
    price: { headline: "110 Kč", suffix: "za žáka/rok", note: "max. 27 500 Kč/rok" },
    founderNote: "Prvních 50 škol: 70 Kč/žák/rok",

  },
  {
    key: "Škola",
    title: "Škola",
    tagline: "Pro celoškolní nasazení bez limitů",
    limits: ["Neomezeno učitelů", "Neomezeno tříd", "250+ aktivních žáků"],
    features: [
      { text: "Vše z balíčku Růst" },
      { text: "Vlastní branding školy (logo, barvy)", beta: true },
      { text: "DVPP akreditované kurzy", beta: true },
      { text: "Statistiky a exporty pro vedení školy", beta: true },
      { text: "Prioritní e-mailová podpora" },
    ],
  },
  {
    key: "Lektor",
    title: "Lektor",
    tagline: "Pro samostatné lektory mimo školní strukturu",
    limits: ["1 učitel (vy)", "Do 5 skupin na start", "Platba podle počtu žáků"],
    features: [
      { text: "Učebnice a úkoly" },
      { text: "Živé prezentace" },
      { text: "Gamifikace a avatar" },
      { text: "ZEduMarket" },
      { text: "Základní statistiky" },
      { text: "E-mailová podpora" },
    ],
  },
];

export const LICENSE_ROLES = ["Ředitel/ka", "Učitel/ka", "Lektor/ka", "Jiné"] as const;
